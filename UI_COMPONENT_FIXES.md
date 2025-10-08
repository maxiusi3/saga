# UI Component Fixes

## Changes Made

### 1. ProjectCard Component (`packages/web/src/components/ui/project-card.tsx`)
**Issue**: Three-dot menu button (MoreHorizontal) was visible in the top-right corner of project cards on the dashboard.

**Fix**: Removed the entire three-dot menu button:
```tsx
// REMOVED:
<EnhancedButton
  variant="ghost"
  size="icon"
  onClick={onMore}
  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
>
  <MoreHorizontal className="h-4 w-4" />
</EnhancedButton>
```

**Result**: Project cards on the dashboard no longer show the three-dot menu icon.

---

### 2. StoryCard Component (`packages/web/src/components/ui/story-card.tsx`)

#### 2a. Removed Author Information
**Issue**: Story cards displayed author name, avatar, and role in the header.

**Fix**: Removed the entire author info section:
```tsx
// REMOVED:
<div className="flex items-center space-x-2 mb-2">
  {author.avatar ? (
    <Image src={author.avatar} alt={author.name} width={24} height={24} className="rounded-full" />
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
```

**Result**: Story cards now only show the title, description, and tags without author information.

#### 2b. Removed Three-Dot Menu
**Issue**: Story cards had a three-dot menu button in the top-right corner.

**Fix**: Removed the MoreHorizontal button from the card header.

**Result**: No three-dot menu icon appears on story cards.

#### 2c. Removed "View Story" Button
**Issue**: Story cards had a "View Story" button in the bottom-right corner.

**Fix**: Removed the action buttons section:
```tsx
// REMOVED:
<div className="flex items-center space-x-2">
  <EnhancedButton variant="ghost" size="sm" onClick={onPlay} className="h-8 px-3">
    <Play className="h-3 w-3 mr-1" />
    View Story
  </EnhancedButton>
</div>
```

**Result**: Story cards no longer have a "View Story" button.

#### 2d. Made Entire Card Clickable
**Issue**: Users had to click specific buttons to view stories.

**Fix**: Added `cursor-pointer` class and `onClick={onPlay}` to the entire card:
```tsx
<EnhancedCard 
  variant={isFeatured ? "elevated" : "interactive"}
  className={cn(
    "group overflow-hidden cursor-pointer",  // Added cursor-pointer
    isFeatured && "border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5",
    className
  )}
  onClick={onPlay}  // Added onClick handler
>
```

**Result**: Clicking anywhere on the story card now navigates to the story detail page.

---

### 3. Recording Page Chinese Text
**Issue**: Recording page buttons showed Chinese text ("暂停", "开始录音").

**Fix**: Updated the SmartRecorder component (`packages/web/src/components/recording/SmartRecorder.tsx`):

Changed button text from Chinese to English:
- "开始录音" → "Start Recording"
- "暂停" → "Pause"
- "实时转录：" → "Real-time Transcription:"

**Result**: All recording buttons now display English text.

---

## Testing Checklist

### Dashboard Page
- [ ] Project cards no longer show three-dot menu icon
- [ ] All other project card functionality works correctly

### Story List Page (Project Detail)
- [ ] Story cards no longer show author name and avatar
- [ ] Story cards no longer show author role
- [ ] Story cards no longer show three-dot menu icon
- [ ] Story cards no longer show "View Story" button
- [ ] Clicking anywhere on a story card navigates to story detail page
- [ ] Story card stats (comments, follow-ups) still display correctly
- [ ] Story card metadata (creation date, duration) still display correctly

### Recording Page
- [ ] All buttons display English text
- [ ] No Chinese text visible on any buttons
- [ ] Recording functionality works correctly

---

## Files Modified

1. `packages/web/src/components/ui/project-card.tsx`
   - Removed three-dot menu button

2. `packages/web/src/components/ui/story-card.tsx`
   - Removed author information section
   - Removed three-dot menu button
   - Removed "View Story" button
   - Made entire card clickable
   - Simplified stats display (removed action buttons section)

3. `packages/web/src/components/recording/SmartRecorder.tsx`
   - Changed "开始录音" to "Start Recording"
   - Changed "暂停" to "Pause"
   - Changed "实时转录：" to "Real-time Transcription:"
