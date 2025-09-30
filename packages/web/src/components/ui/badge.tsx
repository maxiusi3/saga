import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors duration-200",
  {
    variants: {
      variant: {
        // Status badges with color-coded variants
        default:
          "bg-primary text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground",
        success:
          "bg-success text-white",
        warning:
          "bg-warning text-white",
        destructive:
          "bg-destructive text-destructive-foreground",
        neutral:
          "bg-gray-500 text-white",
        outline:
          "border border-primary text-primary bg-background",
        
        // Role badges for facilitator/storyteller identification
        facilitator:
          "bg-primary text-primary-foreground",
        storyteller:
          "bg-blue-500 text-white",
        admin:
          "bg-purple-500 text-white",
        
        // Project status badges
        active:
          "bg-success text-white",
        archived:
          "bg-gray-500 text-white",
        planning:
          "bg-warning text-white",
        
        // Story status badges
        new:
          "bg-blue-500 text-white",
        reviewed:
          "bg-success text-white",
        pending:
          "bg-warning text-white",
      },
      size: {
        default: "px-3 py-1 text-xs",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

// Helper components for specific badge types
function RoleBadge({ 
  role, 
  className, 
  ...props 
}: { role: 'facilitator' | 'storyteller' | 'admin' } & Omit<React.ComponentProps<typeof Badge>, 'variant'>) {
  return (
    <Badge
      variant={role}
      className={className}
      {...props}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  )
}

function StatusBadge({ 
  status, 
  className, 
  ...props 
}: { status: 'active' | 'archived' | 'planning' | 'new' | 'reviewed' | 'pending' } & Omit<React.ComponentProps<typeof Badge>, 'variant'>) {
  return (
    <Badge
      variant={status}
      className={className}
      {...props}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

export { Badge, badgeVariants, RoleBadge, StatusBadge }
