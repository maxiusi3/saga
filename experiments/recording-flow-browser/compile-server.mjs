import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), require = createRequire(join(root, 'package.json'))
const ts = require('typescript')

/** Compile intact production routes/helpers. Only authenticated session lookup and DB factory are synthetic. */
export async function compileServer(scratch, source, admin) {
  const output = join(scratch, 'server'), loaded = new Map(), inputs = []
  await mkdir(output, { recursive: true })
  const boundary = join(output, 'fixture-boundary.cjs')
  globalThis.__sagaRecordingFlowAdmin = admin
  await writeFile(boundary, `const {NextResponse}=require(${JSON.stringify(require.resolve('next/server'))});
exports.getSupabaseAdmin=()=>globalThis.__sagaRecordingFlowAdmin;
exports.getAuthenticatedUser=async request=>{
 const token=request.headers.get('authorization'),cookie=request.headers.get('cookie')||'';
 if(token!=='Bearer synthetic-flow-session'&&!cookie.includes('saga-flow-fixture=synthetic'))return {ok:false,response:NextResponse.json({error:'Synthetic authentication required'},{status:401})};
 return {ok:true,user:{id:'11111111-1111-4111-8111-111111111111'},headers:new Headers()};
};
`)
  async function compile(path) {
    const full = resolve(path)
    if (loaded.has(full)) return loaded.get(full)
    const rel = relative(join(root, 'packages/web/src'), full)
    if (rel.startsWith('..')) throw new Error('fixture compiler source escaped')
    const target = join(output, rel.replace(/\.tsx?$/, '.cjs'))
    loaded.set(full, target); inputs.push(relative(root, full))
    const text = await source(relative(root, full))
    let code = ts.transpileModule(text, { fileName: full, compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const refs = [...code.matchAll(/require\((['"])([^'"]+)\1\)/g)]
    for (const match of refs) {
      const specifier = match[2]; let destination
      if (['@/lib/supabase','@/lib/server/auth'].includes(specifier)) destination = boundary
      else if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const candidate = specifier.startsWith('@/') ? join(root, 'packages/web/src', specifier.slice(2)) : resolve(dirname(full), specifier)
        const sourcePath = candidate.endsWith('.ts') || candidate.endsWith('.tsx') ? candidate : candidate + '.ts'
        destination = await compile(sourcePath)
      } else destination = require.resolve(specifier)
      code = code.replaceAll(match[0], `require(${JSON.stringify(destination)})`)
    }
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, code); return target
  }
  const load = async rel => require(await compile(join(root, 'packages/web/src', rel)))
  const routes = {}
  for (const name of ['save','seal','status']) routes[name] = await load(`app/api/recordings/sessions/[sessionId]/${name}/route.ts`)
  routes.play = await load('app/api/media/assets/[assetId]/play/route.ts')
  const worker = await load('lib/server/recording-terminal-worker.ts')
  const host = await load('lib/server/recording-worker-host.ts')
  const { NextRequest } = require('next/server')
  return { routes, worker, host, inputs, NextRequest, clear: () => { delete globalThis.__sagaRecordingFlowAdmin } }
}
