import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { digest } from '../pg17-routines/runtime.mjs'
import { compileModule } from './compile-module.mjs'

const tables = ['invitation_candidate.trusted_seat_sources', 'invitation_candidate.bindings', 'invitation_candidate.requests',
  'entitlement_candidate.sources', 'entitlement_candidate.events', 'public.payment_orders', 'public.payment_order_requests',
  'public.payment_order_events', 'public.payment_project_rights', 'public.publication_snapshots', 'public.publication_delivery_jobs', 'public.publication_artifact_cleanup']
const rows = async db => Object.fromEntries(await Promise.all(tables.map(async table => [table,
  (await db.query(`SELECT to_jsonb(t) AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(row => row.value)])))

/** Populate production RPC state, then independently back up the private volume.
 * Payment here is a trusted maintenance fixture, not another Stripe acceptance.
 */
export async function prepareG3Backup({ h, db, source, evidence, owner, project }) {
  const spool = join(h.scratch, 'publication-spool')
  await mkdir(spool, { mode: 0o700 }); process.env.ARCHIVE_SPOOL_DIR = spool
  const order = (await h.db.query("SELECT public.reserve_payment_order($1,$2,'digital_project_59') AS value", [owner, randomUUID()])).rows[0].value
  const intent = 'pi_Backup' + randomUUID().replaceAll('-', '')
  await h.db.query('SELECT public.bind_payment_intent($1,$2,$3)', [order.id, owner, intent])
  await h.db.query("SELECT public.apply_verified_payment_event($1,$2,'payment_intent.succeeded',$3,$4,5900,'usd',false,$5,0)", [order.id, 'evt_backup_' + randomUUID().replaceAll('-', ''), intent, owner, digest('controlled backup entitlement')])
  await h.db.query('SELECT public.allocate_payment_project($1,$2,$3,NULL,NULL)', [owner, order.id, project])
  const other = randomUUID()
  await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [other, 'Independent retained publication', owner])
  await h.db.query("INSERT INTO project_roles(project_id,user_id,role,status) VALUES($1,$2,'facilitator','active')", [other, owner])
  await h.db.query('INSERT INTO stories(id,project_id,user_id,title,transcript) VALUES($1,$2,$3,$4,$5)', [randomUUID(), other, owner, 'Retained family source', 'Independent preserved text. 家庭原文。'])
  const target = join(h.scratch, 'backup-publication-runtime')
  const loader = await compileModule('lib/server/publication-source-service.ts', target, source)
  const service = await compileModule('lib/server/publication-delivery-service.ts', target, source)
  const worker = await compileModule('lib/server/publication-delivery-worker.ts', target, source)
  const artifacts = []
  for (const projectId of [project, other]) {
    const input = await loader.loadArchiveSource(db.admin, projectId, loader.durableArchiveLimits)
    const prepared = await service.preparePublication(db.admin, owner, input)
    const run = await worker.runPublicationDeliveryWorker({ admin: db.admin })
    h.eq(run.outcome, 'ready', 'actual publication worker before backup')
    const job = await service.publicationOperation(db.admin, owner, projectId, 'status', prepared.id)
    const path = worker.publicationArtifactPath(job), bytes = await readFile(path)
    h.eq(digest(bytes), job.zip_sha256, 'publication artifact hash before freeze')
    const saved = join(evidence, 'backup-publications', relative(spool, path))
    await mkdir(join(saved, '..'), { recursive: true, mode: 0o700 }); await copyFile(path, saved)
    artifacts.push({ jobId: job.id, projectId, relativePath: relative(spool, path), sha256: digest(bytes), bytes: bytes.length, saved })
  }
  const snapshot = await rows(h.db)
  h.eq(snapshot['entitlement_candidate.sources'].filter(value => value.provider === 'stripe_test' && value.source_key.startsWith(intent + ':')).length, 2, 'both trusted source kinds are in backup fixture')
  h.eq(snapshot['public.payment_project_rights'].find(value => value.order_id === order.id).project_id, project, 'paid project allocation is in backup fixture')
  await writeFile(join(evidence, 'publication-volume-manifest.json'), JSON.stringify({ artifacts, tables }, null, 2) + '\n')
  return { artifacts, snapshot, selectedProject: project, retainedProject: other, worker }
}

export async function restoreG3Backup({ h, restored, evidence, fixture }) {
  h.eq(await rows(restored), fixture.snapshot, 'all G3 public/private schema rows restored byte-for-byte before replay')
  const spool = join(h.scratch, 'restored-publication-spool')
  await mkdir(spool, { mode: 0o700 }); process.env.ARCHIVE_SPOOL_DIR = spool
  for (const artifact of fixture.artifacts) {
    const bytes = await readFile(artifact.saved)
    h.eq(digest(bytes), artifact.sha256, 'backed-up publication volume hash')
    const destination = join(spool, artifact.relativePath)
    await mkdir(join(destination, '..'), { recursive: true, mode: 0o700 }); await copyFile(artifact.saved, destination)
  }
  return spool
}

export async function verifyG3Replay({ h, restored, restoredDb, fixture, spool, result }) {
  const selected = fixture.artifacts.find(artifact => artifact.projectId === fixture.selectedProject)
  const retained = fixture.artifacts.find(artifact => artifact.projectId === fixture.retainedProject)
  h.eq((await restored.query('SELECT count(*)::int n FROM publication_snapshots WHERE id=$1', [selected.jobId])).rows[0].n, 0, 'post-freeze replay deletes selected frozen publication')
  h.eq((await restored.query('SELECT count(*)::int n FROM publication_delivery_jobs WHERE id=$1', [selected.jobId])).rows[0].n, 0, 'post-freeze replay deletes selected delivery job')
  h.eq((await restored.query('SELECT count(*)::int n FROM publication_artifact_cleanup WHERE job_id=$1', [selected.jobId])).rows[0].n, 1, 'post-freeze replay durably queues artifact erasure')
  await fixture.worker.reconcilePublicationArtifacts(restoredDb.admin)
  let gone = false; try { await access(join(spool, selected.relativePath)) } catch { gone = true }
  h.ok(gone, 'actual restored publication ZIP erased after replay')
  h.eq(digest(await readFile(join(spool, retained.relativePath))), retained.sha256, 'unrelated restored publication ZIP preserved exactly')
  h.eq((await restored.query('SELECT count(*)::int n FROM publication_artifact_cleanup')).rows[0].n, 0, 'artifact cleanup acknowledgment persisted')
  result.g3 = { status: 'passed', schemaTables: tables, artifacts: fixture.artifacts.map(({ saved, ...value }) => value), replayedPublicationRemoved: true, unrelatedPublicationPreserved: true,
    boundary: 'Real production publication worker, database snapshot and private spool copies; local synthetic payment fulfillment fixture, no live provider.' }
}
