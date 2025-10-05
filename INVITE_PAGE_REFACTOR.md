# Invite Member Page Refactor

## Changes Made

### 1. Removed Duplicate Invite Functionality (红框1)

**Problem**: "Invite New Member" section in settings page duplicated the "Invite Member" button functionality

**Solution**: 
- ✅ Removed inline invite form from settings page
- ✅ Created dedicated invite page at `/dashboard/projects/[id]/invite`
- ✅ Updated "Invite Members" button in Quick Actions to link to invite page
- ✅ Updated "Invite Member" button in Member Management to link to invite page

### 2. Fixed Role Options (红框2)

**Problem**: Role dropdown included incorrect "Co-Facilitator" option

**Solution**:
- ✅ Removed "Co-Facilitator" from role dropdown
- ✅ Only two roles available: **Facilitator** and **Storyteller**

### 3. Created Dedicated Invite Page

**Location**: `packages/web/src/app/dashboard/projects/[id]/invite/page.tsx`

#### Features:
- **Clean UI**: Focused single-purpose page
- **Email Input**: With mail icon and validation
- **Role Selection**: Dropdown with role descriptions
- **Info Box**: Explains role permissions
- **Recent Invitations**: Placeholder for future feature
- **Auto-redirect**: Returns to settings after successful invite

#### Design Elements:
```tsx
<EnhancedCard>
  {/* Header with icon */}
  <UserPlus icon + Title />
  
  {/* Email input */}
  <Input with Mail icon />
  
  {/* Role selector with descriptions */}
  <Select>
    <Storyteller>: Can record and share stories
    <Facilitator>: Can manage project and invite others
  </Select>
  
  {/* Info box */}
  <Blue info box with role details />
  
  {/* Actions */}
  <Send Invitation button />
  <Cancel button />
</EnhancedCard>
```

### 4. Cleaned Up Settings Page

**Removed**:
- `inviteEmail` state
- `inviteRole` state
- `inviting` state
- `handleInviteMember` function
- Inline invite form section
- Duplicate "Invite Member" button

**Updated**:
- Quick Actions "Invite Members" → Links to `/invite` page
- Member Management "Invite Member" → Links to `/invite` page
- Role dropdown → Only Facilitator and Storyteller

### 5. Navigation Flow

```
Settings Page
  ↓
  Click "Invite Members" (Quick Actions)
  OR
  Click "Invite Member" (Member Management)
  ↓
Invite Page (/dashboard/projects/[id]/invite)
  ↓
  Fill form and send invitation
  ↓
Auto-redirect back to Settings Page
```

## Benefits

1. **No Duplication**: Single source of truth for invitations
2. **Better UX**: Dedicated page with clear focus
3. **Cleaner Code**: Separated concerns, easier to maintain
4. **Correct Roles**: Only valid roles (Facilitator, Storyteller)
5. **Better Navigation**: Clear flow between pages

## Role Definitions

### Facilitator
- Can manage the project
- Can invite other members
- Can interact with stories (comment, follow-up)
- Can view all project content

### Storyteller
- Can record and share stories
- Can view project content
- Cannot invite others
- Cannot manage project settings

## Future Enhancements

### Invite Page
1. **Recent Invitations List**: Show pending/accepted invitations
2. **Bulk Invite**: Invite multiple people at once
3. **Custom Message**: Add personal message to invitation
4. **Invitation Templates**: Pre-filled messages for different roles
5. **Resend Invitation**: Resend expired invitations

### Invitation Management
```typescript
interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: 'facilitator' | 'storyteller';
  status: 'pending' | 'accepted' | 'expired';
  invited_by: string;
  invited_at: Date;
  expires_at: Date;
  accepted_at?: Date;
}
```

### Backend Requirements
1. **Invitation Tracking Table**
2. **Email Service Integration**
3. **Invitation Token Generation**
4. **Expiration Logic** (72 hours)
5. **Acceptance Endpoint**

## Testing Checklist

- ✅ Quick Actions "Invite Members" links to invite page
- ✅ Member Management "Invite Member" links to invite page
- ✅ Invite page loads correctly
- ✅ Email validation works
- ✅ Role selection works
- ✅ Send invitation button disabled when email empty
- ✅ Success toast shows after invitation sent
- ✅ Auto-redirect to settings after success
- ✅ Role dropdown only shows Facilitator and Storyteller
- ✅ No TypeScript errors
- ✅ No console warnings

## Files Modified

1. `packages/web/src/app/dashboard/projects/[id]/settings/page.tsx`
   - Removed invite form
   - Updated buttons to link to invite page
   - Removed Co-Facilitator option
   - Cleaned up unused state and functions

2. `packages/web/src/app/dashboard/projects/[id]/invite/page.tsx` (NEW)
   - Created dedicated invite page
   - Full invite functionality
   - Role descriptions
   - Auto-redirect on success
