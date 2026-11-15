import React from 'react'
import {createRoot} from 'react-dom/client'
import {ConnectedProjectHub} from '../../packages/web/src/components/projects/ConnectedProjectHub'
const config=(window as any).semanticConfig
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-5xl p-5"><ConnectedProjectHub projectId={config.project} projectName="Semantic family sources" userId={config.owner} locale="en" canUpload={false} canRecord={false} canInvite={false}/></main>)
