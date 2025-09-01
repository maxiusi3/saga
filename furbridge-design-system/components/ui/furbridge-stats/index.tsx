import type * as React from "react"
import { cn } from "@/lib/utils"

interface StatItem {
  icon: string
  value: number
  label: string
  color?: "orange" | "teal" | "gray"
}

interface FurbridgeStatsProps extends React.ComponentProps<"section"> {
  stats?: StatItem[]
  title?: string
  description?: string
}

const defaultStats: StatItem[] = [
  {
    icon: "🐾",
    value: 2847,
    label: "pets fostered",
    color: "orange",
  },
  {
    icon: "🏠",
    value: 1923,
    label: "forever homes",
    color: "teal",
  },
  {
    icon: "❤️",
    value: 156,
    label: "volunteer families",
    color: "gray",
  },
  {
    icon: "🎉",
    value: 98,
    label: "success rate",
    color: "orange",
  },
]

function FurbridgeStats({
  className,
  stats = defaultStats,
  title = "Making a Difference Together",
  description = "Every number represents a life changed, a family completed, and hope restored.",
  ...props
}: FurbridgeStatsProps) {
  const getColorClasses = (color: StatItem["color"]) => {
    switch (color) {
      case "orange":
        return "text-furbridge-orange"
      case "teal":
        return "text-furbridge-teal"
      default:
        return "text-furbridge-warm-gray"
    }
  }

  return (
    <section data-slot="furbridge-stats" className={cn("py-16 bg-furbridge-light-gray", className)} {...props}>
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-furbridge-warm-gray mb-4">{title}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto text-balance">{description}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className={cn("text-3xl md:text-4xl font-bold mb-2", getColorClasses(stat.color))}>
                {stat.value.toLocaleString()}
                {stat.label.includes("rate") && "%"}
              </div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { FurbridgeStats }
export type { FurbridgeStatsProps, StatItem }
