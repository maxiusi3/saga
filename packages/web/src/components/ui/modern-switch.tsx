'use client'

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface ModernSwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: string
  description?: string
  size?: 'sm' | 'default' | 'lg'
}

const sizeVariants = {
  sm: {
    root: "h-5 w-9",
    thumb: "h-4 w-4 data-[state=checked]:translate-x-4"
  },
  default: {
    root: "h-6 w-11",
    thumb: "h-5 w-5 data-[state=checked]:translate-x-5"
  },
  lg: {
    root: "h-7 w-12",
    thumb: "h-6 w-6 data-[state=checked]:translate-x-5"
  }
}

export function ModernSwitch({ 
  className, 
  label, 
  description, 
  size = 'default',
  ...props 
}: ModernSwitchProps) {
  const sizeClasses = sizeVariants[size]
  
  const switchElement = (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        sizeClasses.root,
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
          sizeClasses.thumb
        )}
      />
    </SwitchPrimitives.Root>
  )

  if (label || description) {
    return (
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1 space-y-1">
          {label && (
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {switchElement}
      </div>
    )
  }

  return switchElement
}