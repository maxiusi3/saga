import * as React from "react"
import { cn } from "@/lib/utils"

const Timeline = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("relative space-y-8 pl-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent", className)}
        {...props}
    />
))
Timeline.displayName = "Timeline"

const TimelineItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("relative", className)}
        {...props}
    />
))
TimelineItem.displayName = "TimelineItem"

const TimelineConnector = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("absolute -left-[29px] top-2 h-3 w-3 rounded-full border-2 border-primary bg-background", className)}
        {...props}
    />
))
TimelineConnector.displayName = "TimelineConnector"

const TimelineHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center mb-2", className)}
        {...props}
    />
))
TimelineHeader.displayName = "TimelineHeader"

const TimelineTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("font-semibold leading-none tracking-tight", className)}
        {...props}
    />
))
TimelineTitle.displayName = "TimelineTitle"

const TimelineContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("", className)}
        {...props}
    />
))
TimelineContent.displayName = "TimelineContent"

export { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineContent }
