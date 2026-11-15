import { createServer } from 'node:http'

/** Same-origin browser fixture; API bodies go through intact production route handlers. */
export async function browserServer({ h, database, compiled, ui, runWorker }) {
  const controls = { dropReply: null, workerPaused: false, workerError: null }, requests = [], pending = new Set()
  const json = (res, value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)) }
  async function body(req) { const chunks=[];let bytes=0;for await(const b of req){bytes+=b.length;if(bytes>104857600)throw new Error('fixture request too large');chunks.push(b)}return Buffer.concat(chunks) }
  let workerBusy = false
  async function work() {
    if(workerBusy||controls.workerPaused)return
    workerBusy=true
    try{await runWorker()}catch(error){controls.workerError=error.message}finally{workerBusy=false}
  }
  async function handle(req,res) {
    const url = new URL(req.url,'http://127.0.0.1'),event={method:req.method,path:url.pathname};requests.push(event)
    try {
      if(url.pathname==='/flow.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(ui.bundle);return}
      if(url.pathname==='/flow.css'){res.writeHead(200,{'content-type':'text/css'});res.end(ui.css);return}
      if(url.pathname.startsWith('/fixture/storage/')) {
        const parts=url.pathname.slice('/fixture/storage/'.length).split('/').map(decodeURIComponent),key=parts[0]+'/'+parts[1]
        if(parts.length!==2||!['audio-recordings'].includes(parts[0]))return json(res,{error:'bad synthetic object'},400)
        if(req.method==='POST') {
          if(database.objects.has(key))return json(res,{error:'already exists'},409)
          database.objects.set(key,{bytes:await body(req),type:req.headers['content-type']||'audio/webm'});return json(res,{ok:true})
        }
        const object=database.objects.get(key);if(!object)return json(res,{error:'missing synthetic object'},404)
        res.writeHead(200,{'content-type':object.type,'content-length':object.bytes.length});res.end(object.bytes);return
      }
      const session=/^\/api\/recordings\/sessions\/([^/]+)\/(save|seal|status)$/.exec(url.pathname)
      const asset=/^\/api\/media\/assets\/([^/]+)\/play$/.exec(url.pathname)
      if(session||asset) {
        const data=req.method==='POST'?await body(req):undefined
        const controller=new AbortController(),abort=()=>{if(!res.writableFinished)controller.abort()};req.once('aborted',abort);res.once('close',abort)
        const request=new compiled.NextRequest(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,body:data,signal:controller.signal})
        const name=session?session[2]:'play',identity=session?{sessionId:session[1]}:{assetId:asset[1]}
        const response=await compiled.routes[name][req.method](request,{params:Promise.resolve(identity)})
        const action=name==='save'&&data?JSON.parse(data.toString()).action:name
        if(controls.dropReply===action&&response.ok){
          controls.dropReply=null;event.droppedAfterCommit=true;event.loss='truncated JSON response after real commit'
          // A socket reset before headers can cause Chromium to replay the POST automatically.
          // Deliver only an unusable partial JSON body so the unknown outcome reaches the app.
          res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'});res.end('{');return
        }
        response.headers.forEach((v,k)=>res.setHeader(k,v));res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));return
      }
      if(url.pathname.startsWith('/api/'))return json(res,{error:'AI and agents intentionally unavailable in this isolated flow'},503)
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','set-cookie':'saga-flow-fixture=synthetic; Path=/; SameSite=Lax'})
      res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>G1 recording flow — local synthetic verification</title><link rel="stylesheet" href="/flow.css"></head><body><div id="root"></div><script src="/flow.js"></script></body></html>')
    }catch(error){event.error=error.message;if(!res.headersSent)json(res,{error:'local browser fixture failed'},500);else res.destroy()}
  }
  const server=createServer((req,res)=>{const task=handle(req,res);pending.add(task);task.finally(()=>pending.delete(task))})
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done)})
  const timer=setInterval(()=>void work(),250)
  return {origin:`http://127.0.0.1:${server.address().port}`,controls,requests,work,
    async close(){clearInterval(timer);while(workerBusy)await new Promise(done=>setTimeout(done,20));server.closeAllConnections();await new Promise(done=>server.close(done));await Promise.allSettled([...pending])}}
}
