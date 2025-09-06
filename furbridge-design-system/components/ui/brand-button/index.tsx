import type React from "react"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "../button"

interface BrandButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "primary" | "secondary" | "outline" | "ghost"
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
}

export function BrandButton({
  className,
  variant = "primary",
  icon,
  iconPosition = "right",
  children,
  ...props
}: BrandButtonProps) {
  const variantStyles = {
    primary: "bg-primary hover:bg-primary-hover text-primary-foreground shadow-lg hover:shadow-xl",
    secondary: "bg-secondary hover:bg-secondary-hover text-secondary-foreground shadow-lg hover:shadow-xl",
    outline: "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
    ghost: "text-primary hover:bg-primary/10",
  }

  return (
    <Button
      className={cn(
        "font-semibold transition-all duration-200 transform hover:scale-105",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {icon && iconPosition === "left" && <span className="mr-2">{icon}</span>}
      {children}
      {icon && iconPosition === "right" && <span className="ml-2">{icon}</span>}
    </Button>
  )
}

export default BrandButton
