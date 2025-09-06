import { Navigation } from "@/components/ui/navigation"
import { HeroSection } from "@/components/ui/hero-section"
import { BrandButton } from "@/components/ui/brand-button"
import { Logo } from "@/components/ui/logo"
import { SectionContainer } from "@/components/ui/section-container"
import { ArrowRight, PawPrint, Home } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation
        logo={<Logo size="md" />}
        items={[
          { label: "Home", href: "/", active: true },
          { label: "Available Pets", href: "/pets" },
          { label: "How to Foster", href: "/foster" },
          { label: "Success Stories", href: "/stories" },
        ]}
        actions={
          <BrandButton variant="secondary" size="sm" icon={<ArrowRight size={16} />}>
            Foster Now
          </BrandButton>
        }
      />

      <HeroSection
        title={
          <>
            Be the bridge between <span className="text-primary">shelter</span> and{" "}
            <span className="text-primary">forever</span>.
          </>
        }
        subtitle="Open your home. Save a life."
        backgroundImage="/placeholder.svg?height=800&width=1200"
        actions={
          <>
            <BrandButton variant="primary" size="lg" icon={<ArrowRight size={20} />}>
              Become a Foster
            </BrandButton>
            <BrandButton variant="outline" size="lg">
              How to Foster
            </BrandButton>
          </>
        }
        stats={[
          {
            number: "2,847",
            label: "pets fostered",
            icon: <PawPrint size={20} />,
          },
          {
            number: "1,923",
            label: "forever homes",
            icon: <Home size={20} />,
          },
        ]}
      />

      <SectionContainer>
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            Visit{" "}
            <a href="/playground" className="text-primary hover:underline font-medium">
              /playground
            </a>{" "}
            to explore all design system components
          </p>
        </div>
      </SectionContainer>
    </div>
  )
}
