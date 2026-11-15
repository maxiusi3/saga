/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import { readHostingReminderConfig, runHostingReminderWorkerOnce } from '../hosting-reminders'

const emailEnv = { HOSTING_REMINDER_EMAIL_ENABLED: 'true', HOSTING_REMINDER_EMAIL_FROM: 'hosting@example.invalid',
  RESEND_API_KEY: 'synthetic-key', HOSTING_REMINDER_WEB_ORIGIN: 'https://app.example.invalid' }
const claim = () => ({ id: randomUUID(), token: randomUUID(), orderId: randomUUID(), projectId: randomUUID(),
  expiresAt: '2027-02-01T00:00:00+00:00', daysBefore: 30, email: 'recipient@example.invalid' })
function fixture(options: { begin?: string; receiptFailure?: boolean } = {}) {
  const item = claim(), calls: Array<{name: string; args: any}> = []; let claimed = false
  const admin = { rpc(name: string, args: any) {
    calls.push({name,args})
    return { abortSignal: () => ({ retry: async () => {
      if (name === 'tick_hosting_reminders') return {data:{inAppSent:1},error:null}
      if (name === 'claim_hosting_reminder_email') { const data=claimed?null:item; claimed=true;return {data,error:null} }
      if (name === 'begin_hosting_reminder_email') return {data:{...item,status:options.begin??'outbound'},error:null}
      if (name === 'complete_hosting_reminder_email') {
        if(options.receiptFailure) throw Error('lost database response')
        return {data:{status:args.p_status},error:null}
      }
      throw Error('unexpected rpc')
    } }) }
  } }
  return { admin: admin as any, item, calls }
}
test('email is disabled by default; malformed explicit config fails closed', () => {
  expect(readHostingReminderConfig({}).email).toBeNull()
  for(const env of [{HOSTING_REMINDER_EMAIL_ENABLED:'yes'}, {...emailEnv,RESEND_API_KEY:''},
    {...emailEnv,HOSTING_REMINDER_WEB_ORIGIN:'http://localhost'}, {...emailEnv,HOSTING_REMINDER_EMAIL_FROM:'a@b.invalid\nCc: x@y.invalid'}]) {
    expect(()=>readHostingReminderConfig(env)).toThrow('hosting_reminder_configuration')
  }
})
test('default station delivery is a real RPC and never calls email provider', async () => {
  const f=fixture(), fetcher=jest.fn()
  expect(await runHostingReminderWorkerOnce({admin:f.admin,config:readHostingReminderConfig({}),fetch:fetcher})).toEqual({inAppSent:1,emailAccepted:0,emailUnknown:0,emailFailed:0})
  expect(f.calls.map(x=>x.name)).toEqual(['tick_hosting_reminders']);expect(fetcher).not.toHaveBeenCalled()
})
test('authorized email sends current payload with stable idempotency and persists actual receipt', async () => {
  const f=fixture(),fetcher=jest.fn(async()=>Response.json({id:'receipt-test'}))
  const result=await runHostingReminderWorkerOnce({admin:f.admin,config:readHostingReminderConfig(emailEnv),fetch:fetcher})
  expect(result.emailAccepted).toBe(1)
  const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit]
  expect(url).toBe('https://api.resend.com/emails')
  expect(new Headers(init.headers).get('Idempotency-Key')).toBe(`hosting-reminder/${f.item.id}`)
  const payload=JSON.parse(init.body as string)
  expect(payload.to).toEqual([f.item.email]);expect(payload.text).toContain(`https://app.example.invalid/en/dashboard/projects/${f.item.projectId}`)
  expect(f.calls.filter(x=>x.name==='complete_hosting_reminder_email')[0].args.p_receipt).toBe('receipt-test')
})
test.each(['canceled','unknown','sent'])('begin status %s cannot authorize another send', async begin => {
  const f=fixture({begin}), fetcher=jest.fn()
  await runHostingReminderWorkerOnce({admin:f.admin,config:readHostingReminderConfig(emailEnv),fetch:fetcher})
  expect(fetcher).not.toHaveBeenCalled()
})
test('uncertain transport and malformed success retain unknown without resending', async () => {
  for(const fetcher of [jest.fn(async()=>{throw Error('network') }),jest.fn(async()=>Response.json({success:true})),jest.fn(async()=>new Response('x'.repeat(9000)))]) {
    const f=fixture();const result=await runHostingReminderWorkerOnce({admin:f.admin,config:readHostingReminderConfig(emailEnv),fetch:fetcher})
    expect(result.emailUnknown).toBe(1);expect(fetcher).toHaveBeenCalledTimes(1)
    expect(f.calls.filter(x=>x.name==='complete_hosting_reminder_email')[0].args.p_status).toBe('unknown')
  }
})
test('provider rejection is recorded as failed; database acknowledgement loss never resends email', async () => {
  const f=fixture(), fetcher=jest.fn(async()=>new Response('',{status:422}))
  expect((await runHostingReminderWorkerOnce({admin:f.admin,config:readHostingReminderConfig(emailEnv),fetch:fetcher})).emailFailed).toBe(1)
  const lost=fixture({receiptFailure:true}), sent=jest.fn(async()=>Response.json({id:'receipt-test'}))
  await expect(runHostingReminderWorkerOnce({admin:lost.admin,config:readHostingReminderConfig(emailEnv),fetch:sent})).rejects.toThrow('hosting_reminder_unavailable')
  expect(sent).toHaveBeenCalledTimes(1)
})
