import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest, failure } from '../pg17-routines/runtime.mjs'
import { loadReviewed, replay } from '../pg17-routines/replay.mjs'
import { prepare, seed, applyCandidate } from '../pg17-entitlement-events/scenarios.mjs'
import { scenarios, sources, manage, U, P } from './scenarios.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2), red = args.includes('--red')
const report = { startedAt: new Date().toISOString(), status: 'running', mode: red ? 'missing-ports-red' : 'candidate', scope: 'Synthetic local PostgreSQL 17.4 only; no remote calls', assertions: 0, scenarios: [], actorConnections: [], sources: {} }
const h = new Harness(report)
const dir = join(root, 'docs/research/evidence/2026-10-21-invitation-management')
const output = join(dir, `sql-${red ? 'red' : 'run'}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`)
process.send?.({ type: 'evidence', path: output })
for (const name of ['SIGTERM', 'SIGINT']) process.once(name, () => { if (!h.finishing) h.signal = name })
const deadline = setTimeout(() => { h.signal = 'deadline' }, 240000)
try {
  h.ok(args.every(x => ['--red','--test-signal-ready','--test-fail-start','--test-client-failure'].includes(x)), 'only local flags')
  const pins = JSON.parse(await readFile(join(root, 'experiments/pg17-entitlement-events/input-pins.json')))
  const prior = { ...pins.sources, ...pins.runtimeFiles, 'experiments/pg17-entitlement-events/input-pins.json': digest(await readFile(join(root, 'experiments/pg17-entitlement-events/input-pins.json'))) }
  for (const [path, sha] of Object.entries(prior)) {
    const actual = digest(await readFile(join(root,path)))
    h.eq(actual,sha,'prior pinned input exact bytes')
    report.sources[path] = actual
  }
  for (const file of (await readdir(here)).filter(x => /\.(mjs|sql|md)$/.test(x))) {
    const path = 'experiments/pg17-invitation-management/' + file
    report.sources[path] = digest(await readFile(join(root,path)))
  }
  h.eq(digest(await readFile(process.execPath)),pins.nodeExecutableSha256,'pinned Node executable')
  const reviewed = await loadReviewed(h)
  await h.start(args.includes('--test-fail-start'))
  await replay(h,reviewed)
  await prepare(h)
  await seed(h.db)
  await applyCandidate(h)
  if (args.includes('--test-client-failure')) await h.client('synthetic_missing_role')
  if (args.includes('--test-signal-ready')) {
    h.ok(process.send,'signal test requires IPC')
    process.send({ type: 'fixture-ready', path: h.scratch })
    while (!h.signal) await new Promise(r => setTimeout(r,20))
    h.check()
  }
  if (red) {
    await h.scenario('both_read_ports_missing_RED',async () => {
      const a = await h.actor('authenticated',U.owner,sources,[P.one,'facilitator'])
      const b = await h.actor('authenticated',U.owner,manage,[P.one,null])
      report.red = { expected: '00000', sources: a.sqlstate, management: b.sqlstate }
      h.eq([a.sqlstate,b.sqlstate],['00000','00000'],'required read ports exist')
    })
  } else await scenarios(h, await readFile(join(here,'candidate.sql'),'utf8'))
  report.status = 'passed'
} catch (e) {
  report.status = h.signal ? 'interrupted' : 'failed'
  if (h.signal) report.signal = h.signal
  else report.error = { code: /^[A-Z0-9_]+$/.test(e.code ?? '') ? e.code : 'ERROR', label: e.label }
} finally {
  clearTimeout(deadline)
  h.finishing = true
  try {
    for (const [path,sha] of Object.entries(report.sources)) h.eq(digest(await readFile(join(root,path))),sha,'input unchanged after run')
    report.sourcesUnchangedAtFinish = true
  } catch { report.status='failed'; report.sourceError='SOURCE_CHANGED_DURING_RUN' }
  try { await h.cleanup() } catch { report.status='failed'; report.cleanupError='CLEANUP_FAILED' }
  report.finishedAt = new Date().toISOString()
  await mkdir(dir,{recursive:true})
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({ status:report.status,evidence:relative(root,output),scenarios:report.scenarios.length,assertions:report.assertions,error:report.error,cleanup:report.cleanup }))
  process.exitCode = h.signal==='SIGTERM' ? 143 : h.signal==='SIGINT' ? 130 : report.status==='passed' ? 0 : 1
}
