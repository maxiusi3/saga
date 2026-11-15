// Injected into the native Chromium runner. Production flow + DB; synthetic HTTP/Storage only.
window.runMeasuredFlow = async function (count, tamperStage) {
  const identity = {actorId:crypto.randomUUID(),projectId:crypto.randomUUID(),sessionId:crypto.randomUUID()}
  window.activeActor = identity.actorId
  const blob = new Blob([new Uint8Array(4096).fill(1)],{type:'audio/webm'})
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')
  await db.saveSession({id:identity.sessionId,userId:identity.actorId,projectId:identity.projectId,mimeType:'audio/webm',startedAt:META.happenedAt,state:'interrupted',lastPersistedIndex:-1,cloudConfirmedAssetId:null})
  for(let index=0;index<count;index++) await db.saveChunk(identity.sessionId,index,blob,{sha256:hash})
  const remote={storyId:crypto.randomUUID(),assetId:crypto.randomUUID(),manifestSha256:'a'.repeat(64),metadata:META,confirmed:false},jobId=crypto.randomUUID()
  let reserved=false,sealed=false,hashes=0,sealCalls=0,confirmCalls=0
  const lookup=()=>({schemaVersion:1,...identity,intent:reserved?{...remote,assetId:sealed?remote.assetId:null,manifestSha256:sealed?remote.manifestSha256:null}:null,canClearLocalDrafts:false})
  const receipt=()=>({schemaVersion:1,...identity,storyId:remote.storyId,assetId:remote.assetId,manifestSha256:remote.manifestSha256,playbackUrl:`/api/media/assets/${remote.assetId}/play`,canClearLocalDrafts:true})
  const tamper=async()=>{
    const conn=await raw()
    await new Promise((resolve,reject)=>{
      const tx=conn.transaction('chunks','readwrite'),store=tx.objectStore('chunks'),read=store.get(`${identity.sessionId}-0`)
      read.onsuccess=()=>store.put({...read.result,blob:new Blob([new Uint8Array(4096).fill(2)],{type:'audio/webm'})})
      tx.oncomplete=resolve;tx.onerror=reject
    });conn.close()
  }
  const storage=new Map()
  window.flowStorage={
    upload:async(path,bytes)=>{
      storage.set(path,bytes)
      if(tamperStage==='last-upload'&&path.endsWith(`/${count-1}`))await tamper()
      return {data:{path},error:null}
    },
    download:async path=>({data:storage.get(path),error:null}),
  }
  const originalFetch=window.fetch,originalDigest=crypto.subtle.digest.bind(crypto.subtle)
  window.fetch=async(url,options)=>{
    let value
    if(String(url).includes('/status?')) {
      if(tamperStage==='before-confirm')await tamper()
      value={schemaVersion:1,projectId:identity.projectId,sessionId:identity.sessionId,assetId:remote.assetId,jobId,manifestSha256:remote.manifestSha256,observedAt:'2026-11-06T00:00:02.000Z',state:'succeeded',content:{byteSize:count*4096,sha256:'b'.repeat(64),mimeType:'audio/webm',durationMs:1000},errorCode:null,finishedAt:'2026-11-06T00:00:01.000Z',canClearLocalDrafts:false}
    } else if(String(url).endsWith('/seal')) {
      sealCalls++;sealed=true
      value={asset:{id:remote.assetId,project_id:identity.projectId,story_id:remote.storyId,created_by:identity.actorId},job:{id:jobId,project_id:identity.projectId,asset_id:remote.assetId,created_by:identity.actorId},idempotentReplay:false,canClearLocalDrafts:false,manifestSha256:remote.manifestSha256}
    } else if(options.body) {
      const body=JSON.parse(options.body)
      if(body.action==='reserve'){reserved=true;value=lookup()}
      else {confirmCalls++;value=receipt();if(tamperStage==='after-confirm')await tamper()}
    } else value=lookup()
    return new Response(JSON.stringify(value),{status:200})
  }
  crypto.subtle.digest=(...args)=>{hashes++;return originalDigest(...args)}
  let result,error
  try {result=await saveFlow({identity,metadata:META,isCurrent:()=>true})}catch(e){error=e.message}
  finally {window.fetch=originalFetch;crypto.subtle.digest=originalDigest}
  const session=await db.getSession(identity.sessionId)
  return {count,hashes,result,error,sealCalls,confirmCalls,confirmation:session?.saveIntent?.confirmation,localChunks:(await db.getChunksBySession(identity.sessionId)).length}
}
