import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { root } from '../pg17-routines/runtime.mjs'
const require = createRequire(import.meta.url), ts = require('typescript')

/** Compile the actual server graph; callers explicitly declare transport seams. */
export async function compileModule(entry, directory, source, boundaries = {}) {
  const loaded = new Map()
  async function compile(path) {
    const full = resolve(root, 'packages/web/src', path)
    const local = relative(join(root, 'packages/web/src'), full)
    if (local.startsWith('..')) throw new Error('Compiler source escaped')
    if (loaded.has(full)) return loaded.get(full)
    const output = join(directory, local.replace(/\.tsx?$/, '.cjs'))
    loaded.set(full, output)
    const text = await source(relative(root, full))
    let code = ts.transpileModule(text, { fileName: full, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText
    for (const match of [...code.matchAll(/require\((['"])([^'"]+)\1\)/g)]) {
      const specifier = match[2]
      let destination = boundaries[specifier]
      if (!destination) {
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const target = specifier.startsWith('@/') ? specifier.slice(2) : relative(join(root, 'packages/web/src'), resolve(dirname(full), specifier))
          destination = await compile(/\.tsx?$/.test(target) ? target : target + '.ts')
        } else destination = require.resolve(specifier)
      }
      code = code.replaceAll(match[0], `require(${JSON.stringify(destination)})`)
    }
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, code)
    return output
  }
  return require(await compile(entry))
}
