'use client'
import {useEffect,useRef,useState} from 'react'
import type {ReviewRevision} from '@/lib/story-review-contract'
import {readAiEditReadiness,requestAiEdit,type AiEditReadiness} from '@/lib/story-ai-edit-client'
export function StoryAiEditControl({storyId,actorId,locale,revision,onSaved,onBusyChange,disabled=false}:{storyId:string;actorId:string;locale:string;revision?:ReviewRevision|null;onSaved:()=>void;onBusyChange?:(busy:boolean)=>void;disabled?:boolean}){
 const zh=locale.startsWith('zh'),[config,setConfig]=useState<AiEditReadiness|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState('')
 const epoch=useRef(0),inflight=useRef(false),identity=useRef({storyId,actorId});if(identity.current.storyId!==storyId||identity.current.actorId!==actorId){identity.current={storyId,actorId};epoch.current++}
 useEffect(()=>{const current=++epoch.current;setConfig(null);setConsent(false);setBusy(false);setUnknown(false);setError('');inflight.current=false
  void readAiEditReadiness(storyId).then(v=>{if(epoch.current===current)setConfig(v)}).catch(()=>{if(epoch.current===current)setError(zh?'AI 整理状态暂不可用。':'AI editing status is unavailable.')});return()=>{epoch.current++}
 },[storyId,actorId,revision?.id,zh])
 const button='min-h-11 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40'
 async function start(){if(!config?.policyVersion||!revision||!consent||inflight.current||unknown||disabled)return
  const current=epoch.current;inflight.current=true;setBusy(true);onBusyChange?.(true);setError('')
  try{await requestAiEdit(storyId,{requestId:crypto.randomUUID(),revisionId:revision.id,expectedVersion:revision.edit_version,consent:true,policyVersion:config.policyVersion});if(epoch.current===current){setConsent(false);onSaved()}}
  catch(cause){if(epoch.current!==current)return;const code=cause&&typeof cause==='object'&&'code'in cause?String(cause.code):''
   if(['review_rejected','source_evidence_invalid','provider_invalid_response','review_invalid'].includes(code))setError(zh?'编辑稿未通过来源或事实复核，未保存为待审版本。':'The edit failed source or fact review. No draft was saved.')
   else{setUnknown(true);setError(zh?'请重新加载核对状态；不会自动再次发送文本。':'Reload to check durable status; text will not be sent again automatically.')}}
  finally{if(epoch.current===current){setBusy(false);inflight.current=false;onBusyChange?.(false)}}
 }
 if(!config)return error?<p role="status" className="text-sm text-stone-600">{error}</p>:null
 if(config.pendingRequestId||unknown)return <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">{zh?'AI 请求结果尚未确定，请重新加载核对，暂不重复发送。':'AI request is unresolved. Reload to check before sending text again.'}{error&&<p>{error}</p>}</div>
 if(!config.ready)return <p className="text-sm text-stone-600">{zh?'AI 整理暂未启用，可以继续手动核对。':'AI editing is unavailable. You can continue manual review.'}</p>
 return <section aria-label={zh?'AI 整理故事':'AI story editing'} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
  <p className="text-sm leading-6">{zh?'将当前转写交给 Anthropic 整理，并由 OpenAI 独立核对事实。整理稿仍需家人逐段确认后批准。':'Send the current transcript to Anthropic for editing and OpenAI for independent fact review. Family members must still review each edited paragraph before approval.'}</p>
  <p className="text-sm text-stone-600">{config.editor.model} · {config.reviewer.model} · {zh?'美国处理':'Processed in the United States'}</p>
  <p className="text-sm"><a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="underline">Anthropic</a> · <a href="https://openai.com/policies/business-terms/" target="_blank" rel="noopener noreferrer" className="underline">OpenAI</a></p>
  {!revision&&<p className="text-sm">{zh?'先准备审阅稿，再进行 AI 整理。':'Prepare a review first to select the transcript version.'}</p>}
  <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5" checked={consent} disabled={busy||disabled||!revision} onChange={e=>setConsent(e.target.checked)}/><span>{zh?'我同意将本故事转写发送至 Anthropic 和 OpenAI，在美国进行整理与事实复核。':'I agree to send this story transcript to Anthropic and OpenAI for editing and fact review in the United States.'}</span></label>
  <button className={button} disabled={busy||disabled||!consent||!revision} onClick={()=>void start()}>{busy?(zh?'正在整理与复核…':'Editing and reviewing…'):(zh?'生成 AI 整理待审稿':'Prepare AI edited draft')}</button>
  {error&&<p role="alert" className="text-sm text-amber-900">{error}</p>}
 </section>
}
