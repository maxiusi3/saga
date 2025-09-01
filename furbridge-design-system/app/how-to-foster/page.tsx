import { FurbridgeHeader } from "@/components/ui/furbridge-header"
import { FurbridgeSection } from "@/components/ui/furbridge-section"
import { FurbridgeCard } from "@/components/ui/furbridge-card"

const fosterSteps = [
  {
    step: "1",
    title: "Application",
    description:
      "Fill out our comprehensive foster application form. We'll review your living situation, experience, and preferences.",
    icon: "📝",
  },
  {
    step: "2",
    title: "Home Visit",
    description:
      "Our team will schedule a friendly home visit to ensure your space is safe and suitable for fostering pets.",
    icon: "🏠",
  },
  {
    step: "3",
    title: "Training",
    description:
      "Attend our foster orientation session where you'll learn about pet care, emergency procedures, and available resources.",
    icon: "🎓",
  },
  {
    step: "4",
    title: "Matching",
    description:
      "We'll match you with a pet that fits your lifestyle, experience level, and preferences for the best outcome.",
    icon: "❤️",
  },
  {
    step: "5",
    title: "Foster Care",
    description:
      "Welcome your foster pet home! We provide ongoing support, supplies, and veterinary care throughout the process.",
    icon: "🐾",
  },
  {
    step: "6",
    title: "Adoption",
    description:
      "Help your foster pet find their forever home. You can even adopt them yourself if it's the perfect match!",
    icon: "🎉",
  },
]

const requirements = [
  {
    title: "Age Requirement",
    description: "Must be 21 years or older",
    icon: "👤",
  },
  {
    title: "Stable Housing",
    description: "Own or rent with pet permission",
    icon: "🏡",
  },
  {
    title: "Time Commitment",
    description: "Available for 2-8 weeks typically",
    icon: "⏰",
  },
  {
    title: "Financial Stability",
    description: "Able to provide basic care (we cover medical)",
    icon: "💰",
  },
]

export default function HowToFosterPage() {
  return (
    <main className="min-h-screen">
      <FurbridgeHeader />

      {/* Hero Section */}
      <FurbridgeSection
        title="How to Foster"
        subtitle="Your Journey to Saving Lives"
        description="Fostering is one of the most rewarding ways to help animals in need. Here's everything you need to know about becoming a foster family."
        centered={true}
        background="light"
      />

      {/* Foster Process */}
      <FurbridgeSection
        title="The Foster Process"
        description="Our streamlined process makes it easy to start fostering and saving lives."
        background="white"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {fosterSteps.map((step) => (
            <FurbridgeCard
              key={step.step}
              title={step.title}
              description={step.description}
              badge={`Step ${step.step}`}
              badgeColor="teal"
            >
              <div className="text-4xl mb-4">{step.icon}</div>
            </FurbridgeCard>
          ))}
        </div>
      </FurbridgeSection>

      {/* Requirements */}
      <FurbridgeSection
        title="Foster Requirements"
        description="We want to ensure the best outcomes for both our pets and foster families."
        background="light"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {requirements.map((req, index) => (
            <div key={index} className="text-center p-6 bg-white rounded-xl shadow-sm">
              <div className="text-3xl mb-3">{req.icon}</div>
              <h3 className="font-bold text-furbridge-warm-gray mb-2">{req.title}</h3>
              <p className="text-gray-600 text-sm">{req.description}</p>
            </div>
          ))}
        </div>
      </FurbridgeSection>

      {/* FAQ Section */}
      <FurbridgeSection title="Frequently Asked Questions" background="white">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 bg-furbridge-light-gray rounded-xl">
            <h3 className="font-bold text-furbridge-warm-gray mb-2">What does FurBridge provide?</h3>
            <p className="text-gray-600">
              We provide all medical care, food, supplies, and 24/7 support. You provide love, care, and a safe
              temporary home.
            </p>
          </div>
          <div className="p-6 bg-furbridge-light-gray rounded-xl">
            <h3 className="font-bold text-furbridge-warm-gray mb-2">How long do pets stay in foster care?</h3>
            <p className="text-gray-600">
              Typically 2-8 weeks, depending on the pet's needs and adoption timeline. Some special cases may require
              longer care.
            </p>
          </div>
          <div className="p-6 bg-furbridge-light-gray rounded-xl">
            <h3 className="font-bold text-furbridge-warm-gray mb-2">Can I choose which pet to foster?</h3>
            <p className="text-gray-600">
              Yes! We work with you to find a pet that matches your lifestyle, experience, and preferences.
            </p>
          </div>
        </div>
      </FurbridgeSection>

      {/* Call to Action */}
      <FurbridgeSection
        title="Ready to Start Fostering?"
        description="Join our community of foster heroes and start saving lives today."
        centered={true}
        background="light"
        padding="md"
      >
        <button className="bg-furbridge-teal text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-furbridge-teal-hover transition-colors">
          Apply to Foster Now
        </button>
      </FurbridgeSection>
    </main>
  )
}
