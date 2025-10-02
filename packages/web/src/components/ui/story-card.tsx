import * as React from "react"
import { cn } from "@/lib/utils"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from "./enhanced-card"
import { EnhancedButton } from "./enhanced-button"
import { Play, MessageCircle, Heart, MoreHorizontal, Clock, User } from "lucide-react"
import Image from "next/image"

interface StoryCardProps {
  id: string
  title: string
  author: {
    name: string
    avatar?: string
    role?: string
  }
  duration: string
  createdAt: string
  description?: string
  thumbnail?: string
  tags?: Array<{
    label: string
    color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  }>
  stats?: {
    comments?: number
    likes?: number
    plays?: number
  }
  onPlay?: () => void
  onComment?: () => void
  onLike?: () => void
  onMore?: () => void
  className?: string
  variant?: 'default' | 'compact' | 'featured'
}

const tagColors = {
  default: "bg-gray-100 text-gray-800",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
}

export function StoryCard({
  id,
  title,
  author,
  duration,
  createdAt,
  description,
  thumbnail,
  tags = [],
  stats = {},
  onPlay,
  onComment,
  onLike,
  onMore,
  className,
  variant = 'default'
}: StoryCardProps) {
  const isCompact = variant === 'compact'
  const isFeatured = variant === 'featured'

  return (
    <EnhancedCard 
      variant={isFeatured ? "elevated" : "interactive"}
      className={cn(
        "group overflow-hidden",
        isFeatured && "border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5",
        className
      )}
    >
      {/* Thumbnail Section */}
      {thumbnail && !isCompact && (
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <EnhancedButton
              variant="default"
              size="icon"
              onClick={onPlay}
              className="h-12 w-12 rounded-full shadow-lg"
            >
              <Play className="h-5 w-5 ml-0.5" />
            </EnhancedButton>
          </div>
          <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium">
            {duration}
          </div>
        </div>
      )}

      <EnhancedCardHeader className={cn(isCompact ? "p-4" : "p-6")}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Author Info */}
            <div className="flex items-center space-x-2 mb-2">
              {author.avatar ? (
                <Image
                  src={author.avatar}
                  alt={author.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-3 w-3 text-primary" />
                </div>
              )}
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="font-medium">{author.name}</span>
                {author.role && (
                  <>
                    <span>•</span>
                    <span className="text-xs">{author.role}</span>
                  </>
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className={cn(
              "font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors",
              isCompact ? "text-base" : "text-lg",
              isFeatured && "text-xl"
            )}>
              {title}
            </h3>

            {/* Description */}
            {description && !isCompact && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {description}
              </p>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      tagColors[tag.color || 'default']
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    +{tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* More Actions */}
          <EnhancedButton
            variant="ghost"
            size="icon"
            onClick={onMore}
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </EnhancedButton>
        </div>
      </EnhancedCardHeader>

      <EnhancedCardContent className={cn(isCompact ? "px-4 pb-4" : "px-6 pb-6")}>
        <div className="flex items-center justify-between">
          {/* Time and Duration */}
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{createdAt}</span>
            </div>
            {thumbnail && isCompact && (
              <div className="flex items-center space-x-1">
                <span>{duration}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {(thumbnail || isCompact) && (
              <EnhancedButton
                variant="ghost"
                size="sm"
                onClick={onPlay}
                className="h-8 px-3"
              >
                <Play className="h-3 w-3 mr-1" />
                Play
              </EnhancedButton>
            )}
            
            {stats.comments !== undefined && (
              <EnhancedButton
                variant="ghost"
                size="sm"
                onClick={onComment}
                className="h-8 px-3"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                {stats.comments}
              </EnhancedButton>
            )}
            
            {stats.likes !== undefined && (
              <EnhancedButton
                variant="ghost"
                size="sm"
                onClick={onLike}
                className="h-8 px-3"
              >
                <Heart className="h-3 w-3 mr-1" />
                {stats.likes}
              </EnhancedButton>
            )}
          </div>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  )
}