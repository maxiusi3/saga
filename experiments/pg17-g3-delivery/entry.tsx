import React from 'react'
import {createRoot} from 'react-dom/client'
import {StoryReviewPanel} from '../../packages/web/src/components/stories/StoryReviewPanel'
import {ConnectedProjectHub} from '../../packages/web/src/components/projects/ConnectedProjectHub'
const config=(window as any).g3Config
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8"><h1 className="text-2xl font-semibold">{config.projectName}</h1><StoryReviewPanel storyId={config.story} actorId={config.owner} locale="en"/><ConnectedProjectHub projectId={config.project} projectName={config.projectName} userId={config.owner} locale="en" canUpload={false} canRecord={false} canInvite={false}/></main>)
