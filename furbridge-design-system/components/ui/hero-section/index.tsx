import type React from "react"
import { cn } from "@/lib/utils"

interface HeroSectionProps {
  className?: string
  backgroundImage?: string
  title: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
  stats?: Array<{
    number: string
    label: string
    icon?: React.ReactNode
  }>
  overlay?: boolean
}

export function HeroSection({
  className,
  backgroundImage,
  title,
  subtitle,
  actions,
  stats,
  overlay = true,
}: HeroSectionProps) {
  return (
    <section
      className={cn("relative min-h-[80vh] flex items-center justify-center", className)}
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : undefined
      }
    >
      {overlay && backgroundImage && <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px]" />}

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-hero text-brown">{title}</h1>

          {subtitle && <p className="text-subtitle max-w-2xl mx-auto">{subtitle}</p>}

          {actions && <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">{actions}</div>}

          {stats && stats.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-8">
              {stats.map((stat, index) => (
                <div key={index} className="flex items-center gap-2 text-brown">
                  {stat.icon}
                  <div className="text-left">
                    <div className="text-stat-number">{stat.number}</div>
                    <div className="text-stat-label">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default HeroSection
