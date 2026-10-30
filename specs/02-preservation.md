# Preservation Requirements

## Business Logic & Calculations

**ALL business logic MUST be preserved exactly:**

- **Productivity calculation formula:** Same weighted scoring (35% productivity, 35% quality, 15% FCR, 15% behavior)
- **Productivity thresholds:** Same bands (below 80% = 0, 80-85% = 50, 86-94% = 75, 95+ = 100)
- **Quality thresholds:** Same bands (≤90% = 0, 90.01-92% = 50, 93-96% = 75, ≥97% = 100)
- **FCR thresholds:** Same bands (≤80% = 0, 80.01-85% = 50, 85.01-90% = 75, ≥90% = 100)
- **Flag detection rules:** Same parameters (2 cases in 10 minutes, 5 min minimum interval)
- **TPH calculations:** Same caps and formulas
- **Timezone handling:** Same zones (Asia/Kuwait for business, Africa/Cairo for data)
- **Status mapping:** Same mappings from source to engine statuses

**Implementation approach:**
- Port the calculation functions from `productivity.js` and `ProdValidation.js` to TypeScript
- Use the same function signatures and logic
- Add unit tests to verify output matches GAS system exactly
- Compare results side-by-side during parallel run

## Data Formats

**ALL data formats MUST be preserved:**

- **Dates:** ISO 8601 strings (yyyy-MM-dd) for dates, ISO timestamps for datetimes
- **Percentages:** Stored as decimals (0.85 = 85%), displayed as percentages
- **Durations:** Stored in minutes, displayed as "Xh Ym" format
- **JSON fields:** Preserve exact structure (spans_json, case_ids_json, channel_mix_json, etc.)
- **Time zones:** Preserve offset calculations for business_tz and data_tz
- **Text columns:** Ensure date columns are stored as text (not auto-converted by database)

**Database type mappings:**
```typescript
// Current GAS → PostgreSQL mapping
TEXT → TEXT (for all text columns)
NUMBER → NUMERIC or INTEGER
BOOLEAN → BOOLEAN
DATE → DATE (for yyyy-MM-dd)
TIMESTAMP → TIMESTAMPTZ (for ISO timestamps)
JSONB → JSONB (for JSON fields)
```

## UI Design & Colours

**ALL UI design MUST be preserved:**

- **Colour scheme:** Use the exact same colour palette from current system
- **Layout:** Preserve the same page layouts and component arrangements
- **Components:** Recreate all UI components (flags grid, TPH grid, status cards, etc.)
- **Styling:** Use Tailwind CSS to match current appearance
- **Typography:** Same fonts, sizes, and spacing
- **Icons:** Same icons and visual indicators
- **Responsive behavior:** Same mobile/desktop behavior

**Colour palette extraction:**
```typescript
// Extract from current index.html and GAS-generated CSS
const colors = {
  primary: '#1a73e8',       // Google Blue (main action buttons)
  success: '#1e8e3e',       // Green (accepted, high productivity)
  warning: '#f9ab00',       // Yellow (pending, medium productivity)
  danger: '#ea4335',        // Red (reverted, low productivity, void)
  idle: '#9e9e9e',         // Gray (IDLE status)
  available: '#34a853',     // Green (Available status)
  chats: '#fbbc04',         // Yellow (Chats status)
  waitingAddress: '#f57c00', // Orange (Waiting Address status)
  inboundCalls: '#9c27b0', // Purple (Inbound Calls status)
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#202124',
  textSecondary: '#5f6368'
}
```

**Component preservation:**
- **Flag cards:** Same design with status badges, action buttons, confidence indicators
- **TPH grid:** Same grid layout, same colour coding for slots
- **Analytics charts:** Same chart types, colours, and formatting
- **Status badges:** Same colour coding for statuses
- **Navigation:** Same rail layout and page hierarchy

## User Experience

**ALL UX patterns MUST be preserved:**

- **Navigation flow:** Same menu structure and page routing
- **Filtering and sorting:** Same filter options and sort orders
- **Modal dialogs:** Same decision dialogs with same fields
- **Error messages:** Same error handling and messaging
- **Loading states:** Same loading indicators
- **Empty states:** Same empty state messages
- **Success confirmations:** Same success toasts/notifications

**Key UX patterns to preserve:**
1. **Flag review workflow:** Open flag → Choose action → Enter reason → Submit
2. **TPH grid editing:** Click cell → Edit → Auto-save
3. **Status validation page:** Pending on top, decided below, same sorting
4. **My status page:** Same tab organization and data presentation
5. **Admin settings:** Same configuration structure and validation

## API Response Formats

**ALL API response formats MUST be preserved:**

```typescript
// Example: getProdReviewPage response
interface ReviewPageResponse {
  today: string                    // Format: "2026-10-30"
  pending: FlagView[]              // Same structure as current
  decided: FlagView[]              // Same structure as current
  disputes: DisputeView[]         // Empty array (disputes removed)
  statuses: string[]              // Same status choices
  reasonStatuses: string[]         // Same reason-requiring statuses
  rule: RuleView                  // Same rule view
  ticketUrl: string                // Same Freshdesk URL format
  isAdmin: boolean
  ready: boolean
  source: SourceView | null        // Same source view structure
}

interface FlagView {
  flagId: string
  date: string
  agentEmail: string
  agentName: string
  tlEmail: string
  tlName: string
  rawStatus: string
  intervalStart: string            // ISO timestamp
  intervalEnd: string              // ISO timestamp
  intervalMin: number
  flaggedMin: number
  spans: [string, string][]        // Same array format
  caseCount: number
  distinctCases: number
  cases: { id: string, channel: string }[]
  channelMix: Record<string, number>
  suggestedStatus: string
  decision: string                 // 'auto', 'accepted', 'reverted', 'pending', 'void'
  validatedStatus: string
  effectiveStatus: string
  decidedBy: string               // 'auto' or person name
  decidedAt: string                // ISO timestamp
  reason: string
  dueDate: string                  // Format: "2026-10-30"
  confidence_score: number          // NEW: 0-100
  confidence_level: string          // NEW: 'high', 'medium', 'low', 'very_low'
  confidence_factors: string[]      // NEW: factor descriptions
}
```

## Validation Plan

**To ensure exact preservation:**

1. **Unit tests for calculations:**
   - Extract calculation functions from GAS
   - Port to TypeScript
   - Write tests with same inputs, verify outputs match exactly

2. **Visual regression testing:**
   - Take screenshots of current GAS pages
   - Compare with new Next.js pages
   - Ensure colours, spacing, layout match exactly

3. **API contract testing:**
   - Capture API responses from GAS system
   - Compare with Supabase API responses
   - Ensure JSON structure and values match

4. **Data validation:**
   - Export data from Google Sheets
   - Export data from Supabase after migration
   - Compare row-by-row, column-by-column
   - Ensure zero data loss or transformation

5. **End-to-end testing:**
   - Run same user scenarios in both systems
   - Compare productivity calculations
   - Verify flag detection produces same results
   - Validate TPH calculations match
