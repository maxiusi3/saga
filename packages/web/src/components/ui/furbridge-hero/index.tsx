import type * as React from "react"
import { cn } from "@/lib/utils"
import { FurbridgeButton } from "../furbridge-button"

interface FurbridgeHeroProps extends React.ComponentProps<"section"> {
  title?: string
  subtitle?: string
  description?: string
  primaryButtonText?: string
  primaryButtonHref?: string
  backgroundImage?: string
  showStats?: boolean
  stats?: {
    petsCount: number
    homesCount: number
  }
}

function FurbridgeHero({
  className,
  title = "Be the bridge between shelter and forever.",
  subtitle,
  description = "Open your home. Save a life.",
  primaryButtonText = "Become a Foster",
  primaryButtonHref = "/foster",
  backgroundImage = "/placeholder.svg?height=800&width=1200",
  showStats = true,
  stats = { petsCount: 2847, homesCount: 1923 },
  ...props
}: FurbridgeHeroProps) {
  return (
    <section
      data-slot="furbridge-hero"
      className={cn("relative min-h-screen flex items-center justify-center overflow-hidden", className)}
      {...props}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img src={backgroundImage || "/placeholder.svg"} alt="Hero background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {subtitle && <p className="text-white/90 text-lg mb-4 font-medium">{subtitle}</p>}

        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-balance">
          {title.split(" ").map((word, index) => {
            if (word === "shelter" || word === "forever.") {
              return (
                <span key={index} className="text-furbridge-teal">
                  {word}{" "}
                </span>
              )
            }
            return <span key={index}>{word} </span>
          })}
        </h1>

        <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto text-balance">{description}</p>

        <FurbridgeButton variant="teal" size="lg" className="text-lg px-8 py-4 h-auto">
          {primaryButtonText} →
        </FurbridgeButton>

        {/* Stats */}
        {showStats && (
          <div className="flex items-center justify-center gap-8 mt-12 text-white">
            <div className="flex items-center gap-2">
              <span className="text-furbridge-orange text-2xl">🐾</span>
              <span className="font-semibold">{stats.petsCount.toLocaleString()} pets fostered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-furbridge-teal text-2xl">🏠</span>
              <span className="font-semibold">{stats.homesCount.toLocaleString()} forever homes</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export { FurbridgeHero }
export type { FurbridgeHeroProps }
