import { FurbridgeHeader } from "@/components/ui/furbridge-header"
import { FurbridgeHero } from "@/components/ui/furbridge-hero"

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <FurbridgeHeader />
      <FurbridgeHero
        title="Be the bridge between shelter and forever."
        description="Open your home. Save a life."
        primaryButtonText="Become a Foster"
        backgroundImage="/placeholder.svg?height=1080&width=1920"
        showStats={true}
        stats={{
          petsCount: 2847,
          homesCount: 1923,
        }}
      />
    </main>
  )
}
