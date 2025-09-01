import { FurbridgeHeader } from "@/components/ui/furbridge-header"
import { FurbridgeSection } from "@/components/ui/furbridge-section"
import { FurbridgeCard } from "@/components/ui/furbridge-card"

const successStories = [
  {
    id: 1,
    petName: "Charlie",
    fosterFamily: "The Johnson Family",
    story:
      "Charlie came to us as a scared, malnourished puppy. After 6 weeks with the Johnson family, he transformed into a confident, playful dog. The Johnsons couldn't bear to let him go and officially adopted him!",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Foster to Adoption",
    duration: "6 weeks",
  },
  {
    id: 2,
    petName: "Snowball",
    fosterFamily: "Maria Rodriguez",
    story:
      "Snowball was a senior cat who needed extra medical care. Maria provided the perfect quiet home for her recovery. After 3 months, Snowball found her forever home with an elderly couple who adores her.",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Successful Adoption",
    duration: "3 months",
  },
  {
    id: 3,
    petName: "Buddy & Rex",
    fosterFamily: "The Chen Family",
    story:
      "This bonded pair of brothers needed a foster home together. The Chen family opened their hearts and home to both dogs. After helping them recover from surgery, they found a wonderful family who adopted both!",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Bonded Pair Adoption",
    duration: "8 weeks",
  },
  {
    id: 4,
    petName: "Luna",
    fosterFamily: "Sarah & Mike Thompson",
    story:
      "Luna was a pregnant cat who needed a safe place to have her babies. The Thompsons provided excellent care during birth and helped socialize the kittens. All babies and Luna found loving homes!",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Mother + 5 Kittens Adopted",
    duration: "12 weeks",
  },
  {
    id: 5,
    petName: "Rocky",
    fosterFamily: "David Park",
    story:
      "Rocky was a reactive dog who needed specialized training and patience. David, an experienced foster, worked with him for months. Rocky is now a therapy dog bringing joy to hospital patients!",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Therapy Dog Certification",
    duration: "6 months",
  },
  {
    id: 6,
    petName: "Mittens",
    fosterFamily: "The Williams Family",
    story:
      "Mittens was found with a broken leg and needed surgery. The Williams family nursed her back to health with daily physical therapy. She's now living her best life with a family who has other cats!",
    image: "/placeholder.svg?height=300&width=400",
    outcome: "Medical Recovery Success",
    duration: "10 weeks",
  },
]

const impactStats = [
  {
    number: "2,847",
    label: "Pets Fostered",
    description: "Lives saved through foster care",
    icon: "🐾",
  },
  {
    number: "1,923",
    label: "Forever Homes",
    description: "Successful adoptions facilitated",
    icon: "🏠",
  },
  {
    number: "456",
    label: "Foster Families",
    description: "Dedicated volunteers in our network",
    icon: "👨‍👩‍👧‍👦",
  },
  {
    number: "98%",
    label: "Success Rate",
    description: "Pets finding permanent homes",
    icon: "⭐",
  },
]

export default function SuccessStoriesPage() {
  return (
    <main className="min-h-screen">
      <FurbridgeHeader />

      {/* Hero Section */}
      <FurbridgeSection
        title="Success Stories"
        subtitle="Lives Changed Forever"
        description="Every foster story is a testament to the power of compassion. Here are just a few of the thousands of lives that have been transformed through our foster program."
        centered={true}
        background="light"
      />

      {/* Impact Stats */}
      <FurbridgeSection
        title="Our Impact"
        description="Together, we've created thousands of happy endings."
        background="white"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {impactStats.map((stat, index) => (
            <div key={index} className="text-center p-6 bg-furbridge-light-gray rounded-xl">
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className="text-3xl font-bold text-furbridge-orange mb-2">{stat.number}</div>
              <div className="font-semibold text-furbridge-warm-gray mb-1">{stat.label}</div>
              <div className="text-sm text-gray-600">{stat.description}</div>
            </div>
          ))}
        </div>
      </FurbridgeSection>

      {/* Success Stories Grid */}
      <FurbridgeSection
        title="Foster Success Stories"
        description="Read about the incredible journeys of pets and families who found each other through fostering."
        background="light"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {successStories.map((story) => (
            <FurbridgeCard
              key={story.id}
              title={story.petName}
              image={story.image}
              imageAlt={`${story.petName} success story`}
              badge={story.outcome}
              badgeColor="teal"
            >
              <div className="mb-4">
                <p className="text-sm text-furbridge-orange font-semibold mb-1">Foster Family: {story.fosterFamily}</p>
                <p className="text-sm text-gray-500 mb-3">Duration: {story.duration}</p>
                <p className="text-gray-600 text-sm leading-relaxed">{story.story}</p>
              </div>
            </FurbridgeCard>
          ))}
        </div>
      </FurbridgeSection>

      {/* Testimonials */}
      <FurbridgeSection title="What Our Foster Families Say" background="white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-6 bg-furbridge-light-gray rounded-xl">
            <p className="text-gray-600 italic mb-4">
              "Fostering with FurBridge has been the most rewarding experience. The support they provide makes it easy
              to focus on what matters most - giving these animals the love they deserve."
            </p>
            <p className="font-semibold text-furbridge-warm-gray">- Sarah Thompson, Foster Mom</p>
          </div>
          <div className="p-6 bg-furbridge-light-gray rounded-xl">
            <p className="text-gray-600 italic mb-4">
              "We started fostering to help animals, but we gained so much more. Our children learned compassion, and
              we've made lifelong memories with every pet we've helped."
            </p>
            <p className="font-semibold text-furbridge-warm-gray">- The Johnson Family</p>
          </div>
        </div>
      </FurbridgeSection>

      {/* Call to Action */}
      <FurbridgeSection
        title="Your Success Story Starts Here"
        description="Join our community of foster heroes and help create the next success story."
        centered={true}
        background="light"
        padding="md"
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-furbridge-teal text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-furbridge-teal-hover transition-colors">
            Become a Foster
          </button>
          <button className="border-2 border-furbridge-orange text-furbridge-orange px-8 py-4 rounded-lg font-semibold text-lg hover:bg-furbridge-orange hover:text-white transition-colors">
            Share Your Story
          </button>
        </div>
      </FurbridgeSection>
    </main>
  )
}
