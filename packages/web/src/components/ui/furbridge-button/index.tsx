import type * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const furbridgeButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        orange:
          "bg-furbridge-orange text-white shadow-lg hover:bg-furbridge-orange-hover focus-visible:ring-furbridge-orange/50",
        teal: "bg-furbridge-teal text-white shadow-lg hover:bg-furbridge-teal-hover focus-visible:ring-furbridge-teal/50",
        outline:
          "border-2 border-furbridge-orange text-furbridge-orange bg-transparent hover:bg-furbridge-orange hover:text-white",
        ghost: "text-furbridge-warm-gray hover:bg-furbridge-light-gray hover:text-furbridge-orange",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 px-4 py-2 text-sm",
        lg: "h-12 px-8 py-3 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "orange",
      size: "default",
    },
  },
)

interface FurbridgeButtonProps extends React.ComponentProps<"button">, VariantProps<typeof furbridgeButtonVariants> {
  asChild?: boolean
}

function FurbridgeButton({ className, variant, size, asChild = false, ...props }: FurbridgeButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="furbridge-button"
      className={cn(furbridgeButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { FurbridgeButton, furbridgeButtonVariants }
export type { FurbridgeButtonProps }
