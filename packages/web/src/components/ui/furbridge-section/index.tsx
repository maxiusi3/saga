import type * as React from "react"
import { cn } from "@/lib/utils"

interface FurbridgeSectionProps extends React.ComponentProps<"section"> {
  title?: string
  subtitle?: string
  description?: string
  centered?: boolean
  background?: "white" | "light" | "transparent"
  padding?: "sm" | "md" | "lg"
}

function FurbridgeSection({
  className,
  title,
  subtitle,
  description,
  centered = false,
  background = "white",
  padding = "lg",
  children,
  ...props
}: FurbridgeSectionProps) {
  const getBackgroundClasses = (bg: typeof background) => {
    switch (bg) {
      case "light":
        return "bg-furbridge-light-gray"
      case "transparent":
        return "bg-transparent"
      default:
        return "bg-white"
    }
  }

  const getPaddingClasses = (p: typeof padding) => {
    switch (p) {
      case "sm":
        return "py-8"
      case "md":
        return "py-12"
      default:
        return "py-16"
    }
  }

  return (
    <section
      data-slot="furbridge-section"
      className={cn(getBackgroundClasses(background), getPaddingClasses(padding), className)}
      {...props}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        {(title || subtitle || description) && (
          <div className={cn("mb-12", centered && "text-center")}>
            {subtitle && (
              <p className="text-furbridge-orange font-semibold mb-2 uppercase tracking-wide text-sm">{subtitle}</p>
            )}
            {title && <h2 className="text-3xl md:text-4xl font-bold text-furbridge-warm-gray mb-4">{title}</h2>}
            {description && (
              <p className={cn("text-lg text-gray-600 text-balance", centered && "max-w-3xl mx-auto")}>{description}</p>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </section>
  )
}

export { FurbridgeSection }
export type { FurbridgeSectionProps }
