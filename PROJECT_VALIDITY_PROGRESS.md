# Project Validity Period Progress Bar

## Changes Made

### 1. Replaced Search Bar with Validity Period Progress

**Location**: Project Detail Page (`packages/web/src/app/dashboard/projects/[id]/page.tsx`)

**Before**: Search bar for filtering stories
**After**: Project validity period progress bar with expiration tracking

### 2. Progress Bar Features

#### Visual Components
- **Header Section**:
  - Clock icon
  - "Project Validity Period" title
  - Days remaining counter (e.g., "287 days remaining")

- **Progress Bar**:
  - Full-width gradient progress bar (sage-500 to sage-600)
  - Visual percentage indicator (78% in example)
  - Smooth transition animation

- **Timeline Info**:
  - Start date: "Started: Jan 15, 2024"
  - End date: "Expires: Jan 15, 2025"
  - Small text below progress bar

- **Status Badge**:
  - Green "Active" badge
  - "Interactive service available" text

#### Design Specifications
```tsx
<EnhancedCard className="mb-6">
  <div className="p-4">
    {/* Header with days remaining */}
    <div className="flex items-center justify-between mb-3">
      <Clock icon + Title />
      <Days Remaining />
    </div>
    
    {/* Progress bar */}
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className="bg-gradient-to-r from-sage-500 to-sage-600 h-3" 
           style={{ width: '78%' }} />
    </div>
    
    {/* Timeline */}
    <div className="flex justify-between text-xs">
      <span>Started: ...</span>
      <span>Expires: ...</span>
    </div>
    
    {/* Status */}
    <Badge>Active</Badge>
  </div>
</EnhancedCard>
```

### 3. Fixed Supabase Multiple Instances Warning

**Problem**: Multiple `GoTrueClient` instances detected
**Cause**: Creating new Supabase client on every API request

**Solution**: Implemented singleton pattern in `settings-service.ts`

```typescript
// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseClient
}
```

**Benefits**:
- ✅ No more multiple instance warnings
- ✅ Better performance (reuse connection)
- ✅ Consistent auth state across requests
- ✅ Reduced memory usage

### 4. Fixed FilterTabs Component Usage

**Issue**: Incorrect prop names (`tabs`, `activeTab`, `onTabChange`)
**Fixed**: Updated to correct props (`options`, `value`, `onValueChange`)

```typescript
// Before
<FilterTabs
  tabs={[...]}
  activeTab={sortBy}
  onTabChange={(tab) => setSortBy(tab)}
/>

// After
<FilterTabs
  options={[
    { value: 'latest', label: 'Latest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'most-comments', label: 'Most Comments' }
  ]}
  value={sortBy}
  onValueChange={(value) => setSortBy(value)}
/>
```

## Future Enhancements

### Dynamic Progress Calculation

Currently using hardcoded values. Should calculate from database:

```typescript
interface ProjectSubscription {
  project_id: string;
  start_date: Date;
  end_date: Date;
  status: 'active' | 'expired' | 'archived';
}

function calculateProgress(subscription: ProjectSubscription) {
  const now = new Date();
  const start = new Date(subscription.start_date);
  const end = new Date(subscription.end_date);
  
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = totalDays - elapsedDays;
  const percentage = Math.floor((elapsedDays / totalDays) * 100);
  
  return {
    totalDays,
    elapsedDays,
    remainingDays,
    percentage,
    isExpired: now > end
  };
}
```

### Status Indicators

Different colors based on remaining time:

```typescript
function getStatusColor(remainingDays: number) {
  if (remainingDays > 90) return 'green'; // Active
  if (remainingDays > 30) return 'yellow'; // Expiring Soon
  if (remainingDays > 0) return 'orange'; // Expiring Very Soon
  return 'red'; // Expired
}
```

### Backend Requirements

1. **Subscriptions Table**:
   ```sql
   CREATE TABLE project_subscriptions (
     id UUID PRIMARY KEY,
     project_id UUID REFERENCES projects(id),
     start_date TIMESTAMP NOT NULL,
     end_date TIMESTAMP NOT NULL,
     status VARCHAR(20) DEFAULT 'active',
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **API Endpoint**:
   ```typescript
   GET /api/projects/:id/subscription
   Response: {
     start_date: "2024-01-15T00:00:00Z",
     end_date: "2025-01-15T00:00:00Z",
     days_remaining: 287,
     percentage_elapsed: 78,
     status: "active"
   }
   ```

3. **Automatic Status Updates**:
   - Cron job to check expired subscriptions
   - Update project status to 'archived' when expired
   - Send notification emails before expiration

## Testing

1. ✅ Progress bar displays correctly
2. ✅ No Supabase multiple instance warnings
3. ✅ FilterTabs component works properly
4. ✅ All TypeScript errors resolved
5. ✅ Settings page loads without issues

## Notes

- Search functionality removed (can be added back if needed)
- Progress bar uses mock data (287 days, 78%)
- Singleton pattern prevents Supabase client duplication
- Ready for backend integration when subscription data available
