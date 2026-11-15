import { createRequire } from 'node:module'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..')
const require = createRequire(join(root, 'package.json'))
/** Build the real recording page in an isolated synthetic boundary, with current styles. */
export async function buildBrowser(scratch, options = {}) {
  const boundary = options.boundary || join(here, 'boundaries.tsx')
  const webpack = require('webpack'), ts = require.resolve('typescript')
  const loader = join(scratch, 'typescript-loader.cjs')
  await writeFile(loader, `const ts=require(${JSON.stringify(ts)});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText}`)
  const dependencies = await new Promise((done, fail) => {
    const compiler = webpack({ mode: 'development', devtool: false, context: root,
      plugins: [new webpack.DefinePlugin({ 'process.env': JSON.stringify(options.env || {}) }),
        // Both alias and relative imports must reach the same declared synthetic boundary.
        new webpack.NormalModuleReplacementPlugin(/packages\/web\/src\/lib\/supabase\.ts$/, boundary)],
      entry: options.entry || join(here, 'entry.tsx'), output: { path: scratch, filename: 'flow.js' },
      resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { ...(options.alias || {}),
        'next/navigation$': boundary, '@/stores/auth-store$': boundary,
        '@/lib/supabase$': boundary, '@': join(root, 'packages/web/src'),
      } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
    })
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError || stats.hasErrors()) fail(error || closeError || new Error(stats.toString({ all: false, errors: true })))
      else done([...stats.compilation.fileDependencies].filter(p => p.startsWith(root + '/') && !p.includes('/node_modules/')))
    }))
  })
  const cssPath = join(root, 'packages/web/src/app/globals.css'), config = require(join(root, 'packages/web/tailwind.config.js'))
  const css = await require('postcss')([require('postcss-import'), require('tailwindcss')({ ...config,
    content: [...(options.content || []), join(root, 'packages/web/src/components/recording/**/*.tsx'), join(root, 'packages/web/src/components/{ui,audio}/**/*.tsx'),
      join(root, 'packages/web/src/app/*/dashboard/projects/*/record/page.tsx')],
  })]).process(await readFile(cssPath, 'utf8'), { from: cssPath })
  const files = (await Promise.all(dependencies.map(async p => (await stat(p)).isFile() ? p : null))).filter(Boolean)
  return { bundle: await readFile(join(scratch, 'flow.js')), css: css.css, dependencies: [...files, cssPath, join(root, 'packages/web/tailwind.config.js')] }
}
