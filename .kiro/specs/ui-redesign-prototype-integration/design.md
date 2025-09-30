# Design Document

## Overview

This design document outlines the comprehensive UI redesign for the Saga web application, transforming the existing interface to match the modern, clean aesthetic shown in the provided prototypes. The redesign focuses on improving user experience through better visual hierarchy, consistent design patterns, and enhanced accessibility while maintaining all existing functionality.

## Architecture

### Design System Foundation

The redesign is built on a cohesive design system that ensures consistency across all pages and components:

**Color Palette:**
- Primary Green: `#2D5A3D` (buttons, accents, active states)
- Secondary Green: `#4A7C59` (hover states, secondary actions)
- Success Green: `#22C55E` (status indicators, confirmations)
- Warning Yellow: `#F59E0B` (alerts, pending states)
- Error Red: `#EF4444` (errors, destructive actions)
- Neutral Gray Scale: `#F8FAFC` to `#1E293B` (backgrounds, text, borders)

**Typography Scale:**
- Display: 48px/56px (hero headings)
- H1: 36px/44px (page titles)
- H2: 30px/36px (section headers)
- H3: 24px/32px (card titles)
- H4: 20px/28px (subsection headers)
- Body Large: 18px/28px (important content)
- Body: 16px/24px (default text)
- Body Small: 14px/20px (metadata, captions)
- Caption: 12px/16px (labels, fine print)

**Spacing System:**
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px

**Border Radius:**
- Small: 6px (buttons, badges)
- Medium: 12px (cards, inputs)
- Large: 16px (major containers)
- Full: 9999px (pills, avatars)

### Component Architecture

**Card System:**
- Base card with subtle shadow and rounded corners
- Hover states with elevated shadow
- Content cards for stories, projects, and information
- Action cards with prominent CTAs

**Button Hierarchy:**
- Primary: Solid green background for main actions
- Secondary: Outlined green border for secondary actions
- Tertiary: Text-only for subtle actions
- Destructive: Red variants for dangerous actions

**Navigation Patterns:**
- Top navigation with user profile and global actions
- Sidebar navigation for section-specific content
- Breadcrumb navigation for deep hierarchies
- Tab navigation for related content sections

## Components and Interfaces

### Dashboard Components

**Welcome Header:**
```typescript
interface WelcomeHeaderProps {
  userName: string;
  resourceWallet: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
  };
}
```

**Project Card:**
```typescript
interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    status: 'active' | 'archived' | 'planning';
    memberCount: number;
    storyCount: number;
    lastActivity: Date;
    members: Array<{
      id: string;
      name: string;
      avatar: string;
      role: 'facilitator' | 'storyteller';
    }>;
  };
  onEnterProject: () => void;
  onManageProject: () => void;
  onArchiveProject: () => void;
}
```

**Resource Wallet Widget:**
```typescript
interface ResourceWalletProps {
  resources: {
    projectVouchers: number;
    facilitatorSeats: number;
    storytellerSeats: number;
  };
  onPurchaseMore: () => void;
}
```

### Story Management Components

**Story Card:**
```typescript
interface StoryCardProps {
  story: {
    id: string;
    title: string;
    storyteller: {
      name: string;
      avatar: string;
    };
    duration: number;
    thumbnail?: string;
    chapter: string;
    theme: string;
    commentCount: number;
    hasFollowUp: boolean;
    createdAt: Date;
  };
  onPlay: () => void;
  onViewDetails: () => void;
  onAddFollowUp: () => void;
}
```

**Chapter Section:**
```typescript
interface ChapterSectionProps {
  chapter: {
    id: string;
    name: string;
    description: string;
    storyCount: number;
    isComplete: boolean;
  };
  stories: Story[];
  onEditChapter: () => void;
}
```

**Story Statistics Sidebar:**
```typescript
interface StoryStatisticsProps {
  statistics: {
    totalStories: number;
    thisMonth: number;
    totalComments: number;
    followUpQuestions: number;
  };
  activeStorytellers: Array<{
    id: string;
    name: string;
    avatar: string;
    lastActive: Date;
    storyCount: number;
  }>;
}
```

### Audio and Media Components

**Audio Player:**
```typescript
interface AudioPlayerProps {
  audioUrl: string;
  duration: number;
  waveformData?: number[];
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  isPlaying: boolean;
}
```

