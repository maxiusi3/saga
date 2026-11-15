import {createServer} from 'node:http'
import {mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {join,dirname} from 'node:path'
import {randomUUID} from 'node:crypto'

/** Contract substitute with separate metadata and real disk bytes. API list/GET
 * intentionally cannot discover raw orphans, matching the Supabase boundary. */
export async function storageHttp(directory) {
  const metadata=new Map(),events=[]
  let failDelete=false
  function filename(o) {
    if(!['audio-recordings','recording-candidates','saga'].includes(o.bucket)||!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/.test(o.objectKey)||/(^|\/)\.{1,2}(\/|$)/.test(o.objectKey))throw new Error('unsafe fixture path')
    return join(directory,o.bucket,o.objectKey)
  }
  const key=o=>o.bucket+'/'+o.objectKey
  async function put(o,bytes=Buffer.from('synthetic physical bytes')) {const p=filename(o);await mkdir(dirname(p),{recursive:true});await writeFile(p,bytes);metadata.set(key(o),{...o,id:randomUUID()})}
  const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture.invalid');events.push({method:req.method,path:url.pathname})
    try {
      const parts=url.pathname.split('/').slice(3)
      if(req.method==='GET'&&parts[0]==='object'&&parts[1]==='authenticated') {
        const o={bucket:parts[2],objectKey:parts.slice(3).join('/')}
        if(!metadata.has(key(o)))return json(res,{statusCode:'404'},404)
        let bytes;try{bytes=await readFile(filename(o))}catch(e){if(e.code==='ENOENT')return json(res,{statusCode:'404'},404);throw e}
        res.writeHead(206,{'content-type':'application/octet-stream','content-length':1});res.end(bytes.subarray(0,1));return
      }
      const buffers=[];for await(const chunk of req)buffers.push(chunk)
      const data=JSON.parse(Buffer.concat(buffers).toString())
      if(req.method==='POST'&&parts[0]==='object'&&parts[1]==='list') {
        const prefix=parts[2]+'/'+data.prefix+'/'
        const rows=[...metadata.entries()].filter(([k])=>k.startsWith(prefix)).map(([k,o])=>({name:k.slice(prefix.length),id:o.id})).sort((a,b)=>a.name<b.name?-1:1)
        return json(res,rows.slice(data.offset,data.offset+data.limit))
      }
      if(req.method==='DELETE'&&parts[0]==='object') {
        if(!Array.isArray(data.prefixes)||data.prefixes.length!==1)throw new Error('fixture non-exact delete')
        const o={bucket:parts[1],objectKey:data.prefixes[0]},exists=metadata.delete(key(o))
        if(failDelete){failDelete=false;return json(res,{error:'synthetic backend cleanup failed after metadata commit'},503)}
        if(exists)await rm(filename(o),{force:true})
        return json(res,exists?[{name:o.objectKey,bucket_id:o.bucket}]:[])
      }
      return json(res,{error:'fixture unsupported'},400)
    }catch(e){json(res,{error:e.code||'fixture failure'},500)}
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin=`http://127.0.0.1:${server.address().port}`
  return {metadata,events,put,filename,failNextDelete:()=>{failDelete=true},
    rawExists:async o=>{try{await stat(filename(o));return true}catch(e){if(e.code==='ENOENT')return false;throw e}},
    fetch:(input,init)=>{const u=new URL(String(input));if(u.origin!=='https://storage.invalid')throw new Error('remote request prohibited');return fetch(origin+u.pathname+u.search,init)},
    close:async()=>{server.closeAllConnections();await new Promise(done=>server.close(done))}}
}
