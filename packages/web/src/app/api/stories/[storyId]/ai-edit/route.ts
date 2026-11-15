import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isReviewUuid } from '@/lib/story-review-contract'
import { StoryReviewError } from '@/lib/server/story-review-service'
import { getStoryAiEditConfiguration, parseStoryAiEditRequest, StoryAiEditError } from '@/lib/server/story-ai-edit'
import { editStoryWithAi, readStoryAiEditStatus } from '@/lib/server/story-ai-edit-service'
export const runtime='nodejs'
type Context={params:Promise<{storyId:string}>}
function reply(body:unknown,status:number,headers?:Headers){const r=NextResponse.json(body,{status});headers?.forEach((v,k)=>r.headers.set(k,v));r.headers.set('Cache-Control','no-store');return r}
async function readBody(request:NextRequest){
 const reader=request.body?.getReader();if(!reader)throw new StoryAiEditError(400,'invalid_request')
 let size=0,rejectAbort=()=>{};const chunks:Uint8Array[]=[]
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(new StoryAiEditError(400,'invalid_request'))});request.signal.addEventListener('abort',rejectAbort,{once:true});const timer=setTimeout(rejectAbort,5000)
 try{if(request.signal.aborted)throw new StoryAiEditError(400,'invalid_request');while(true){const item=await Promise.race([reader.read(),aborted]);if(item.done)break;size+=item.value.byteLength;if(size>4096)throw new StoryAiEditError(400,'invalid_request');chunks.push(item.value)}const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}return parseStoryAiEditRequest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))}
 finally{clearTimeout(timer);request.signal.removeEventListener('abort',rejectAbort);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
async function handle(request:NextRequest,context:Context,write:boolean){
 if(process.env.MEDIA_ASSETS_ENABLED!=='true')return reply({error:'AI editing is unavailable.',code:'unavailable'},404)
 const auth=await getAuthenticatedUser(request);if(!auth.ok)return auth.response
 const {storyId}=await context.params;if(!isReviewUuid(storyId))return reply({error:'Invalid story.',code:'invalid_request'},400,auth.headers)
 let input;if(write){try{input=await readBody(request)}catch{return reply({error:'Invalid AI editing request.',code:'invalid_request'},400,auth.headers)}}
 try{const options={admin:getSupabaseAdmin(),signal:request.signal}
  if(!input)return reply({aiEdit:{...getStoryAiEditConfiguration(),...await readStoryAiEditStatus(auth.user.id,storyId,options)}},200,auth.headers)
  const review=await editStoryWithAi(auth.user.id,storyId,input,options);return reply({review},200,auth.headers)
 }catch(error){const e=error instanceof StoryAiEditError?error:error instanceof StoryReviewError?new StoryAiEditError(error.status,error.status===403?'access_denied':error.status===409?'source_changed':'unavailable'):new StoryAiEditError(503,'outcome_unknown');return reply({error:'The AI editing request could not be completed.',code:e.code},e.status,auth.headers)}
}
export function GET(request:NextRequest,context:Context){return handle(request,context,false)}
export function POST(request:NextRequest,context:Context){return handle(request,context,true)}
