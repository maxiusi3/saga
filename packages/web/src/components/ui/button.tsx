import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Primary button with solid green background
        primary:
          "bg-primary text-primary-foreground hover:bg-secondary shadow-sm rounded-lg",
        // Secondary button with outlined green border
        secondary:
          "border-2 border-primary text-primary bg-background hover:bg-gray-50 rounded-lg",
        // Tertiary text-only button variant
        tertiary:
          "text-primary hover:bg-gray-50 rounded-lg",
        // Destructive red button variants
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-red-600 shadow-sm rounded-lg",
        "destructive-outline":
          "border-2 border-destructive text-destructive bg-background hover:bg-red-50 rounded-lg",
        "destructive-tertiary":
          "text-destructive hover:bg-red-50 rounded-lg",
        // Legacy variants for backward compatibility
        default:
          "bg-primary text-primary-foreground hover:bg-secondary shadow-sm rounded-lg",
        outline:
          "border-2 border-primary text-primary bg-background hover:bg-gray-50 rounded-lg",
        ghost:
          "text-primary hover:bg-gray-50 rounded-lg",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-3 text-sm",
        sm: "h-9 px-4 py-2 text-sm",
        lg: "h-12 px-8 py-3 text-base",
        xl: "h-14 px-10 py-4 text-lg",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export type { ButtonProps }
