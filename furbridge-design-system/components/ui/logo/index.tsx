import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "text" | "icon" | "full"
}

export function Logo({ className, size = "md", variant = "text" }: LogoProps) {
  const sizeStyles = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }

  if (variant === "text" || variant === "full") {
    return <div className={cn("font-bold text-primary", sizeStyles[size], className)}>FurBridge</div>
  }

  return (
    <div
      className={cn(
        "w-8 h-8 bg-primary rounded-lg flex items-center justify-center",
        size === "sm" && "w-6 h-6",
        size === "lg" && "w-10 h-10",
        className,
      )}
    >
      <span className="text-primary-foreground font-bold text-sm">F</span>
    </div>
  )
}

export default Logo
