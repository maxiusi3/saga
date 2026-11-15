import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')

export async function compileCandidateModules(h, source) {
  const base = await compileModules(h, source)
  const compiledRoot = join(h.scratch, 'compiled')
  for (const name of ['recording-job-input', 'recording-job-verifier', 'recording-job-lease',
    'recording-job-worker', 'recording-output-candidate', 'recording-candidate-storage', 'recording-candidate-worker']) {
    const path = `packages/web/src/lib/server/${name}.ts`
    const compiled = ts.transpileModule(await source(path), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, reportDiagnostics: true })
    h.eq(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} transpiles`)
    const output = compiled.outputText.replace(/require\((['"])@\/([^'"]+)\1\)/g,
      (_match, _quote, alias) => `require(${JSON.stringify(join(compiledRoot, alias))})`)
    const destination = join(compiledRoot, `lib/server/${name}.js`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, output)
  }
  return { ...base, ...require(join(compiledRoot, 'lib/server/recording-candidate-worker.js')),
    workerModule: join(compiledRoot, 'lib/server/recording-candidate-worker.js') }
}
