import { createRoot } from 'react-dom/client'
import { ConnectedProjectHub } from '../../packages/web/src/components/projects/ConnectedProjectHub'

createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1120, margin: '24px auto', padding: 16 }}>
    <ConnectedProjectHub projectId="project-browser" projectName="Synthetic Family Archive"
      userId="user-browser" locale="en" canUpload canRecord canInvite />
  </main>,
)
