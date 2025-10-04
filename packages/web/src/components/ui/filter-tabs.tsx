import * as React from "react"
import { cn } from "@/lib/utils"
import { EnhancedButton } from "./enhanced-button"
import { Check, ChevronDown } from "lucide-react"

interface FilterOption {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
}

interface FilterTabsProps {
  options: FilterOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  variant?: 'tabs' | 'dropdown' | 'pills'
}

export function FilterTabs({
  options,
  value,
  onValueChange,
  className,
  variant = 'tabs'
}: FilterTabsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const safeOptions = Array.isArray(options) ? options : []
  const selectedOption = safeOptions.find(option => option.value === value)

  if (variant === 'dropdown') {
    return (
      <div className={cn("relative", className)}>
        <EnhancedButton
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="justify-between min-w-[150px]"
          rightIcon={<ChevronDown className="h-4 w-4" />}
        >
          {selectedOption?.label || 'Select...'}
        </EnhancedButton>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-background border border-border rounded-lg shadow-lg z-20">
              <div className="p-1">
                {safeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onValueChange(option.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                      value === option.value && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {option.count !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {option.count}
                        </span>
                      )}
                      {value === option.value && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  if (variant === 'pills') {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {safeOptions.map((option) => (
          <EnhancedButton
            key={option.value}
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-full",
              value === option.value && "shadow-sm"
            )}
            leftIcon={option.icon}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-xs",
                value === option.value 
                  ? "bg-primary-foreground/20 text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {option.count}
              </span>
            )}
          </EnhancedButton>
        ))}
      </div>
    )
  }

  // Default tabs variant
  return (
    <div className={cn("flex items-center gap-1 p-1 bg-muted rounded-lg", className)}>
      {safeOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {option.icon}
          <span>{option.label}</span>
          {option.count !== undefined && (
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-xs",
              value === option.value
                ? "bg-primary/10 text-primary"
                : "bg-muted-foreground/10 text-muted-foreground"
            )}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}