**Photo Gallery:**
```typescript
interface PhotoGalleryProps {
  photos: Array<{
    id: string;
    url: string;
    thumbnail: string;
    caption?: string;
  }>;
  onPhotoSelect: (photoId: string) => void;
  onAddPhoto: () => void;
}
```

### Recording Interface Components

**Recording Controls:**
```typescript
interface RecordingControlsProps {
  isRecording: boolean;
  duration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  maxDuration: number;
}
```

**Review Screen:**
```typescript
interface ReviewScreenProps {
  audioUrl: string;
  duration: number;
  onReRecord: () => void;
  onSendToFamily: () => void;
  onDelete: () => void;
  isUploading: boolean;
}
```

## Data Models

### Enhanced UI State Models

**Dashboard State:**
```typescript
interface DashboardState {
  user: {
    name: string;
    avatar: string;
    resourceWallet: ResourceWallet;
  };
  projects: {
    owned: Project[];
    participating: Project[];
  };
  quickActions: {
    canCreateProject: boolean;
    needsPurchase: boolean;
  };
  recentActivity: Activity[];
}
```

**Story Feed State:**
```typescript
interface StoryFeedState {
  chapters: Chapter[];
  stories: Story[];
  filters: {
    storyteller: string | null;
    theme: string | null;
    sortBy: 'latest' | 'chronological' | 'chapters';
  };
  statistics: StoryStatistics;
  activeStorytellers: Storyteller[];
}
```

**Recording Session State:**
```typescript
interface RecordingSessionState {
  status: 'idle' | 'recording' | 'reviewing' | 'uploading' | 'complete';
  audioBlob?: Blob;
  duration: number;
  attachedPhoto?: File;
  transcript?: string;
  error?: string;
}
```

## Error Handling

### User-Friendly Error States

**Network Errors:**
- Graceful degradation with offline indicators
- Retry mechanisms with exponential backoff
- Clear messaging about connectivity issues

**Upload Failures:**
- Progress indicators with pause/resume capability
- Alternative upload methods (WiFi-only option)
- Draft saving for recovery

**Validation Errors:**
- Inline validation with helpful messaging
- Form state preservation during errors
- Clear guidance on how to fix issues

**Resource Limitations:**
- Clear messaging when seats/vouchers are exhausted
- Direct links to purchase additional resources
- Alternative actions when resources are limited

## Testing Strategy

### Visual Regression Testing
- Automated screenshot comparison for all major pages
- Cross-browser compatibility testing
- Responsive design validation across breakpoints

### Accessibility Testing
- Automated accessibility scanning with axe-core
- Manual keyboard navigation testing
- Screen reader compatibility verification
- Color contrast validation

### User Experience Testing
- Task completion rate measurement
- User satisfaction surveys
- A/B testing for key conversion flows
- Performance impact assessment

### Component Testing
- Isolated component testing with Storybook
- Interaction testing with user events
- Props validation and edge case handling
- Visual state testing (loading, error, empty states)

## Performance Considerations

### Image Optimization
- WebP format with fallbacks
- Responsive image sizing
- Lazy loading for below-fold content
- Progressive image loading

### Code Splitting
- Route-based code splitting
- Component-level lazy loading
- Dynamic imports for heavy features
- Bundle size monitoring

### Animation Performance
- CSS transforms over layout changes
- RequestAnimationFrame for smooth animations
- Reduced motion preferences support
- Performance monitoring for 60fps target

## Accessibility Features

### WCAG 2.1 AA Compliance
- Semantic HTML structure
- Proper heading hierarchy
- Alt text for all images
- Keyboard navigation support
- Focus management
- Color contrast ratios ≥ 4.5:1
- Text scaling up to 200%
- Screen reader compatibility

### Enhanced Accessibility
- High contrast mode support
- Reduced motion preferences
- Large touch targets (44x44dp minimum)
- Clear error messaging
- Timeout warnings and extensions
- Multiple ways to access content

## Implementation Phases

### Phase 1: Design System Foundation
- Establish design tokens and CSS variables
- Create base component library
- Implement typography and spacing systems
- Set up responsive grid system

### Phase 2: Core Page Redesigns
- Dashboard page redesign
- Project list and management pages
- Story list and detail pages
- Settings page redesign

### Phase 3: Interactive Features
- Audio player enhancements
- Recording interface improvements
- Photo gallery and media handling
- Real-time updates and notifications

### Phase 4: Polish and Optimization
- Animation and micro-interactions
- Performance optimization
- Accessibility enhancements
- Cross-browser testing and fixes