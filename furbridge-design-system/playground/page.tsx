import { Navigation } from "@/components/ui/navigation"
import { HeroSection } from "@/components/ui/hero-section"
import { BrandButton } from "@/components/ui/brand-button"
import { StatCard } from "@/components/ui/stat-card"
import { Logo } from "@/components/ui/logo"
import { SectionContainer } from "@/components/ui/section-container"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Users, Home, ArrowRight, PawPrint, Shield, Star } from "lucide-react"

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Design System Showcase */}
      <Navigation
        logo={<Logo size="md" />}
        items={[
          { label: "Components", href: "#components", active: true },
          { label: "Colors", href: "#colors" },
          { label: "Typography", href: "#typography" },
          { label: "Spacing", href: "#spacing" },
        ]}
        actions={
          <BrandButton variant="secondary" size="sm">
            View Docs
          </BrandButton>
        }
      />

      <SectionContainer className="space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-hero text-brown">FurBridge Design System</h1>
          <p className="text-subtitle">A comprehensive design system built for pet adoption platforms</p>
        </div>

        {/* Logo Variants */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Logo Variants</h2>
          <Card className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="text-center space-y-2">
                <Logo variant="text" size="sm" />
                <p className="text-sm text-muted-foreground">Small Text</p>
              </div>
              <div className="text-center space-y-2">
                <Logo variant="text" size="md" />
                <p className="text-sm text-muted-foreground">Medium Text</p>
              </div>
              <div className="text-center space-y-2">
                <Logo variant="text" size="lg" />
                <p className="text-sm text-muted-foreground">Large Text</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Brand Buttons */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Brand Buttons</h2>
          <Card className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <BrandButton variant="primary" icon={<ArrowRight size={16} />}>
                Become a Foster
              </BrandButton>
              <BrandButton variant="secondary" icon={<Heart size={16} />}>
                Foster Now
              </BrandButton>
              <BrandButton variant="outline" icon={<PawPrint size={16} />}>
                Available Pets
              </BrandButton>
              <BrandButton variant="ghost" icon={<Users size={16} />}>
                Success Stories
              </BrandButton>
            </div>
          </Card>
        </div>

        {/* Stat Cards */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Stat Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              number="2,847"
              label="pets fostered"
              icon={<PawPrint size={24} />}
              description="Successfully placed in loving homes"
              trend={{ value: "+12%", direction: "up" }}
            />
            <StatCard
              number="1,923"
              label="forever homes"
              icon={<Home size={24} />}
              description="Permanent adoptions completed"
              trend={{ value: "+8%", direction: "up" }}
            />
            <StatCard
              number="4.9"
              label="rating"
              icon={<Star size={24} />}
              description="Average foster family rating"
            />
          </div>
        </div>

        {/* Hero Section Demo */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Hero Section</h2>
          <Card className="overflow-hidden">
            <HeroSection
              title={
                <>
                  Be the bridge between <span className="text-primary">shelter</span> and{" "}
                  <span className="text-primary">forever</span>.
                </>
              }
              subtitle="Open your home. Save a life."
              backgroundImage="/placeholder.svg?height=600&width=1200"
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
          </Card>
        </div>

        {/* Color Palette */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Color Palette</h2>
          <Card className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="w-full h-16 bg-primary rounded-lg"></div>
                <p className="text-sm font-medium">Primary</p>
                <p className="text-xs text-muted-foreground">Teal/Green</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-secondary rounded-lg"></div>
                <p className="text-sm font-medium">Secondary</p>
                <p className="text-xs text-muted-foreground">Orange</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-brown rounded-lg"></div>
                <p className="text-sm font-medium">Brown</p>
                <p className="text-xs text-muted-foreground">Text accent</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-muted rounded-lg border"></div>
                <p className="text-sm font-medium">Muted</p>
                <p className="text-xs text-muted-foreground">Background</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Typography Scale */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Typography</h2>
          <Card className="p-8 space-y-6">
            <div className="text-hero text-brown">Hero Title</div>
            <div className="text-subtitle">Subtitle text for descriptions</div>
            <div className="text-stat-number text-primary">2,847</div>
            <div className="text-stat-label">Stat label text</div>
            <div className="text-base">Regular body text for content</div>
            <div className="text-sm text-muted-foreground">Small muted text</div>
          </Card>
        </div>

        {/* Standard UI Components */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Standard Components</h2>
          <Card className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Buttons</h3>
                <div className="space-y-2">
                  <Button className="w-full">Default Button</Button>
                  <Button variant="outline" className="w-full bg-transparent">
                    Outline Button
                  </Button>
                  <Button variant="ghost" className="w-full">
                    Ghost Button
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Badges</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Cards</h3>
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Card Title</h4>
                  <p className="text-sm text-muted-foreground">This is a sample card component with some content.</p>
                </Card>
              </div>
            </div>
          </Card>
        </div>

        {/* Usage Guidelines */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-brown">Usage Guidelines</h2>
          <Card className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-primary">Do's</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Shield className="text-green-600 mt-0.5" size={16} />
                    Use consistent spacing with the design tokens
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-green-600 mt-0.5" size={16} />
                    Follow the color palette for brand consistency
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-green-600 mt-0.5" size={16} />
                    Use BrandButton for primary actions
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-green-600 mt-0.5" size={16} />
                    Maintain proper contrast ratios
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-destructive">Don'ts</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Shield className="text-red-600 mt-0.5" size={16} />
                    Don't use colors outside the defined palette
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-red-600 mt-0.5" size={16} />
                    Don't modify component styles arbitrarily
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-red-600 mt-0.5" size={16} />
                    Don't use inconsistent spacing values
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="text-red-600 mt-0.5" size={16} />
                    Don't mix different button styles in the same context
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </SectionContainer>
    </div>
  )
}
