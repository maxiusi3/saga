import React from 'react'
import {createRoot} from 'react-dom/client'
import {StoryReviewPanel} from '../../packages/web/src/components/stories/StoryReviewPanel'
const config=(window as any).g2Config
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-4xl p-4 sm:p-8"><h1 className="mb-6 text-2xl font-semibold">The family garden</h1><StoryReviewPanel storyId={config.story} actorId={config.owner} locale={config.locale}/></main>)
