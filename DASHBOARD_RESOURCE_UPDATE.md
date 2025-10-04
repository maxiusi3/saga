# Dashboard Resource Display Update

## Changes Made

### 1. Removed Duplicate Resource Details Sidebar
- ✅ Deleted the "Resource Details" card from the right sidebar (红框2)
- ✅ Deleted the "Usage History" card
- ✅ Changed layout from 3-column to full-width single column
- ✅ Removed unused imports: `TrendingUp`, `Clock`

### 2. Updated Resource Display Logic

Changed the resource display format from arbitrary numbers to **"Current Balance / Total Purchased"**:

#### Default Purchase Quantities (Denominator)
- **Project Vouchers**: 1 (default purchase)
- **Facilitator Seats**: 2 (default purchase)
- **Storyteller Seats**: 2 (default purchase)

#### Display Format
```
Current Balance / Total Purchased
```

Example:
- `0/1` - 0 remaining out of 1 purchased project voucher
- `2/2` - 2 remaining out of 2 purchased facilitator seats
- `1/2` - 1 remaining out of 2 purchased storyteller seats

### 3. Resource Calculation Logic

The relationship between numerator and denominator:
- **Numerator (分子)**: Current balance from resource wallet (`resourceWallet.project_vouchers`, etc.)
- **Denominator (分母)**: Total purchased quantity (cumulative sum of all purchases)
  - Default values: Project=1, Facilitator=2, Storyteller=2
  - Will increase when user purchases more resources

### 4. Layout Changes

**Before:**
```
┌─────────────────────────────────┬──────────────┐
│                                 │  Resource    │
│  Your Resources (红框1)          │  Details     │
│  My Projects                    │  (红框2)      │
│  Projects I'm In                │              │
│                                 │  Usage       │
│                                 │  History     │
└─────────────────────────────────┴──────────────┘
```

**After:**
```
┌──────────────────────────────────────────────┐
│  Your Resources (红框1 - Updated)             │
│  My Projects                                 │
│  Projects I'm In                             │
│  Quick Actions                               │
└──────────────────────────────────────────────┘
```

## Benefits

1. **No Duplication**: Removed redundant resource information
2. **Cleaner Layout**: Full-width content, better use of space
3. **Clear Semantics**: "Balance/Total" format is more intuitive
4. **Scalable**: Denominator can increase as users purchase more

## Future Enhancements

### Backend Requirements
To fully implement this feature, the backend needs:

1. **Purchase History Tracking**
   ```sql
   CREATE TABLE resource_purchases (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     resource_type VARCHAR(50), -- 'project_voucher', 'facilitator_seat', 'storyteller_seat'
     quantity INTEGER,
     purchased_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Total Purchased Calculation**
   ```typescript
   interface ResourceWallet {
     user_id: string;
     project_vouchers: number; // Current balance
     facilitator_seats: number; // Current balance
     storyteller_seats: number; // Current balance
     total_project_vouchers_purchased: number; // New field
     total_facilitator_seats_purchased: number; // New field
     total_storyteller_seats_purchased: number; // New field
   }
   ```

3. **API Updates**
   - Add fields to wallet response
   - Track purchases in transaction log
   - Calculate totals from purchase history

### Frontend Updates (When Backend Ready)
```typescript
<StatsCard
  title="Project Vouchers"
  value={`${resourceWallet?.project_vouchers || 0}/${resourceWallet?.total_project_vouchers_purchased || 1}`}
  description="Available project vouchers"
  icon={<BookOpen className="w-5 h-5" />}
  variant="info"
/>
```

## Testing

1. ✅ Dashboard loads without errors
2. ✅ Resources display with correct format (0/1, 0/2, 0/2)
3. ✅ No duplicate information
4. ✅ Layout is full-width and clean
5. ✅ All functionality preserved

## Notes

- Currently using hardcoded denominators (1, 2, 2) as defaults
- When backend implements purchase tracking, these will be dynamic
- The numerator (current balance) already comes from the database
- This change aligns with the Package/Seat business model
