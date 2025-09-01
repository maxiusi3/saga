import { FurbridgeHeader } from "@/components/ui/furbridge-header"
import { FurbridgeSection } from "@/components/ui/furbridge-section"
import { FurbridgeCard } from "@/components/ui/furbridge-card"

const availablePets = [
  {
    id: 1,
    name: "Luna",
    breed: "Golden Retriever Mix",
    age: "2 years",
    description:
      "Luna is a gentle, loving dog who gets along well with children and other pets. She's house-trained and loves long walks.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "Urgent",
    badgeColor: "orange" as const,
  },
  {
    id: 2,
    name: "Whiskers",
    breed: "Domestic Shorthair",
    age: "1 year",
    description:
      "Whiskers is a playful kitten who loves to chase toys and cuddle. Perfect for a family looking for an affectionate companion.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "New",
    badgeColor: "teal" as const,
  },
  {
    id: 3,
    name: "Max",
    breed: "Labrador Mix",
    age: "3 years",
    description:
      "Max is an energetic dog who loves to play fetch and go on adventures. He's great with kids and very loyal.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "Featured",
    badgeColor: "orange" as const,
  },
  {
    id: 4,
    name: "Bella",
    breed: "Persian Cat",
    age: "4 years",
    description:
      "Bella is a calm and elegant cat who enjoys quiet environments. She's perfect for someone looking for a peaceful companion.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "Senior",
    badgeColor: "gray" as const,
  },
  {
    id: 5,
    name: "Rocky",
    breed: "German Shepherd Mix",
    age: "5 years",
    description:
      "Rocky is a protective and intelligent dog who would make an excellent guard dog. He's well-trained and obedient.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "Special Needs",
    badgeColor: "teal" as const,
  },
  {
    id: 6,
    name: "Mittens",
    breed: "Maine Coon",
    age: "2 years",
    description:
      "Mittens is a large, fluffy cat with a gentle personality. She loves to be brushed and enjoys sitting by windows.",
    image: "/placeholder.svg?height=300&width=400",
    badge: "Bonded Pair",
    badgeColor: "orange" as const,
  },
]

export default function AvailablePetsPage() {
  return (
    <main className="min-h-screen">
      <FurbridgeHeader />

      {/* Hero Section */}
      <FurbridgeSection
        title="Available Pets"
        subtitle="Find Your Perfect Match"
        description="These wonderful animals are looking for temporary foster homes while they wait for their forever families. Each pet has been health-checked and is ready to bring joy to your home."
        centered={true}
        background="light"
      />

      {/* Pets Grid */}
      <FurbridgeSection background="white" padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {availablePets.map((pet) => (
            <FurbridgeCard
              key={pet.id}
              title={pet.name}
              description={`${pet.breed} • ${pet.age}`}
              image={pet.image}
              imageAlt={`${pet.name} - ${pet.breed}`}
              buttonText="Foster Me"
              buttonVariant="teal"
              badge={pet.badge}
              badgeColor={pet.badgeColor}
            >
              <p className="text-gray-600 text-sm mb-4">{pet.description}</p>
            </FurbridgeCard>
          ))}
        </div>
      </FurbridgeSection>

      {/* Call to Action */}
      <FurbridgeSection
        title="Don't See Your Perfect Match?"
        description="New pets arrive at our shelter regularly. Sign up for alerts to be notified when pets matching your preferences become available."
        centered={true}
        background="light"
        padding="md"
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-furbridge-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-furbridge-orange-hover transition-colors">
            Set Up Alerts
          </button>
          <button className="border-2 border-furbridge-orange text-furbridge-orange px-6 py-3 rounded-lg font-semibold hover:bg-furbridge-orange hover:text-white transition-colors">
            Contact Us
          </button>
        </div>
      </FurbridgeSection>
    </main>
  )
}
