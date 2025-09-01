import type * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { FurbridgeButton } from "../furbridge-button"

interface NavigationItem {
  label: string
  href: string
}

interface FurbridgeHeaderProps extends React.ComponentProps<"header"> {
  navigationItems?: NavigationItem[]
  showFosterButton?: boolean
}

const defaultNavigationItems: NavigationItem[] = [
  { label: "Home", href: "/" },
  { label: "Available Pets", href: "/available-pets" },
  { label: "How to Foster", href: "/how-to-foster" },
  { label: "Success Stories", href: "/success-stories" },
]

function FurbridgeHeader({
  className,
  navigationItems = defaultNavigationItems,
  showFosterButton = true,
  ...props
}: FurbridgeHeaderProps) {
  return (
    <header
      data-slot="furbridge-header"
      className={cn("sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100", className)}
      {...props}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-furbridge-orange">FurBridge</div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-furbridge-warm-gray hover:text-furbridge-orange transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Foster Button */}
          {showFosterButton && (
            <FurbridgeButton variant="orange" size="sm">
              Foster Now
            </FurbridgeButton>
          )}
        </div>
      </div>
    </header>
  )
}

export { FurbridgeHeader }
export type { FurbridgeHeaderProps, NavigationItem }
