import type React from "react"
import { cn } from "@/lib/utils"
import { Card } from "../card"

interface StatCardProps {
  className?: string
  number: string
  label: string
  icon?: React.ReactNode
  description?: string
  trend?: {
    value: string
    direction: "up" | "down"
  }
}

export function StatCard({ className, number, label, icon, description, trend }: StatCardProps) {
  return (
    <Card className={cn("p-6 text-center hover:shadow-lg transition-shadow", className)}>
      {icon && <div className="flex justify-center mb-4 text-primary">{icon}</div>}

      <div className="space-y-2">
        <div className="text-stat-number text-primary">{number}</div>
        <div className="text-stat-label font-medium">{label}</div>

        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        {trend && (
          <div className={cn("text-xs font-medium", trend.direction === "up" ? "text-green-600" : "text-red-600")}>
            {trend.direction === "up" ? "↗" : "↘"} {trend.value}
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatCard
