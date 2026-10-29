import ProjectDetailClient from './ProjectDetailClient'

export const dynamic = 'force-dynamic'

export default function ProjectDetailPage() {
  return <ProjectDetailClient mediaAssetsEnabled={process.env.MEDIA_ASSETS_ENABLED === 'true'} />
}
