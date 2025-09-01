import { FurbridgeHeader } from "@/components/ui/furbridge-header"
import { FurbridgeButton } from "@/components/ui/furbridge-button"
import { FurbridgeStats } from "@/components/ui/furbridge-stats"
import { FurbridgeCard } from "@/components/ui/furbridge-card"
import { FurbridgeSection } from "@/components/ui/furbridge-section"

export default function PlaygroundPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <FurbridgeHeader />

      <div className="container mx-auto px-6 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-furbridge-warm-gray mb-4">FurBridge Design System</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Complete component library and design tokens for the FurBridge pet fostering platform. All components follow
            DRY principles and maintain consistent branding.
          </p>
        </div>

        {/* Design Tokens Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-furbridge-warm-gray mb-8">Design Tokens</h2>

          {/* Colors */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-furbridge-warm-gray mb-4">Brand Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-full h-16 bg-furbridge-orange rounded mb-2"></div>
                <p className="font-semibold text-sm">FurBridge Orange</p>
                <p className="text-xs text-gray-500">Primary Brand Color</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-full h-16 bg-furbridge-teal rounded mb-2"></div>
                <p className="font-semibold text-sm">FurBridge Teal</p>
                <p className="text-xs text-gray-500">Secondary Brand Color</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-full h-16 bg-furbridge-warm-gray rounded mb-2"></div>
                <p className="font-semibold text-sm">Warm Gray</p>
                <p className="text-xs text-gray-500">Text Color</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-full h-16 bg-furbridge-light-gray rounded mb-2"></div>
                <p className="font-semibold text-sm">Light Gray</p>
                <p className="text-xs text-gray-500">Background Color</p>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-furbridge-warm-gray mb-4">Typography</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="space-y-4">
                <div>
                  <h1 className="text-4xl font-bold text-furbridge-warm-gray">Heading 1 - Hero Title</h1>
                  <p className="text-sm text-gray-500">4xl, font-bold</p>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-furbridge-warm-gray">Heading 2 - Section Title</h2>
                  <p className="text-sm text-gray-500">3xl, font-bold</p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-furbridge-warm-gray">Heading 3 - Card Title</h3>
                  <p className="text-sm text-gray-500">xl, font-semibold</p>
                </div>
                <div>
                  <p className="text-base text-gray-600">Body Text - Regular paragraph content</p>
                  <p className="text-sm text-gray-500">base, normal weight</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Caption Text - Small descriptive text</p>
                  <p className="text-xs text-gray-400">sm, normal weight</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Components Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-furbridge-warm-gray mb-8">Components</h2>

          {/* FurbridgeButton */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeButton</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="space-y-6">
                {/* Variants */}
                <div>
                  <h4 className="font-semibold mb-3">Variants</h4>
                  <div className="flex flex-wrap gap-4">
                    <FurbridgeButton variant="orange">Orange Button</FurbridgeButton>
                    <FurbridgeButton variant="teal">Teal Button</FurbridgeButton>
                    <FurbridgeButton variant="outline">Outline Button</FurbridgeButton>
                    <FurbridgeButton variant="ghost">Ghost Button</FurbridgeButton>
                  </div>
                </div>

                {/* Sizes */}
                <div>
                  <h4 className="font-semibold mb-3">Sizes</h4>
                  <div className="flex flex-wrap items-center gap-4">
                    <FurbridgeButton size="sm">Small</FurbridgeButton>
                    <FurbridgeButton size="default">Default</FurbridgeButton>
                    <FurbridgeButton size="lg">Large</FurbridgeButton>
                    <FurbridgeButton size="icon">🐾</FurbridgeButton>
                  </div>
                </div>

                {/* States */}
                <div>
                  <h4 className="font-semibold mb-3">States</h4>
                  <div className="flex flex-wrap gap-4">
                    <FurbridgeButton>Normal</FurbridgeButton>
                    <FurbridgeButton disabled>Disabled</FurbridgeButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FurbridgeCard */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeCard</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FurbridgeCard
                  title="Basic Card"
                  description="A simple card with title and description"
                  buttonText="Action"
                  buttonVariant="orange"
                />
                <FurbridgeCard
                  title="Card with Image"
                  description="Card featuring an image and badge"
                  image="/placeholder.svg?height=200&width=300"
                  imageAlt="Sample image"
                  badge="Featured"
                  badgeColor="orange"
                  buttonText="Learn More"
                  buttonVariant="teal"
                />
                <FurbridgeCard
                  title="Custom Content"
                  description="Card with custom children content"
                  badge="New"
                  badgeColor="teal"
                >
                  <div className="p-4 bg-furbridge-light-gray rounded-lg mb-4">
                    <p className="text-sm text-gray-600">
                      Custom content area for additional information or components.
                    </p>
                  </div>
                </FurbridgeCard>
              </div>
            </div>
          </div>

          {/* FurbridgeSection */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeSection</h3>
            <div className="space-y-6">
              <FurbridgeSection
                title="Section with White Background"
                subtitle="Section Subtitle"
                description="This is a section component with white background and centered content."
                centered={true}
                background="white"
                padding="md"
              >
                <div className="text-center">
                  <p className="text-gray-600">Section content goes here</p>
                </div>
              </FurbridgeSection>

              <FurbridgeSection
                title="Section with Light Background"
                description="This section has a light gray background and left-aligned content."
                background="light"
                padding="lg"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg">Content Block 1</div>
                  <div className="p-4 bg-white rounded-lg">Content Block 2</div>
                  <div className="p-4 bg-white rounded-lg">Content Block 3</div>
                </div>
              </FurbridgeSection>
            </div>
          </div>

          {/* FurbridgeStats */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeStats</h3>
            <FurbridgeStats
              title="Sample Statistics"
              description="Showcase important metrics and achievements"
              stats={[
                { icon: "🐾", value: 1234, label: "pets helped", color: "orange" },
                { icon: "🏠", value: 567, label: "homes found", color: "teal" },
                { icon: "❤️", value: 89, label: "volunteers", color: "gray" },
                { icon: "⭐", value: 95, label: "success rate", color: "orange" },
              ]}
            />
          </div>

          {/* FurbridgeHero */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeHero</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-gray-600 mb-4">
                Hero component preview (scaled down for playground). Full component includes:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>• Background image with overlay</li>
                <li>• Large hero title with brand color highlights</li>
                <li>• Subtitle and description text</li>
                <li>• Primary call-to-action button</li>
                <li>• Optional statistics display</li>
              </ul>
              <div className="relative h-64 bg-gradient-to-r from-furbridge-orange/20 to-furbridge-teal/20 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-furbridge-warm-gray mb-2">Hero Component Preview</h2>
                  <p className="text-gray-600 mb-4">Scaled down for playground display</p>
                  <FurbridgeButton variant="teal">Sample CTA Button</FurbridgeButton>
                </div>
              </div>
            </div>
          </div>

          {/* FurbridgeHeader */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-furbridge-warm-gray mb-6">FurbridgeHeader</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <p className="text-gray-600 mb-4">
                Header component is displayed at the top of this page. Features include:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• FurBridge logo/brand name</li>
                <li>• Navigation menu with hover effects</li>
                <li>• Foster Now call-to-action button</li>
                <li>• Responsive design with mobile considerations</li>
                <li>• Sticky positioning with backdrop blur</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-furbridge-warm-gray mb-8">Usage Guidelines</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-furbridge-warm-gray mb-4">Design Principles</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>
                    • <strong>Consistency:</strong> Use design tokens for colors, spacing, and typography
                  </li>
                  <li>
                    • <strong>Accessibility:</strong> All components include proper ARIA attributes
                  </li>
                  <li>
                    • <strong>Responsiveness:</strong> Mobile-first design approach
                  </li>
                  <li>
                    • <strong>Brand Alignment:</strong> Orange and teal color scheme throughout
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-furbridge-warm-gray mb-4">Component Structure</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>
                    • <strong>Modular:</strong> Each component in separate folder under /components/ui/
                  </li>
                  <li>
                    • <strong>TypeScript:</strong> Full type safety with proper interfaces
                  </li>
                  <li>
                    • <strong>Composable:</strong> Components can be combined and customized
                  </li>
                  <li>
                    • <strong>DRY Principle:</strong> No duplicate styles or functionality
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Component List */}
        <section>
          <h2 className="text-3xl font-bold text-furbridge-warm-gray mb-8">Complete Component List</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeButton</h4>
                <p className="text-sm text-gray-600">Brand-styled buttons with multiple variants and sizes</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeHeader</h4>
                <p className="text-sm text-gray-600">Site navigation with logo and CTA button</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeHero</h4>
                <p className="text-sm text-gray-600">Full-screen hero section with background image</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeStats</h4>
                <p className="text-sm text-gray-600">Statistics display with icons and metrics</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeCard</h4>
                <p className="text-sm text-gray-600">Flexible card component with image and content</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-furbridge-orange mb-2">FurbridgeSection</h4>
                <p className="text-sm text-gray-600">Page section wrapper with consistent spacing</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
