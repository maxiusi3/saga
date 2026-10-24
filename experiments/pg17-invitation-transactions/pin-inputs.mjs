// Explicit freeze command; verification never silently rewrites pins.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inputFiles } from './input-files.mjs'
import { root, digest } from '../pg17-routines/runtime.mjs'
const base = 'experiments/pg17-invitation-transactions',
  here = join(root, base)
const previous = JSON.parse(
  await readFile(join(root, 'experiments/pg17-access-guards/input-pins.json'))
)
const sources = {}
const files = await inputFiles(here)
for (const f of files.sort()) sources[f] = digest(await readFile(join(root, f)))
const runtimeFiles = {},
  commonJS = {}
for (const [kind, entries, out] of [
  ['runtime', previous.runtimeFiles, runtimeFiles],
  ['CommonJS', previous.commonJS, commonJS]
])
  for (const [path, sha] of Object.entries(entries)) {
    const actual = digest(await readFile(join(root, path)))
    if (actual !== sha) throw new Error('Prior ' + kind + ' input changed')
    out[path] = actual
  }
await writeFile(
  join(here, 'input-pins.json'),
  JSON.stringify(
    {
      sources,
      nodeExecutableSha256: digest(await readFile(process.execPath)),
      commonJS,
      runtimeFiles
    },
    null,
    2
  ) + '\n'
)
console.log(
  JSON.stringify({
    sources: Object.keys(sources).length,
    commonJS: Object.keys(commonJS).length,
    runtimeFiles: Object.keys(runtimeFiles).length
  })
)
