import { randomUUID } from 'node:crypto'
import { seed, grant, payload, snapshot, invariant, U, P, R, send, accept, release, result } from '../pg17-entitlement-events/scenarios.mjs'
export { U, P }
export const sources = 'SELECT * FROM invitation_candidate.available_sources($1::uuid,$2::text)'
export const manage = 'SELECT * FROM invitation_candidate.management_list($1::uuid,$2::uuid)'
const read = (h,sql,args,user=U.owner) => h.actor('authenticated',user,sql,args)
async function good(h,sql,args,user=U.owner) {
  const before = await snapshot(h.db)
  const r = await read(h,sql,args,user)
  h.eq(r.sqlstate,'00000','read succeeds')
  await invariant(h,before,'read leaves all business and candidate rows unchanged')
  return r.rows
}
async function denied(h,sql,args,user=U.owner,code='42501') {
  const before = await snapshot(h.db)
  h.eq((await read(h,sql,args,user)).sqlstate,code,'read refuses invalid authority or state')
  await invariant(h,before,'refusal leaves all related rows unchanged')
}
async function source(h,role='facilitator',quantity=3,payer=U.owner,key=randomUUID()) {
  return (await grant(h,payload(key,key,'grant',role+'_seat',quantity,payer))).source_id
}
async function sent(h,sid,role='facilitator',email='invitee@example.test',project=P.one,request=randomUUID()) {
  const r = await read(h,send,[project,request,email,role,sid,null])
  h.eq(r.sqlstate,'00000','existing send creates actual bound invitation')
  return {...r.rows[0],request}
}
export async function scenarios(h,sql) {
  await h.scenario('installation_marker_database_duplicate_apply',async () => {
    for (const marker of [null,'wrong']) {
      await h.db.query(marker===null ? 'RESET saga.invitation_management' : "SET saga.invitation_management='wrong'")
      h.eq((await result(h.db.query(sql))).sqlstate,'42501','independent installation marker required')
      await h.db.query('ROLLBACK')
    }
    const wrong = await h.client('rehearsal_admin','postgres')
    try {
      await wrong.query("SET saga.invitation_management='only_synthetic_local'")
      h.eq((await result(wrong.query(sql))).sqlstate,'42501','database name boundary required')
      await wrong.query('ROLLBACK')
    } finally { await h.close(wrong) }
    await h.db.query("SET saga.invitation_management='only_synthetic_local'")
    await h.db.query(sql)
    await h.db.query(sql)
  })
  await h.scenario('sources_authority_identity_and_read_only',async () => {
    await seed(h.db)
    h.eq(await good(h,sources,[P.one,'facilitator']),[],'legacy wallet creates no source')
    const sid = await source(h), other = await source(h,'facilitator',2,U.other)
    await source(h,'storyteller')
    h.eq(await good(h,sources,[P.one,'facilitator']),[{source_id:sid,project_id:P.one,role:'facilitator',remaining:3}],'only actor role matched event-backed source')
    await denied(h,sources,[P.one,'facilitator'],U.other)
    await denied(h,sources,[P.missing,'facilitator'])
    await denied(h,sources,[P.one,'owner'],U.owner,'22023')
    await denied(h,sources,[null,'facilitator'],U.owner,'22023')
    await h.db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[U.owner])
    await denied(h,sources,[P.one,'facilitator'])
    await denied(h,manage,[P.one,null])
    await h.db.query("UPDATE auth.users SET email_confirmed_at='2020-01-01' WHERE id=$1",[U.owner])
    for(const mail of [null,'','malformed','two@@example.test','contains space@example.test']) {
      await h.db.query('UPDATE auth.users SET email=$1 WHERE id=$2',[mail,U.owner])
      await denied(h,sources,[P.one,'facilitator'])
      await denied(h,manage,[P.one,null])
    }
    await h.db.query("UPDATE auth.users SET email='owner@example.test' WHERE id=$1",[U.owner])
    await h.db.query("UPDATE public.projects SET status='inactive' WHERE id=$1",[P.one])
    await denied(h,sources,[P.one,'facilitator'])
    h.eq(await good(h,manage,[P.one,null]),[],'inactive project management allowed')
    await h.db.query("UPDATE public.projects SET status='active' WHERE id=$1",[P.one])
    for (const [column,value] of [['verified',false],['revoked',true],['remaining',0]]) {
      await h.db.query(`UPDATE invitation_candidate.trusted_seat_sources SET ${column}=$1 WHERE id=$2`,[value,sid])
      h.eq(await good(h,sources,[P.one,'facilitator']),[],'source flag or depletion filtered')
      await h.db.query(`UPDATE invitation_candidate.trusted_seat_sources SET ${column}=$1 WHERE id=$2`,[column==='remaining'?3:column==='verified',sid])
    }
    await h.db.query('UPDATE public.user_resource_wallets SET facilitator_seats=0 WHERE user_id=$1',[U.owner])
    h.eq(await good(h,sources,[P.one,'facilitator']),[],'positive wallet additionally necessary')
    h.ok(other!==sid,'foreign fixture distinct')
  })
  await h.scenario('sources_require_real_event_and_matching_grant_audit',async () => {
    await seed(h.db)
    const sid = await source(h)
    const log=(await h.db.query('SELECT grant_transaction_id AS id FROM entitlement_candidate.sources WHERE source_id=$1',[sid])).rows[0].id
    for (const [damage,restore] of [
      ["UPDATE entitlement_candidate.events SET outcome='already_granted' WHERE source_id=$1","UPDATE entitlement_candidate.events SET outcome='granted' WHERE source_id=$1"],
      ["UPDATE public.seat_transactions SET amount=99 WHERE id=(SELECT grant_transaction_id FROM entitlement_candidate.sources WHERE source_id=$1)","UPDATE public.seat_transactions SET amount=3 WHERE id=(SELECT grant_transaction_id FROM entitlement_candidate.sources WHERE source_id=$1)"],
      ["UPDATE public.seat_transactions SET metadata='{}' WHERE id=(SELECT grant_transaction_id FROM entitlement_candidate.sources WHERE source_id=$1)","UPDATE public.seat_transactions SET metadata=jsonb_build_object('entitlement_source_id',$1::uuid) WHERE id=(SELECT grant_transaction_id FROM entitlement_candidate.sources WHERE source_id=$1)"],
      ['UPDATE entitlement_candidate.sources SET grant_transaction_id=NULL WHERE source_id=$1',`UPDATE entitlement_candidate.sources SET grant_transaction_id='${log}' WHERE source_id=$1`],
    ]) {
      await h.db.query(damage,[sid])
      h.eq(await good(h,sources,[P.one,'facilitator']),[],'no unbacked authority')
      await h.db.query(restore,[sid])
    }
    await h.db.query("INSERT INTO invitation_candidate.trusted_seat_sources VALUES($1,$2,'facilitator_seat',8,8,true,false)",[randomUUID(),U.owner])
    h.eq((await good(h,sources,[P.one,'facilitator'])).map(x=>x.source_id),[sid],'bare trusted fixture row excluded')
  })
  await h.scenario('storyteller_member_and_reservation_conflicts',async () => {
    await seed(h.db)
    const sid = await source(h,'storyteller')
    for (const status of ['active','pending']) {
      await h.db.query("INSERT INTO public.project_roles(user_id,project_id,role,status,invited_by) VALUES($1,$2,'storyteller',$3,$4)",[U.other,P.one,status,U.owner])
      h.eq(await good(h,sources,[P.one,'storyteller']),[],'occupied storyteller unavailable')
      await h.db.query('DELETE FROM public.project_roles WHERE user_id=$1',[U.other])
    }
    const invitation = await sent(h,sid,'storyteller')
    h.eq(await good(h,sources,[P.one,'storyteller']),[],'reserved storyteller unavailable')
    h.eq((await read(h,release,[invitation.invitation_id,'cancelled'])).sqlstate,'00000','original release without lookup')
    h.eq((await good(h,sources,[P.one,'storyteller'])).length,1,'release makes role available')
  })
  await h.scenario('management_bound_history_transfer_inactive_revoke_release',async () => {
    await seed(h.db)
    const key=randomUUID(), sid=(await grant(h,payload(key,key,'grant','facilitator_seat',4))).source_id
    const invitation=await sent(h,sid)
    await h.db.query("INSERT INTO public.invitations(project_id,inviter_id,invitee_email,role,token,expires_at) VALUES($1,$2,'opaque@example.test','facilitator','opaque-historical',now()+interval '1 day')",[P.one,U.owner])
    let rows=await good(h,manage,[P.one,null])
    h.eq(rows.length,1,'unbound opaque invitation excluded')
    h.eq(Object.keys(rows[0]),['invitation_id','project_id','invitee_email','role','status','expires_at','created_at','request_id'],'strict no-token projection')
    h.eq(rows[0].request_id,invitation.request,'original actor request available')
    await denied(h,manage,[P.one,null],U.other)
    await grant(h,payload(randomUUID(),key,'revoke','facilitator_seat',4))
    await h.db.query("UPDATE public.projects SET facilitator_id=$1,owner_id=$1,status='inactive' WHERE id=$2",[U.next,P.one])
    await denied(h,manage,[P.one,null])
    rows=await good(h,manage,[P.one,null],U.next)
    h.eq([rows.length,rows[0].request_id,rows[0].status],[1,null,'pending'],'new facilitator sees cleanup history without prior request')
    h.eq((await read(h,release,[invitation.invitation_id,'cancelled'],U.next)).sqlstate,'00000','release survives source revoke and project transfer/inactive')
    h.eq((await good(h,manage,[P.one,null],U.next))[0].status,'declined','released history shown')
  })
  await h.scenario('accepted_history_inactive_deleted_member_and_corruption',async () => {
    await seed(h.db)
    const sid=await source(h), invitation=await sent(h,sid)
    h.eq((await read(h,accept,[invitation.token],U.invitee)).sqlstate,'00000','actual acceptance')
    h.eq((await good(h,manage,[P.one,null]))[0].status,'accepted','accepted history shown')
    await h.db.query("UPDATE public.project_roles SET status='inactive' WHERE user_id=$1",[U.invitee])
    h.eq((await good(h,manage,[P.one,null]))[0].status,'accepted','inactive historical member accepted')
    await h.db.query("UPDATE public.project_roles SET role='storyteller' WHERE user_id=$1",[U.invitee])
    await denied(h,manage,[P.one,null])
    await h.db.query("UPDATE public.project_roles SET role='facilitator' WHERE user_id=$1",[U.invitee])
    await h.db.query('DELETE FROM public.project_roles WHERE user_id=$1',[U.invitee])
    h.eq((await good(h,manage,[P.one,null]))[0].status,'accepted','deleted historical member accepted')
    for (const [damage,restore] of [
      ["UPDATE public.invitations SET status='pending' WHERE id=$1","UPDATE public.invitations SET status='accepted' WHERE id=$1"],
      ["UPDATE public.invitations SET token='corrupt' WHERE id=$1","UPDATE public.invitations SET token=(SELECT token FROM invitation_candidate.bindings WHERE invitation_id=$1) WHERE id=$1"],
      ["UPDATE public.invitations SET accepted_at=NULL WHERE id=$1","UPDATE public.invitations SET accepted_at=(SELECT joined_at FROM invitation_candidate.bindings WHERE invitation_id=$1) WHERE id=$1"],
      ["UPDATE public.invitations SET created_at=expires_at WHERE id=$1","UPDATE public.invitations SET created_at=expires_at-interval '7 days' WHERE id=$1"],
      ["UPDATE public.seat_transactions SET amount=99 WHERE id=(SELECT reserve_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)","UPDATE public.seat_transactions SET amount=-1 WHERE id=(SELECT reserve_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)"],
      ["UPDATE public.seat_transactions SET amount=99 WHERE id=(SELECT activation_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)","UPDATE public.seat_transactions SET amount=0 WHERE id=(SELECT activation_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)"],
      ["UPDATE invitation_candidate.requests SET invitee_email='wrong@example.test' WHERE invitation_id=$1","UPDATE invitation_candidate.requests SET invitee_email='invitee@example.test' WHERE invitation_id=$1"],
      ["UPDATE invitation_candidate.bindings SET invitee_email='wrong@example.test' WHERE invitation_id=$1","UPDATE invitation_candidate.bindings SET invitee_email='invitee@example.test' WHERE invitation_id=$1"],
    ]) {
      await h.db.query(damage,[invitation.invitation_id])
      await denied(h,manage,[P.one,'ffffffff-ffff-ffff-ffff-ffffffffffff'])
      await h.db.query(restore,[invitation.invitation_id])
    }
  })
  await h.scenario('expired_history_release_audit_and_source_corruption',async () => {
    await seed(h.db)
    const sid=await source(h), invitation=await sent(h,sid)
    await h.db.query("UPDATE public.invitations SET created_at='1999-12-25',expires_at='2000-01-01' WHERE id=$1",[invitation.invitation_id])
    await h.db.query("UPDATE invitation_candidate.bindings SET expires_at='2000-01-01' WHERE invitation_id=$1",[invitation.invitation_id])
    h.eq((await good(h,manage,[P.one,null]))[0].status,'pending','expired reservation stays pending until explicit release')
    h.eq((await read(h,release,[invitation.invitation_id,'expired'])).sqlstate,'00000','expired cleanup uses original global release')
    h.eq((await good(h,manage,[P.one,null]))[0].status,'expired','expired terminal history')
    await h.db.query('UPDATE public.seat_transactions SET amount=99 WHERE id=(SELECT release_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)',[invitation.invitation_id])
    await denied(h,manage,[P.one,null])
    await h.db.query('UPDATE public.seat_transactions SET amount=1 WHERE id=(SELECT release_transaction_id FROM invitation_candidate.bindings WHERE invitation_id=$1)',[invitation.invitation_id])
    await h.db.query("UPDATE invitation_candidate.trusted_seat_sources SET resource_type='storyteller_seat' WHERE id=$1",[sid])
    await denied(h,manage,[P.one,null])
    await h.db.query("UPDATE invitation_candidate.trusted_seat_sources SET resource_type='facilitator_seat' WHERE id=$1",[sid])
    await h.db.query('UPDATE entitlement_candidate.sources SET grant_transaction_id=NULL WHERE source_id=$1',[sid])
    await denied(h,manage,[P.one,null])
  })
  await h.scenario('sources_max100_management_uuid_keyset_max50',async () => {
    await seed(h.db)
    const sid=await source(h,'facilitator',110)
    for (let i=0;i<104;i++) await source(h)
    const available=await good(h,sources,[P.one,'facilitator'])
    h.eq(available.length,100,'source hard cap')
    h.eq(available.map(x=>x.source_id),available.map(x=>x.source_id).toSorted(),'source UUID sorted')
    for (let i=0;i<53;i++) await sent(h,sid,'facilitator',`fixture${i}@example.test`)
    const a=await good(h,manage,[P.one,null]),b=await good(h,manage,[P.one,a.at(-1).invitation_id])
    h.eq([a.length,b.length],[50,3],'management cap and next page')
    const ids=[...a,...b].map(x=>x.invitation_id)
    h.eq(ids,ids.toSorted(),'strict UUID keyset order')
    h.eq(new Set(ids).size,53,'pagination unique')
    h.eq(await good(h,manage,[P.one,b.at(-1).invitation_id]),[],'last page empty')
    h.eq((await h.actor('authenticated',U.owner,manage,[P.one,'not-uuid'])).sqlstate,'22P02','invalid UUID rejected by typed signature')
  })
  await h.scenario('exact_security_definer_acl_and_direct_table_refusal',async () => {
    const oids=(await h.db.query("SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='invitation_candidate' AND p.proname=ANY($1)",[['available_sources','management_list']])).rows.map(x=>x.oid)
    const defs=(await h.db.query("SELECT p.proname,p.prosecdef,p.provolatile,p.proconfig,r.rolname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE n.nspname='invitation_candidate' AND p.proname=ANY($1) ORDER BY p.proname",[['available_sources','management_list']])).rows
    h.eq(defs.map(x=>[x.proname,x.prosecdef,x.provolatile,x.proconfig,x.rolname]),[
      ['available_sources',true,'s',['search_path=""'],'fixture_owner'],['management_list',true,'s',['search_path=""'],'fixture_owner']
    ],'owned stable security definers empty search_path')
    for (const role of ['anon','authenticated','service_role','metadata_reader','entitlement_writer']) {
      const c=role==='entitlement_writer' ? await h.client(role) : await h.actorClient(role,U.owner)
      try {
        for (const oid of oids)
          h.eq((await c.query('SELECT pg_catalog.has_function_privilege(current_user,$1::oid,\'EXECUTE\') AS allowed',[oid])).rows[0].allowed,role==='authenticated','only authenticated EXECUTE')
        if(role!=='authenticated') for (const [query,args] of [[sources,[P.one,'facilitator']],[manage,[P.one,null]]]) h.eq((await result(c.query(query,args))).sqlstate,'42501','real role call denied')
        for(const table of ['public.invitations','invitation_candidate.bindings','invitation_candidate.requests','invitation_candidate.trusted_seat_sources','entitlement_candidate.sources','entitlement_candidate.events'])
          h.eq((await result(c.query('SELECT * FROM '+table))).sqlstate,'42501','no direct table reads')
        h.eq((await result(c.query('SELECT invitation_candidate._management_source_valid($1)',[randomUUID()]))).sqlstate,'42501','internal helper not callable')
        h.eq((await result(c.query('SELECT invitation_candidate._management_confirmed($1)',[U.owner]))).sqlstate,'42501','confirmation helper not callable')
      } finally { await h.close(c) }
    }
    await denied(h,manage,[P.one,null],null)
  })
  await h.scenario('actual_read_only_transaction_and_default_cursor',async () => {
    await seed(h.db)
    const sid=await source(h),invitation=await sent(h,sid)
    const before=await snapshot(h.db),c=await h.actorClient('authenticated',U.owner)
    try {
      await c.query('BEGIN READ ONLY')
      h.eq((await c.query(sources,[P.one,'facilitator'])).rows[0].source_id,sid,'sources work within actual read-only transaction')
      h.eq((await c.query('SELECT * FROM invitation_candidate.management_list($1::uuid)',[P.one])).rows[0].invitation_id,invitation.invitation_id,'management default cursor and read-only transaction')
      await c.query('ROLLBACK')
    } finally {await h.close(c)}
    await invariant(h,before,'actual read-only transaction writes nothing')
  })
}
