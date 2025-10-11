# Landing Page Hero Section Updated

## Changes Made

### Hero Section with Frosted Glass Effect

Updated the hero section of the landing page (`packages/web/src/app/page.tsx`) to match the prototype design:

#### Key Changes:

1. **Background Image with Frosted Glass Overlay**
   - Added full-width background image using Unsplash family photo
   - Applied frosted glass effect using `backdrop-blur-md`
   - Dark green overlay (`bg-[#2D5A3D]/70`) for better text readability

2. **Text Color Updates**
   - Changed all text to white for better contrast against dark background
   - Main heading: `text-white`
   - Subtitle: `text-white/90` (90% opacity)
   - Trust badge: `text-white/80` with bold white number

3. **Button Styling**
   - Primary CTA: Yellow/amber button (`bg-[#F59E0B]`) with shadow
   - Secondary CTA: White outline button with hover effect (`border-white text-white hover:bg-white/10`)

4. **Layout Improvements**
   - Added padding (`py-20`) for better vertical spacing
   - Maintained responsive design for mobile/tablet/desktop

### Code Structure

```tsx
<section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
  {/* Background Image */}
  <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: "url(...)"}}>
    {/* Frosted Glass Overlay */}
    <div className="absolute inset-0 bg-[#2D5A3D]/70 backdrop-blur-md"></div>
  </div>
  
  {/* Content */}
  <div className="relative z-10 container mx-auto px-6 md:px-12 text-center py-20">
    {/* Hero content with white text */}
  </div>
</section>
```

### Visual Effect

The frosted glass effect is achieved through:
- `backdrop-blur-md`: Creates the blur effect
- `bg-[#2D5A3D]/70`: Semi-transparent dark green overlay (70% opacity)
- Layered approach: Image → Blur overlay → Content

### Browser Compatibility

The `backdrop-blur` CSS property is supported in:
- Chrome/Edge 76+
- Safari 9+
- Firefox 103+

For older browsers, the dark overlay will still provide good readability even without the blur effect.

## Next Steps

The hero section now matches the prototype design. Other sections of the landing page remain unchanged and functional.

## Files Modified

- `packages/web/src/app/page.tsx` - Updated hero section with frosted glass background effect
