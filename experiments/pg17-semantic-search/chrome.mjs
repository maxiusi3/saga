import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {join,relative} from 'node:path'
import {writeFile} from 'node:fs/promises'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {root} from '../pg17-routines/runtime.mjs'
import {buildBrowser} from '../recording-flow-browser/build.mjs'
const require=createRequire(import.meta.url),{NextRequest}=require('next/server'),{chromium,expect}=require('@playwright/test')
export async function semanticChrome({h,source,evidence,owner,project,route,sourceRoute,db,calls}){
 await source('experiments/pg17-semantic-search/chrome.mjs')
 const build=await buildBrowser(h.scratch,{entry:join(root,'experiments/pg17-semantic-search/entry.tsx'),boundary:join(root,'experiments/pg17-semantic-search/boundaries.tsx'),content:[join(root,'packages/web/src/components/projects/**/*.tsx')]})
 for(const file of build.dependencies)await source(relative(root,file))
 const requests=[],errors=[],server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost')
  if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/flow.css"><div id="root"></div><script>window.semanticConfig=${JSON.stringify({owner,project})}</script><script src="/flow.js"></script></html>`);return}
  if(url.pathname==='/flow.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(build.bundle);return}
  if(url.pathname==='/flow.css'){res.writeHead(200,{'content-type':'text/css'});res.end(build.css);return}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
  const chunks=[];for await(const chunk of req)chunks.push(chunk)
  const request=new NextRequest('http://localhost'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),context={params:Promise.resolve({id:project})}
  let response
  if(url.pathname===`/api/projects/${project}/search`)response=await route[req.method](request,context)
  else if(url.pathname===`/api/projects/${project}/search/source`)response=await sourceRoute.POST(request,context)
  else{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Unrelated publication unavailable in semantic fixture'}));return}
  requests.push({method:req.method,path:req.url,status:response.status});response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status)
  if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end()
 }catch(e){errors.push(e.message);if(!res.headersSent){res.writeHead(500);res.end()}else res.destroy()}})
 await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1100}})
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const button=page.getByRole('button',{name:'Search by meaning',exact:true});await expect(button).toBeDisabled()
  await page.getByRole('textbox',{name:'Search query',exact:true}).fill('relocation')
  const before=calls.length;await page.getByRole('button',{name:'Search Archive',exact:true}).click();await expect(page.getByTestId('provenance-search-answer')).toContainText('No matching family records');h.eq(calls.length,before,'literal Chrome request no provider traffic')
  await page.getByRole('checkbox',{name:/I agree to send this query/}).check();await expect(button).toBeEnabled();await button.click()
  await expect(page.getByTestId('provenance-search-answer')).toContainText('Ranked 2 related source');await expect(page.getByTestId('provenance-search-results')).toContainText('Grandmother moved overseas.')
  h.eq(calls.length,before+3,'explicit Chrome semantic action performs actual three HTTP calls')
  await page.screenshot({path:join(evidence,'semantic-chrome.png'),fullPage:true})
  await page.getByRole('button',{name:/Play Audio/}).first().click()
  await expect.poll(()=>requests.filter(r=>r.path.endsWith('/search/source')&&r.status===200).length).toBe(1)
  await expect.poll(()=>db.requests.filter(r=>r.path.startsWith('/storage/v1/object/sign/')).length).toBeGreaterThan(0)
  process.env.SEMANTIC_SEARCH_ENABLED='false';await page.reload();await expect(page.getByText('Semantic search is unavailable. You can search literal words above.')).toBeVisible();process.env.SEMANTIC_SEARCH_ENABLED='true'
  h.report.semanticChrome={status:'passed',browser:browser.version(),requests,errors,boundary:'Installed Chrome; production ConnectedProjectHub+semantic consent UI+client+search/source routes, actual Supabase SDK and PG. Synthetic sources/audio/embeddings, no live provider quality claim.'}
  h.eq(errors,[],'semantic browser handler errors');await writeFile(join(evidence,'chrome.json'),JSON.stringify(h.report.semanticChrome,null,2))
 }finally{process.env.SEMANTIC_SEARCH_ENABLED='true';await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done))}
}
