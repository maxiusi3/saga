'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReviewAction, ReviewRequest, ReviewState } from '@/lib/story-review-contract'
import { readStoryReview, writeStoryReview } from '@/lib/story-review-client'
import { reviewCopy } from './story-review-copy'
import { StoryTranscriptionControl } from './StoryTranscriptionControl'
import { StoryAiEditControl } from './StoryAiEditControl'

const button = 'min-h-11 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
const primary = `${button} border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900`
const field = 'min-h-28 w-full rounded-md border border-stone-300 p-3 text-base leading-relaxed focus-visible:outline-emerald-700'
function clock(ms:number) { const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}` }

export function StoryReviewPanel({storyId,actorId,locale='en'}:{storyId:string;actorId:string;locale?:string}) {
  const copy=locale.startsWith('zh')?reviewCopy.zh:reviewCopy.en
  const editorId=useId(),transcriptId=useId()
  const [state,setState]=useState<ReviewState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
  const [transcribing,setTranscribing]=useState(false),[aiEditing,setAiEditing]=useState(false)
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState<ReviewRequest|null>(null),[needsReload,setNeedsReload]=useState(false)
  const [editor,setEditor]=useState<{id:string;action:'modify'|'dispute'}|null>(null),[text,setText]=useState(''),[correcting,setCorrecting]=useState(false)
  const epoch=useRef(0),inflight=useRef(false),audio=useRef<HTMLAudioElement|null>(null),stopAt=useRef<number|null>(null)
  const identity=useRef({storyId,actorId})
  if(identity.current.storyId!==storyId||identity.current.actorId!==actorId){identity.current={storyId,actorId};epoch.current++}
  const load=useCallback(async()=>{
    const current=++epoch.current
    audio.current?.pause();stopAt.current=null
    setLoading(true);setError('');setState(null);setRetry(null);setNeedsReload(false);setEditor(null);setCorrecting(false);setMessage('');inflight.current=false;setBusy(false);setTranscribing(false);setAiEditing(false)
    try {const result=await readStoryReview(storyId);if(epoch.current===current)setState(result)}
    catch {if(epoch.current===current)setError(copy.unavailable)}
    finally{if(epoch.current===current)setLoading(false)}
  },[storyId,actorId,copy.unavailable])
  useEffect(()=>{void load();return()=>{epoch.current++;audio.current?.pause()}},[load])
  async function send(request:ReviewRequest) {
    if(inflight.current)return
    inflight.current=true;setBusy(true);setError('');setMessage('')
    const current=epoch.current
    try {
      const next=await writeStoryReview(storyId,request)
      if(epoch.current!==current)return
      setState(next);setRetry(null);setNeedsReload(false);setEditor(null);setCorrecting(false);setMessage(copy.saved)
    } catch(cause) {
      if(epoch.current!==current)return
      const status=typeof cause==='object'&&cause!==null&&'status' in cause?Number(cause.status):0
      if(status>=400&&status<500){setNeedsReload(true);setRetry(null);setError(copy.conflict)}
      else{setRetry(request);setError(copy.unknown)}
    } finally {if(epoch.current===current){inflight.current=false;setBusy(false)}}
  }
  const revision=state?.revision,locked=busy||transcribing||aiEditing||!!retry||needsReload,editable=revision?.status==='draft'&&!state?.sourceChanged&&!locked
  function mutate(operation:ReviewRequest['operation'],extra:Partial<ReviewRequest>={}) {
    if(inflight.current||locked)return
    void send({operation,requestId:crypto.randomUUID(),...(revision?{revisionId:revision.id,expectedVersion:revision.edit_version}:{}),...extra})
  }
  function decide(id:string,action:ReviewAction){mutate('decide_assertion',{assertionId:id,action})}
  async function seek(startMs:number,endMs:number|null) {
    if(!audio.current)return
    const current=epoch.current,element=audio.current
    try {
      if(element.readyState<1)await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>finish(new Error('metadata timeout')),10000)
        function finish(error?:Error){clearTimeout(timer);element.removeEventListener('loadedmetadata',ready);element.removeEventListener('error',failed);error?reject(error):resolve()}
        function ready(){finish()}function failed(){finish(new Error('audio unavailable'))}
        element.addEventListener('loadedmetadata',ready,{once:true});element.addEventListener('error',failed,{once:true});element.load()
      })
      if(epoch.current!==current)return
      if(!Number.isFinite(element.duration)||startMs/1000>=element.duration)throw new Error('audio bounds')
      element.currentTime=startMs/1000;stopAt.current=endMs===null?null:endMs/1000;await element.play()
    }catch{if(epoch.current===current)setError(copy.audioError)}
  }
  const assertions=state?.assertions??[]
  const ready=!!editable&&!!state?.canApprove&&assertions.length>0&&assertions.some(a=>a.review_decision!=='reject')&&assertions.every(a=>['accept','modify','dispute','reject'].includes(a.review_decision??''))
  return <section aria-label={copy.heading} className="space-y-5 rounded-xl border border-stone-200 bg-stone-50/60 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-stone-950">{copy.heading}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{copy.intro}</p></div><button className={button} disabled={busy||transcribing||aiEditing||loading} onClick={()=>void load()}>{copy.refresh}</button></div>
    {loading&&<p role="status">{copy.loading}</p>}
    {error&&<div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{error}{retry&&<button className={`${button} ml-3`} disabled={busy} onClick={()=>void send(retry)}>{copy.retry}</button>}</div>}
    {message&&<p role="status" className="text-sm text-emerald-900">{message}</p>}
    {!loading&&state&&<>
      <StoryTranscriptionControl storyId={storyId} actorId={actorId} locale={locale} revision={revision} disabled={busy||aiEditing||!!retry||needsReload||state.sourceChanged} onBusyChange={setTranscribing} onSaved={()=>void load()} />
      <StoryAiEditControl storyId={storyId} actorId={actorId} locale={locale} revision={revision} disabled={busy||transcribing||!!retry||needsReload||state.sourceChanged} onBusyChange={setAiEditing} onSaved={()=>void load()} />
      {!revision&&<div className="space-y-3"><p className="text-stone-700">{copy.empty}</p><button className={primary} disabled={locked} onClick={()=>mutate('prepare')}>{copy.prepare}</button></div>}
      {state.sourceChanged&&<div role="alert" className="space-y-3 rounded-md bg-amber-50 p-3"><p>{copy.changed}</p><button className={button} disabled={locked} onClick={()=>mutate('prepare')}>{copy.prepare}</button></div>}
      {state.transcript&&<div className="space-y-3"><p className="text-sm font-medium text-stone-700">{state.transcript.alignment_status==='legacy_unaligned'?copy.imported:state.transcript.alignment_status==='human_corrected'?copy.corrected:copy.aligned}</p>
        {state.transcript.asset_id&&<audio aria-label={copy.listen} ref={audio} controls preload="metadata" src={`/api/media/assets/${state.transcript.asset_id}/play`} className="w-full" onTimeUpdate={()=>{if(audio.current&&stopAt.current!==null&&audio.current.currentTime>=stopAt.current){audio.current.pause();stopAt.current=null}}} onError={()=>setError(copy.audioError)} />}
      </div>}
      {revision&&<>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-600">{copy.version} {revision.revision_number} · {revision.status==='approved'?copy.approved:copy.preview}</p><button className={button} disabled={locked||state.sourceChanged} onClick={()=>{setCorrecting(true);setEditor(null);setText(state.transcript?.segments.map(s=>s.text).join('\n\n')??'')}}>{copy.correctTranscript}</button></div>
        {correcting&&<form onSubmit={e=>{e.preventDefault();mutate('correct_transcript',{text})}} className="space-y-3 rounded-md border border-stone-200 bg-white p-4"><div className="space-y-2"><label htmlFor={transcriptId} className="block font-medium">{copy.transcript}</label><textarea id={transcriptId} className={field} value={text} maxLength={100000} disabled={locked} onChange={e=>setText(e.target.value)} /></div><p className="text-sm text-stone-600">{copy.transcriptNote}</p><div className="flex flex-wrap gap-2"><button className={primary} disabled={locked||!text.trim()} type="submit">{copy.saveTranscript}</button><button className={button} disabled={busy} type="button" onClick={()=>setCorrecting(false)}>{copy.cancel}</button></div></form>}
        <ol className="space-y-4">{assertions.map((a,index)=><li key={a.id} className={`space-y-3 rounded-lg border border-stone-200 bg-white p-4 ${a.review_decision==='reject'?'opacity-65':''}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-600"><span>{index+1}</span><span className="rounded bg-stone-100 px-2 py-1">{a.memory_attribution==='family_supplement'?copy.supplement:a.alternatives.length?copy.disputed:a.ai_review?(locale.startsWith('zh')?'AI 改写':'AI edited'):copy.quoted}</span>{a.review_decision&&<span>{copy.decisions[a.review_decision]}</span>}</div>
          <p className={`whitespace-pre-wrap text-base leading-7 text-stone-900 ${a.review_decision==='reject'?'line-through':''}`}>{a.claim_text}</p>
          {a.ai_review&&revision.status==='draft'&&<p className="text-sm text-stone-600">{locale.startsWith('zh')?'AI 整理 · 独立模型已核对，仍需家人确认':'AI edited · independently checked; family confirmation required'}</p>}
          {a.ai_review?.risks?.map((risk,i)=><p key={i} className="text-sm text-amber-900">{risk}</p>)}
          {a.source_quote&&a.source_quote!==a.claim_text&&<blockquote className="border-l-2 border-stone-300 pl-3 text-sm leading-6 text-stone-600"><span className="font-medium">{copy.original}: </span>{a.source_quote}</blockquote>}
          {a.alternatives.map((alt,i)=><blockquote key={`${alt.actor_id}-${i}`} className="rounded bg-amber-50 p-3 text-sm leading-6"><p>{alt.text}</p><footer className="mt-1 text-xs text-stone-600">{copy.alternative} · {alt.actor_id} · {alt.created_at}</footer></blockquote>)}
          {typeof a.start_ms==='number'&&Number.isFinite(a.start_ms)&&state.transcript?.asset_id&&<button className={button} disabled={busy} onClick={()=>void seek(a.start_ms!,a.end_ms)}>{copy.listen} {clock(a.start_ms)}{a.end_ms!==null?`–${clock(a.end_ms)}`:''}</button>}
          {revision.status==='draft'&&<div className="flex flex-wrap gap-2"><button className={button} disabled={!editable} onClick={()=>decide(a.id,'accept')}>{copy.accept}</button><button className={button} disabled={!editable} onClick={()=>{setEditor({id:a.id,action:'modify'});setCorrecting(false);setText(a.claim_text)}}>{copy.modify}</button><button className={button} disabled={!editable} onClick={()=>{setEditor({id:a.id,action:'dispute'});setCorrecting(false);setText('')}}>{copy.dispute}</button><button className={button} disabled={!editable} onClick={()=>decide(a.id,'skip')}>{copy.skip}</button><button className={button} disabled={!editable} onClick={()=>decide(a.id,'reject')}>{copy.reject}</button></div>}
          {editor?.id===a.id&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();mutate('decide_assertion',{assertionId:a.id,action:editor.action,text})}}><div className="space-y-2"><label htmlFor={editorId} className="block text-sm font-medium">{editor.action==='modify'?copy.correction:copy.alternative}</label><textarea id={editorId} autoFocus className={field} value={text} maxLength={100000} disabled={locked} onChange={e=>setText(e.target.value)}/></div><div className="flex flex-wrap gap-2"><button className={primary} disabled={locked||!text.trim()} type="submit">{editor.action==='modify'?copy.saveCorrection:copy.saveAlternative}</button><button className={button} disabled={busy} type="button" onClick={()=>setEditor(null)}>{copy.cancel}</button></div></form>}
        </li>)}</ol>
        <div className="rounded-lg border border-stone-200 bg-white p-4"><h3 className="mb-3 font-semibold">{copy.preview}</h3><div className="whitespace-pre-wrap text-base leading-7">{revision.body}</div></div>
        {revision.status==='draft'&&<div className="space-y-3 border-t border-stone-200 pt-4"><p className="text-sm text-stone-600">{copy.approvalNote}</p><button className={primary} disabled={!ready} onClick={()=>mutate('approve_revision')}>{busy?copy.preparing:copy.approve}</button></div>}
      </>}
      {state.approvedRevisions.length>0&&<details className="rounded-md border border-stone-200 bg-white p-4"><summary className="cursor-pointer font-semibold">{copy.history} ({state.approvedRevisions.length})</summary>{state.approvedRevisions.map(r=><article key={r.id} className="mt-4 space-y-2 border-t border-stone-100 pt-4"><h3>{copy.version} {r.revision_number} · {r.approved_at}</h3><p className="whitespace-pre-wrap leading-7">{r.body}</p></article>)}</details>}
    </>}
  </section>
}
