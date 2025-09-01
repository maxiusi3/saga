"use client"

import type * as React from "react"
import { cn } from "@/lib/utils"
import { FurbridgeButton } from "../furbridge-button"

interface FurbridgeCardProps extends React.ComponentProps<"div"> {
  title?: string
  description?: string
  image?: string
  imageAlt?: string
  buttonText?: string
  buttonVariant?: "orange" | "teal" | "outline" | "ghost"
  onButtonClick?: () => void
  badge?: string
  badgeColor?: "orange" | "teal" | "gray"
}

function FurbridgeCard({
  className,
  title,
  description,
  image,
  imageAlt = "",
  buttonText,
  buttonVariant = "orange",
  onButtonClick,
  badge,
  badgeColor = "orange",
  children,
  ...props
}: FurbridgeCardProps) {
  const getBadgeClasses = (color: typeof badgeColor) => {
    switch (color) {
      case "orange":
        return "bg-furbridge-orange text-white"
      case "teal":
        return "bg-furbridge-teal text-white"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div
      data-slot="furbridge-card"
      className={cn(
        "bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group",
        className,
      )}
      {...props}
    >
      {/* Image */}
      {image && (
        <div className="relative overflow-hidden">
          <img
            src={image || "/placeholder.svg"}
            alt={imageAlt}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {badge && (
            <div
              className={cn(
                "absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-semibold",
                getBadgeClasses(badgeColor),
              )}
            >
              {badge}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {title && <h3 className="text-xl font-bold text-furbridge-warm-gray mb-3">{title}</h3>}

        {description && <p className="text-gray-600 mb-4 text-balance">{description}</p>}

        {children}

        {buttonText && (
          <FurbridgeButton variant={buttonVariant} size="sm" onClick={onButtonClick} className="mt-4">
            {buttonText}
          </FurbridgeButton>
        )}
      </div>
    </div>
  )
}

export { FurbridgeCard }
export type { FurbridgeCardProps }
