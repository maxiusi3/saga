import { readFile,readdir } from 'node:fs/promises'
import { join,dirname,relative } from 'node:path'
import { createRequire } from 'node:module'
import { root,digest } from '../pg17-routines/runtime.mjs'
const require=createRequire(import.meta.url)
require('typescript');require('../t02-source-ledger/scenarios.cjs')
export const own='experiments/pg17-rls-source-composition'
export async function inventory() {
  const prior=JSON.parse(await readFile(join(root,'experiments/pg17-entitlement-events/input-pins.json')))
  const files=new Set(Object.keys(prior.sources))
  for(const path of ['experiments/rls-rehearsal','experiments/t02-source-ledger','experiments/pg17-invitation-management',own]) {
    for(const e of await readdir(join(root,path),{withFileTypes:true}))if(e.isFile()&&e.name!=='input-pins.json')files.add(path+'/'+e.name)
  }
  for(const f of ['experiments/pg17-entitlement-events/input-pins.json','packages/web/src/lib/legacy-media-reference.ts','packages/web/src/lib/legacy-story-media.ts','docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T02-45-52-407Z.json'])files.add(f)
  const sources={}
  for(const f of [...files].sort())sources[f]=digest(await readFile(join(root,f)))
  const dependencyFiles=new Set(Object.keys(require.cache).filter(f=>f.startsWith(root+'/')))
  for(const f of [...dependencyFiles]) {
    let d=dirname(f)
    while(d.startsWith(root)) {
      try {await readFile(join(d,'package.json'));dependencyFiles.add(join(d,'package.json'));break}catch{}
      d=dirname(d)
    }
  }
  const commonJS={}
  for(const f of [...dependencyFiles].sort())commonJS[relative(root,f)]=digest(await readFile(f))
  const runtimeFiles={}
  async function walk(p) {for(const e of await readdir(join(root,p),{withFileTypes:true})) {
    const f=p+'/'+e.name
    if(e.isDirectory())await walk(f)
    else runtimeFiles[f]=digest(await readFile(join(root,f)))
  }}
  for(const sub of ['bin','lib','share'])await walk('.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/'+sub)
  return {sources,nodeExecutableSha256:digest(await readFile(process.execPath)),commonJS,runtimeFiles}
}
