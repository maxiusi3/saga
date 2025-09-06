import type React from "react"
import { cn } from "@/lib/utils"

interface SectionContainerProps {
  className?: string
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  padding?: "none" | "sm" | "md" | "lg" | "xl"
}

export function SectionContainer({ className, children, maxWidth = "xl", padding = "lg" }: SectionContainerProps) {
  const maxWidthStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-7xl",
    "2xl": "max-w-7xl",
    full: "max-w-full",
  }

  const paddingStyles = {
    none: "",
    sm: "px-4 py-8",
    md: "px-6 py-12",
    lg: "px-4 md:px-6 lg:px-8 py-16",
    xl: "px-4 md:px-6 lg:px-8 py-20",
  }

  return (
    <section className={cn("mx-auto", maxWidthStyles[maxWidth], paddingStyles[padding], className)}>{children}</section>
  )
}

export default SectionContainer
