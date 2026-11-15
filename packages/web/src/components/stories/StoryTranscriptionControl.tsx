'use client'
import {useEffect,useRef,useState} from 'react'
import type {ReviewRevision} from '@/lib/story-review-contract'
import {readTranscriptionReadiness,transcribeStory,type TranscriptionReadiness} from '@/lib/story-transcription-client'

export function StoryTranscriptionControl({storyId,actorId,locale,revision,onSaved,onBusyChange,disabled=false}:{storyId:string;actorId:string;locale:string;revision?:ReviewRevision|null;onSaved:()=>void;onBusyChange?:(busy:boolean)=>void;disabled?:boolean}) {
 const zh=locale.startsWith('zh'),[config,setConfig]=useState<TranscriptionReadiness|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('')
 const epoch=useRef(0),inflight=useRef(false)
 const identity=useRef({storyId,actorId})
 if(identity.current.storyId!==storyId||identity.current.actorId!==actorId){identity.current={storyId,actorId};epoch.current++}
 useEffect(()=>{const current=++epoch.current;setConfig(null);setConsent(false);setUncertain(false);setBusy(false);setError('');inflight.current=false
  void readTranscriptionReadiness(storyId).then(value=>{if(epoch.current===current)setConfig(value)}).catch(()=>{})
  return()=>{epoch.current++}
 },[storyId,actorId])
 const button='min-h-11 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40'
 async function start(){
  if(!config?.policyVersion||!consent||inflight.current||uncertain)return
  inflight.current=true;setBusy(true);onBusyChange?.(true);setError('');const current=epoch.current
  try{
   await transcribeStory(storyId,{requestId:config.retryableRequestId??crypto.randomUUID(),consent:true,policyVersion:config.policyVersion,expectedVersion:revision?.edit_version??0,...(revision?{revisionId:revision.id}:{})})
   if(current===epoch.current){setConsent(false);onSaved()}
  }catch(cause){if(current!==epoch.current)return
   const code=cause instanceof Error?cause.message:''
   setUncertain(true)
   setError(code==='policy_changed'?(zh?'转写条款已改变，请重新加载后确认。':'Transcription policy changed. Reload and review the terms.'):(zh?'尚无法确认转写结果。请重新加载检查，系统不会自动再次发送音频。':'Could not confirm transcription. Reload to check; audio will not be sent again automatically.'))
  }finally{if(current===epoch.current){setBusy(false);inflight.current=false;onBusyChange?.(false)}}
 }
 if(!config)return null
 if((config.pendingRequestId&&!config.retryableRequestId)||uncertain)return <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="status"><p>{zh?'有一个转写请求尚未确定结果。请重新加载检查，暂不重复发送。':'A transcription request is unresolved. Reload to check before sending audio again.'}</p>{error&&<p>{error}</p>}</div>
 if(!config.ready)return <p className="text-sm text-stone-600">{zh?'自动转写暂未启用，可以继续核对已保存的文字。':'Automatic transcription is unavailable. You can review the saved text.'}</p>
 return <section aria-label={zh?'从录音转写':'Transcribe from recording'} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
  {config.retryableRequestId&&<p role="status" className="text-sm text-amber-800">{zh?'上次处理在发送录音前中断。确认同意后可以重试。':'The previous attempt stopped before sending your recording. Confirm consent to retry.'}</p>}
  <p className="text-sm leading-6 text-stone-700">{zh?'把这段已保存的录音发送给 ElevenLabs 生成带定位的转写。新转写需要家人核对。':'Send this saved recording to ElevenLabs for a timed transcript. The new wording still needs family review.'}</p>
  <p className="text-sm leading-6 text-stone-600">{zh?'录音将在美国处理。':'The recording will be processed in the United States.'} <a className="underline underline-offset-2" href="https://elevenlabs.io/privacy-policy" target="_blank" rel="noopener noreferrer">{zh?'查看 ElevenLabs 隐私政策':'Read the ElevenLabs privacy policy'}</a></p>
  <label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5" type="checkbox" checked={consent} disabled={busy||disabled} onChange={e=>setConsent(e.target.checked)}/><span>{zh?'我同意将这段录音发送至 ElevenLabs，在美国处理并转写。':'I agree to send this recording to ElevenLabs for transcription in the United States.'}</span></label>
  <button className={button} disabled={!consent||busy||disabled} onClick={()=>void start()}>{busy?(zh?'正在转写…':'Transcribing…'):config.retryableRequestId?(zh?'重试转写':'Retry transcription'):(zh?'转写已保存的录音':'Transcribe saved audio')}</button>
 </section>
}
