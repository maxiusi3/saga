import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { root, digest } from '../pg17-routines/runtime.mjs'
import { compileModule } from './compile-module.mjs'

const evidence = join(root,'docs/research/evidence/2026-11-07-g1-fixes',`envelope-${Date.now()}-${randomUUID()}`)
await mkdir(evidence,{recursive:true})
const directory = await mkdtemp('/tmp/saga-webm-proof-')
const report={status:'running',sources:{},checks:[],boundary:'Actual saved Chrome minute chunk; original bytes retained. Strict FFmpeg on the detached container envelope. No missing audio is invented.'}
async function source(path){const bytes=await readFile(join(root,path));report.sources[path]=digest(bytes);return bytes.toString()}
try {
  await source('experiments/g1-local/verify-webm-envelope.mjs')
  const {closeWebmEnvelope}=await compileModule('lib/server/recording-webm-envelope.ts',directory,source)
  const inputDirectory=join(root,'docs/research/evidence/2026-11-07-g1-chrome/integrated-browser-1794059710258-2f76707e-5601-44f0-9829-05ded2ec89fb')
  const input=JSON.parse(await readFile(join(inputDirectory,'results.json')))
  const object=input.savedObjects.find(o=>o.key.endsWith('/0'))
  assert.ok(object)
  const bytes=await readFile(join(inputDirectory,object.filename)),hash=digest(bytes)
  assert.equal(hash,object.sha256)
  report.input={directory:inputDirectory,filename:object.filename,sha256:hash,bytes:bytes.length}
  const envelope=closeWebmEnvelope(bytes)
  assert.ok(envelope);assert.equal(digest(bytes),hash)
  await writeFile(join(evidence,'original.webm'),bytes)
  await writeFile(join(evidence,'closed.webm'),envelope.bytes)
  const decode=path=>spawnSync('/usr/local/bin/ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-xerror','-err_detect','explode','-protocol_whitelist','file,pipe','-f','matroska','-i',path,'-map','0','-c:a','pcm_s16le','-ac','1','-ar','16000','-f','s16le','pipe:1'],{maxBuffer:10000000,timeout:30000})
  const before=decode(join(evidence,'original.webm')),after=decode(join(evidence,'closed.webm'))
  assert.equal(before.status,0);assert.match(before.stderr.toString(),/File ended prematurely/)
  assert.equal(after.error,undefined);assert.equal(after.status,0);assert.equal(after.stderr.length,0)
  assert.ok(after.stdout.length>0);assert.deepEqual(before.stdout,after.stdout)
  report.decoded={originalExit:before.status,originalDiagnostic:before.stderr.toString(),closedExit:after.status,closedDiagnosticBytes:0,pcmSha256:digest(after.stdout),durationMs:after.stdout.length/32}
  report.envelope={sha256:digest(envelope.bytes),bytes:envelope.bytes.length,removedContainerHeaderBytes:envelope.removedContainerHeaderBytes,audioBlocks:envelope.audioBlocks}
  assert.equal(envelope.removedContainerHeaderBytes,1);assert.equal(envelope.audioBlocks,1000)
  // Remove the trailing header AND one byte of the final audio packet.
  const truncated=bytes.subarray(0,-2)
  assert.equal(closeWebmEnvelope(truncated),null)
  await writeFile(join(evidence,'truncated-packet.webm'),truncated)
  const bad=decode(join(evidence,'truncated-packet.webm'))
  assert.ok(bad.status!==0 || bad.stderr.length>0)
  report.checks.push('original unchanged','same decoded PCM before/after container closure','zero strict decoder diagnostics after closure','truncated audio packet rejected')
  report.status='passed'
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1}
finally{
  await rm(directory,{recursive:true,force:true})
  report.sourceDrift=[]
  for(const [path,hash]of Object.entries(report.sources))if(digest(await readFile(join(root,path)))!==hash)report.sourceDrift.push(path)
  if(report.sourceDrift.length){report.status='failed';process.exitCode=1}
  await writeFile(join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({evidence,...report},null,2))
}
