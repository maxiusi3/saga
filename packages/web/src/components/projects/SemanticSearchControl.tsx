'use client'
import { useEffect, useState } from 'react'
import { readSemanticReadiness, type SemanticReadiness } from '@/lib/semantic-search-client'
export function SemanticSearchControl({ projectId, busy, hasQuery, onSearch }: {
  projectId: string; busy: boolean; hasQuery: boolean; onSearch: (policyVersion: string) => void
}) {
  const [config, setConfig] = useState<SemanticReadiness | null>(null), [consent, setConsent] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); setConfig(null); setConsent(false)
    void readSemanticReadiness(projectId, controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value) })
      .catch(() => { if (!controller.signal.aborted) setConfig({ ready: false, provider: 'voyage', region: null, policyVersion: null }) })
    return () => controller.abort()
  }, [projectId])
  if (!config) return <p className="text-sm text-stone-600">Checking semantic search availability…</p>
  if (!config.ready || !config.policyVersion) return <p className="text-sm text-stone-600">Semantic search is unavailable. You can search literal words above.</p>
  return <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3" disabled={busy}>
    <legend className="px-1 text-sm font-medium">Search by meaning</legend>
    <p className="text-sm text-stone-600">Find related wording in current family sources. People, year and place filters still require exact words. Similarity does not verify facts.</p>
    <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5" checked={consent} onChange={e => setConsent(e.target.checked)} />
      <span>I agree to send this query and current source text to Voyage in {config.region === 'eu' ? 'the European Union' : 'the United States'} for semantic search. <a href="https://www.voyageai.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Voyage privacy policy</a></span>
    </label>
    <button type="button" className="min-h-11 rounded-md border border-stone-400 px-4 py-2 text-sm font-medium disabled:opacity-40"
      disabled={busy || !consent || !hasQuery} onClick={() => { if (config.policyVersion) { setConsent(false); onSearch(config.policyVersion) } }}>Search by meaning</button>
  </fieldset>
}
