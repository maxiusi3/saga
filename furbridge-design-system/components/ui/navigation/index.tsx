import type React from "react"
import { cn } from "@/lib/utils"

interface NavigationProps {
  className?: string
  logo?: React.ReactNode
  items?: Array<{
    label: string
    href: string
    active?: boolean
  }>
  actions?: React.ReactNode
}

export function Navigation({ className, logo, items = [], actions }: NavigationProps) {
  return (
    <nav
      className={cn(
        "flex items-center justify-between px-4 md:px-6 lg:px-8 py-4 bg-background/95 backdrop-blur-sm border-b border-border",
        className,
      )}
    >
      <div className="flex items-center space-x-8">
        {logo && <div className="flex items-center">{logo}</div>}

        <div className="hidden md:flex items-center space-x-6">
          {items.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                item.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {actions && <div className="flex items-center space-x-4">{actions}</div>}
    </nav>
  )
}

export default Navigation
