# Story Detail Page Permissions Fix

## Issues Fixed

### 1. Facilitator Edit Permissions
**Problem**: Facilitators could edit story titles and transcripts, which should only be editable by storytellers.

**Solution**: 
- Added `canEditStory` check that verifies:
  - User role is 'storyteller'
  - User is the owner of the story (storyteller_id matches user.id)
- Edit buttons for title and transcript now only show when `canEditStory` is true
- Edit mode can only be activated when `canEditStory` is true

### 2. Missing Comment Input
**Problem**: Both facilitators and storytellers couldn't see the comment input section.

**Solution**:
- Removed the outer conditional wrapper `{(canAddComments || canAskFollowups) && ...}` 
- Now the comment section always renders when `canAddComments` is true
- Both facilitators and storytellers have `canAddComments: true` in their permissions

### 3. Missing Follow-up Question Input
**Problem**: Facilitators couldn't see the follow-up question input.

**Solution**:
- Follow-up question section now renders independently when `canAskFollowups` is true
- Only facilitators have `canAskFollowUpQuestions: true` permission

## Permission Matrix

### Facilitator Role
- ✅ Can add comments
- ✅ Can ask follow-up questions
- ❌ Cannot edit story titles
- ❌ Cannot edit story transcripts
- ✅ Can view all stories

### Storyteller Role
- ✅ Can add comments
- ❌ Cannot ask follow-up questions
- ✅ Can edit their own story titles
- ✅ Can edit their own story transcripts
- ✅ Can view all stories
- ✅ Can respond to follow-up questions by recording new stories

## Code Changes

### Story Detail Page (`packages/web/src/app/dashboard/projects/[id]/stories/[storyId]/page.tsx`)

1. Added `userRole` state to track if user is facilitator or storyteller
2. Added `canEditStory` computed value that checks role and ownership
3. Conditionally render edit buttons based on `canEditStory`
4. Pass correct `userRole` to StoryInteractions component

### Story Interactions Component (`packages/web/src/components/interactions/story-interactions.tsx`)

1. Removed outer conditional wrapper that was hiding the entire interaction section
2. Comment section now always shows for users with `canAddComments` permission
3. Follow-up section shows independently for users with `canAskFollowups` permission
4. Removed references to non-existent `answer_story_id` field

## Testing Checklist

- [ ] Facilitator can see and post comments
- [ ] Facilitator can see and ask follow-up questions
- [ ] Facilitator cannot see edit buttons for title/transcript
- [ ] Storyteller can see and post comments
- [ ] Storyteller cannot see follow-up question input
- [ ] Storyteller can see edit buttons for their own stories
- [ ] Storyteller can edit their own story titles
- [ ] Storyteller can edit their own story transcripts
- [ ] Storyteller cannot edit other storytellers' stories
