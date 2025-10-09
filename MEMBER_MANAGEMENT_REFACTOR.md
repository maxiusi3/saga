# Member Management UI Refactor

## Changes Made

Consolidated the member management interface by:
1. Moving current members display into the InvitationManager component
2. Removing the duplicate "Current Members" section
3. Creating a unified member management interface

## Before

The settings page had two separate sections:
1. **Project Invitations** - Showing pending invitations
2. **Current Members** - Showing active project members (duplicate list)

This created confusion and redundancy in the UI.

## After

Now there is a single **Member Management** section with:
1. **Send New Invitation** - Form to invite new members
2. **Current Members** - List of active project members
3. **Pending Invitations** - List of sent invitations

All in one cohesive component.

## Implementation Details

### InvitationManager Component Updates

**New Props:**
```typescript
interface InvitationManagerProps {
  projectId: string
  currentMembers?: ProjectMember[]      // NEW: Current project members
  currentUserId?: string                // NEW: Current user ID
  isProjectOwner?: boolean              // NEW: Whether user is project owner
  onRemoveMember?: (memberId: string) => void  // NEW: Callback to remove member
  className?: string
}
```

**New Features:**
- Displays current members with owner highlighting
- Shows member roles and status
- Allows project owners to remove members
- Separates current members from pending invitations

### Settings Page Updates

**Before:**
```typescript
<InvitationManager projectId={projectId} />

{/* Separate Current Members section */}
<div className="border-t pt-6 mb-4">
  <h3>Current Members</h3>
</div>
<div className="space-y-3">
  {/* Member list */}
</div>
```

**After:**
```typescript
<InvitationManager 
  projectId={projectId} 
  currentMembers={project.members}
  currentUserId={user.id}
  isProjectOwner={project.is_owner}
  onRemoveMember={handleRemoveMember}
/>
```

## UI Improvements

### Current Members Section
- ✅ Shows owner with crown icon (👑)
- ✅ Highlights owner with amber background
- ✅ Displays member role badges
- ✅ Shows member status (Active/Pending)
- ✅ Allows removal of non-owner members (for project owners)

### Pending Invitations Section
- ✅ Clear separation from current members
- ✅ Shows invitation status (Pending/Accepted/Expired)
- ✅ Displays time remaining for pending invitations
- ✅ Copy link and QR code generation buttons

## Benefits

1. **Cleaner UI** - Single unified interface instead of duplicate sections
2. **Better Organization** - Clear separation between members and invitations
3. **Improved UX** - All member management in one place
4. **Reduced Code** - Eliminated duplicate member display logic
5. **Maintainability** - Single source of truth for member display

## Files Modified

1. `packages/web/src/components/invitations/invitation-manager.tsx`
   - Added current members display
   - Added member removal functionality
   - Separated members from invitations

2. `packages/web/src/app/dashboard/projects/[id]/settings/page.tsx`
   - Removed duplicate "Current Members" section
   - Passed member data to InvitationManager
   - Simplified component structure

## Testing Checklist

- [ ] Current members display correctly
- [ ] Owner is highlighted with crown icon
- [ ] Member roles are shown correctly
- [ ] Member status badges display properly
- [ ] Remove member button works (for non-owners)
- [ ] Pending invitations show separately
- [ ] Invitation actions (copy link, QR code) still work
- [ ] No duplicate member listings
