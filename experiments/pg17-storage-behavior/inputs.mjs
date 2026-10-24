import { readFile,readdir,lstat } from 'node:fs/promises'
import { dirname,join,relative } from 'node:path'
import { createRequire } from 'node:module'
import { root,digest } from '../pg17-routines/runtime.mjs'
import { capturePath,privatePath,enumSource } from './fixture.mjs'
const require=createRequire(import.meta.url)
export const own='experiments/pg17-storage-behavior'
export const evidenceDir='docs/research/evidence/2026-10-24-storage-behavior'

export async function inventory() {
  const paths=new Set([capturePath,privatePath,enumSource,
    'docs/research/evidence/2026-10-23-storage-definition-capture/semantic-audit.md',
    'docs/superpowers/specs/2026-10-24-storage-behavior-rehearsal.md',
    'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json',
    'experiments/pg17-routines/runtime.mjs','experiments/pg17-routines/runtime-pins.json',
    'experiments/pg17-rls-source-composition/fixture.mjs'])
  async function collect(path,set) {
    for(const e of await readdir(join(root,path),{withFileTypes:true})) {
      const p=path+'/'+e.name
      if(e.isDirectory())await collect(p,set)
      else if(!(path===own&&e.name==='input-pins.json'))set.add(p)
    }
  }
  await collect(own,paths)
  const sources={};for(const p of [...paths].sort())sources[p]=digest(await readFile(join(root,p)))
  const deps=new Set(Object.keys(require.cache).filter(p=>p.startsWith(root+'/')))
  for(const p of [...deps]) {
    let d=dirname(p)
    while(d.startsWith(root)) {
      try {await readFile(join(d,'package.json'));deps.add(join(d,'package.json'));break}catch{}
      d=dirname(d)
    }
  }
  const commonJS={};for(const p of [...deps].sort())commonJS[relative(root,p)]=digest(await readFile(p))
  const runtimePaths=new Set()
  for(const sub of ['bin','lib','share'])await collect('.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/'+sub,runtimePaths)
  const runtimeFiles={};for(const p of [...runtimePaths].sort())runtimeFiles[p]=digest(await readFile(join(root,p)))
  const privateFile=await lstat(join(root,privatePath)),privateDir=await lstat(dirname(join(root,privatePath)))
  return {sources,nodeExecutableSha256:digest(await readFile(process.execPath)),commonJS,runtimeFiles,privateModes:{file:privateFile.mode&0o7777,directory:privateDir.mode&0o7777,singleLink:privateFile.nlink===1,regularFile:privateFile.isFile()&&!privateFile.isSymbolicLink(),regularDirectory:privateDir.isDirectory()&&!privateDir.isSymbolicLink()}}
}
