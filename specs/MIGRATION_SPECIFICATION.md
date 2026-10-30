# CX Helm Productivity Migration Technical Specification

## Executive Summary

This document specifies the complete migration of the CX Helm Productivity system from Google Sheets/Google Apps Script to a modern stack comprising:
- **Database:** Supabase (PostgreSQL)
- **Backend:** Next.js API Routes + Supabase Edge Functions
- **Frontend:** Next.js (React)
- **Hosting:** Vercel
- **Version Control:** GitHub
- **CI/CD:** GitHub Actions

**Migration Scope:** All functionality including productivity calculation, flagging, TPH, analytics, authentication, and integrations.

---

## 1. Architecture Overview

### Current Architecture (GAS)
```
Google Apps Script (Server)
├── Gmail Advanced Service (CSV import)
├── Google Sheets (Data store)
├── Triggers (Scheduled jobs)
└── Bundled HTML (Frontend)
```

### Target Architecture
```
GitHub Repository
├── Database: Supabase (PostgreSQL)
│   ├── Tables: prod_*, config, roster, view_as
│   ├── RLS Policies
│   └── Functions: triggers, procedures
├── Backend: Next.js API Routes
│   ├── /api/productivity/*
│   ├── /api/tph/*
│   ├── /api/config/*
│   └── /api/auth/*
├── Edge Functions: Supabase
│   ├── gmail-import
│   ├── freshdesk-sync
│   └── daily-report-sync
├── Frontend: Next.js App
│   ├── /status-validation
│   ├── /my-status
│   ├── /tph
│   └── /admin
└── Hosting: Vercel
    ├── Cron jobs (scheduled functions)
    └── Webhooks
```

---

## 2. Preservation Requirements

### 2.1 Business Logic & Calculations

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

### 2.2 Data Formats

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

### 2.3 UI Design & Colours

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

### 2.4 User Experience

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

### 2.5 API Response Formats

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

### 2.6 Validation Plan

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

---

## 2. Complete Feature Preservation

### 2.1 CRITICAL REQUIREMENT: Zero Feature Loss

**MANDATORY:** The migration MUST preserve ALL features, concepts, and functionality from the original CX Helm ecosystem. No feature may be omitted, simplified, or removed without explicit approval from the system owner.

The original project is a complete CX management ecosystem. The migration must include ALL systems:

### 2.2 Complete System Inventory

**Core Systems to Migrate:**

1. **Productivity System** (ProductivityApp.js, productivity.js, ProdValidation.js, ProdCore.js)
   - ✅ Status interval tracking
   - ✅ Flag detection and auto-accept with confidence scoring
   - ✅ Productivity calculation (raw and effective layers)
   - ✅ Flag review workflow (TL validation)
   - ✅ Flag analytics and monitoring dashboard
   - ✅ Quarterly audit reports
   - ✅ All productivity formulas and thresholds
   - ✅ Calibration histograms
   - ✅ Backfill functionality

2. **TPH System** (ProdTph.js)
   - ✅ TPH grid (daily slots)
   - ✅ Task management (add/edit/remove)
   - ✅ Cases tracking (Freshchat, internal, calls, waiting address)
   - ✅ Caps calculation
   - ✅ Activity sync from Freshchat and Maqsam
   - ✅ TPH analytics
   - ✅ TL editing permissions
   - ✅ Past data handling

3. **Quality System** (Quality.js - referenced in ecosystem)
   - ✅ Quality audits
   - ✅ Quality scores
   - ✅ Quality dispute workflow
   - ✅ Quality analytics
   - ✅ Quality trend reports

4. **FCR System** (Fcr.js - referenced in ecosystem)
   - ✅ First Contact Resolution tracking
   - ✅ FCR calculations
   - ✅ FCR thresholds and scoring
   - ✅ FCR analytics

5. **KPI Payout System** (KpiPayout.js)
   - ✅ KPI manual logs
   - ✅ OL case tracking
   - ✅ Unplanned leave rules
   - ✅ Payout calculations
   - ✅ Payout history

6. **Queue System** (QueueCore.js)
   - ✅ Queue board
   - ✅ Inflow tracking
   - ✅ Aging calculations
   - ✅ Queue health metrics
   - ✅ Queue snapshots
   - ✅ Group management

7. **People Management** (PeopleCore.js)
   - ✅ Roster management
   - ✅ Headcount tracking
   - ✅ Team structure
   - ✅ Manager assignments
   - ✅ Country assignments

8. **Work Calendar** (WorkCalendar.js)
   - ✅ Shift scheduling
   - ✅ Days off management
   - ✅ Weekly schedule
   - ✅ Country-specific schedules

9. **One-on-One Alerts** (OneOnOneAlerts.js)
   - ✅ One-on-one scheduling
   - ✅ Alert notifications
   - ✅ Tracking

10. **TL Snapshots** (TlSnapshots.js)
    - ✅ TL performance snapshots
    - ✅ TL analytics
    - ✅ TL reporting

11. **Mail System** (Mailer.js, Notify.js)
    - ✅ Email notifications
    - ✅ Email templates
    - ✅ Notification routing
    - ✅ Popup notifications (Popups.js)

12. **Hub Core** (Apps.js, Options.js)
    - ✅ Navigation rail
    - ✅ Bootstrap configuration
    - ✅ App routing
    - ✅ Core configuration

13. **View-As Functionality** (ViewAs.js)
    - ✅ Owner can view as any roster person
    - ✅ View-as state management
    - ✅ Read-only mode while viewing as
    - ✅ Audit trail

### 2.3 Complete Data Inventory

**All tables to migrate:**

**Productivity Tables:**
- prod_intervals
- prod_flags
- prod_flag_log
- prod_flag_analytics
- prod_quarterly_reports
- prod_daily_layers
- prod_window_hist

**TPH Tables:**
- prod_tph_days
- prod_tph_tasks
- prod_tph_cases
- prod_tph_touches
- prod_tph_calls

**Quality Tables:**
- qa_audits
- qa_flags
- qa_flag_log
- qa_daily
- qa_months

**FCR Tables:**
- fcr_daily
- fcr_weekly
- fcr_monthly

**KPI Tables:**
- kpi_logs
- kpi_ol_cases
- kpi_unplanned_leave

**Queue Tables:**
- agg_queue_now
- agg_inflow_daily
- agg_inflow_weekly
- agg_inflow_monthly
- agg_agent_perf
- agg_agent_daily
- agg_snapshots_today
- refresh_log

**People Tables:**
- roster
- headcount
- team_structure

**Work Calendar Tables:**
- schedule
- days_off
- weekly_schedule

**TL Tables:**
- tls
- tlp
- md (mail desk)

**Core Tables:**
- config
- view_as
- tickets
- esc_seen
- sc_daily
- sc_behaviour
- sc_months

### 2.4 Complete API Inventory

**All API endpoints to migrate:**

**Productivity APIs:**
- getProdReviewPage
- getProdFlag
- decideProdFlag
- getProdMyPage
- getProdAnalytics
- getProdFlagAnalytics

**TPH APIs:**
- getTPHGrid
- saveTPHTask
- deleteTPHTask
- getTPHCases
- getTPHAnalytics

**Quality APIs:**
- getQAReviewPage
- getQAFlag
- decideQAFlag
- getQAMyPage
- getQAAnalytics

**Config APIs:**
- configRows
- saveConfigSetting
- configAll

**Core APIs:**
- getBootstrap
- getViewAsState
- startViewAs
- stopViewAs

**Health APIs:**
- getHealth

**Job APIs:**
- jobProductivityDaily
- jobQuarterlyReport
- TPH jobs
- Queue jobs
- etc.

### 2.5 Complete Integration Inventory

**All external integrations to preserve:**

1. **Gmail Integration**
   - Gmail Advanced Service → Gmail API
   - CSV attachment parsing
   - "Agents Activity" email query
   - Same timing and scheduling

2. **Freshdesk Integration**
   - Freshdesk API calls
   - Ticket sync
   - Activity log spreadsheet
   - Domain: dabdoobapp.freshdesk.com
   - Full sync start date

3. **Freshchat Integration**
   - Freshchat data import
   - Daily report spreadsheet
   - Chat activity tracking

4. **Maqsam Integration**
   - Maqsam call data
   - Daily report spreadsheet
   - Call state filtering

5. **Google Sheets Integration**
   - All source spreadsheets (read-only)
   - CC2 Productivity spreadsheet
   - CC2 Core spreadsheet
   - CC2 Live spreadsheet
   - CC2 Data spreadsheets (yearly)
   - CC2 Quality spreadsheet

### 2.6 Complete UI/UX Inventory

**All pages and components to preserve:**

**Main Navigation Rail:**
- Productivity
- Status Validation
- My Status
- TPH and Caps
- Quality
- FCR
- KPI Payouts
- Queue
- People
- Work Calendar
- Hub Admin
- Settings

**Productivity Pages:**
- Status Validation (TL/Admin)
- My Status (Agent)
- Productivity Analytics

**TPH Pages:**
- TPH Grid
- TPH Analytics

**Quality Pages:**
- Quality Review
- My Quality
- Quality Analytics

**FCR Pages:**
- FCR Dashboard
- FCR Analytics

**KPI Pages:**
- KPI Payouts
- OL Cases
- Unplanned Leave

**Queue Pages:**
- Queue Board
- Inflow
- Aging
- Agent Performance

**People Pages:**
- Roster
- Headcount
- Teams

**Work Calendar Pages:**
- Schedule
- Days Off

**Admin Pages:**
- Settings
- Triggers
- Health
- View As

### 2.7 Complete Business Logic Inventory

**All calculations and rules to preserve:**

**Productivity Calculations:**
- Weighted scoring (35/35/15/15)
- All threshold bands
- Flag detection rules
- Confidence scoring
- Effective layer adjustment
- OL case penalty
- Unplanned leave rule

**TPH Calculations:**
- Cap formulas
- Slot calculations
- Case counting rules
- Channel aggregation
- Call minute blending

**Quality Calculations:**
- Quality scoring
- Quality thresholds
- QA flagging rules

**FCR Calculations:**
- FCR scoring
- FCR thresholds
- Resolution tracking

**KPI Calculations:**
- Payout formulas
- OL case deductions
- Unplanned leave handling

**Queue Calculations:**
- Inflow calculations
- Aging band calculations
- Queue health metrics
- Agent performance metrics

### 2.8 Validation: Zero Omission Checklist

**Before migration approval, verify:**

- [ ] All JS files have been reviewed for features
- [ ] All database tables have been inventoried
- [ ] All API endpoints have been listed
- [ ] All external integrations have been documented
- [ ] All UI pages have been mapped
- [ ] All business logic rules have been captured
- [ ] All configuration settings have been recorded
- [ ] All scheduled jobs have been identified
- [ ] All notification types have been listed
- [ ] All user roles and permissions have been documented

**Migration will be rejected if ANY feature is omitted.**

---

## 3. Database Schema Design

### 2.1 Core Productivity Tables

```sql
-- Agent status intervals
CREATE TABLE prod_intervals (
  interval_key TEXT PRIMARY KEY,
  date DATE NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  status TEXT NOT NULL,
  source_status TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  minutes NUMERIC NOT NULL,
  source TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flagged IDLE intervals
CREATE TABLE prod_flags (
  flag_id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  tl_email TEXT,
  raw_status TEXT NOT NULL,
  interval_start TIMESTAMPTZ NOT NULL,
  interval_end TIMESTAMPTZ NOT NULL,
  interval_min NUMERIC NOT NULL,
  spans_json JSONB,
  flagged_min NUMERIC NOT NULL,
  case_count INTEGER,
  distinct_cases INTEGER,
  case_ids_json JSONB,
  channel_mix_json JSONB,
  suggested_status TEXT NOT NULL,
  decision TEXT NOT NULL, -- 'auto', 'accepted', 'reverted', 'pending', 'void'
  validated_status TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  reason TEXT,
  review_open_ms INTEGER,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL,
  rule_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score INTEGER,
  confidence_level TEXT,
  confidence_factors_json JSONB
);

-- Audit trail
CREATE TABLE prod_flag_log (
  log_id TEXT PRIMARY KEY,
  flag_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'detected', 'auto-accepted', 'accepted', 'reverted', 'void'
  from_status TEXT,
  to_status TEXT,
  by TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily productivity layers
CREATE TABLE prod_daily_layers (
  id SERIAL PRIMARY KEY,
  layer TEXT NOT NULL, -- 'raw' or 'effective'
  email TEXT NOT NULL,
  date DATE NOT NULL,
  available_min NUMERIC,
  idle_min NUMERIC,
  inbound_calls_min NUMERIC,
  chats_min NUMERIC,
  waiting_address_min NUMERIC,
  offline_min NUMERIC,
  flagged_min NUMERIC,
  effective_idle_min NUMERIC,
  productivity_pct NUMERIC,
  -- ... all 26 computed fields
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(layer, email, date)
);

-- Calibration histogram
CREATE TABLE prod_window_hist (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  class TEXT NOT NULL, -- 'idle' or 'working'
  windows INTEGER NOT NULL,
  counts_json JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, class)
);

-- Flag analytics (monitoring)
CREATE TABLE prod_flag_analytics (
  date DATE NOT NULL,
  agent_email TEXT NOT NULL,
  total_flags INTEGER NOT NULL,
  auto_accepted INTEGER NOT NULL,
  total_flagged_min NUMERIC NOT NULL,
  avg_cases_per_flag NUMERIC NOT NULL,
  most_common_raw_status TEXT,
  most_common_suggested_status TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (date, agent_email)
);

-- Quarterly reports
CREATE TABLE prod_quarterly_reports (
  report_id TEXT PRIMARY KEY,
  quarter TEXT NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4'
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  report_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 TPH Tables

```sql
-- TPH daily slots
CREATE TABLE prod_tph_days (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  agent_email TEXT NOT NULL,
  slots_json JSONB NOT NULL,
  sources_json JSONB NOT NULL,
  by TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  UNIQUE(date, agent_email)
);

-- TPH tasks
CREATE TABLE prod_tph_tasks (
  task_id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  agent_email TEXT NOT NULL,
  channel TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  by TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  removed BOOLEAN DEFAULT FALSE
);

-- TPH cases
CREATE TABLE prod_tph_cases (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  cases_json JSONB NOT NULL,
  by TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  UNIQUE(date, source)
);

-- TPH touches
CREATE TABLE prod_tph_touches (
  date DATE PRIMARY KEY,
  touches_json JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- TPH calls
CREATE TABLE prod_tph_calls (
  date DATE PRIMARY KEY,
  calls_json JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Configuration Tables

```sql
-- System configuration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roster
CREATE TABLE roster (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin', 'tl', 'agent', 'specialist'
  tl_email TEXT,
  country TEXT,
  active BOOLEAN DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- View-as state
CREATE TABLE view_as (
  id SERIAL PRIMARY KEY,
  owner_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'start' or 'stop'
  target_email TEXT,
  app TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Indexes

```sql
CREATE INDEX idx_prod_intervals_date_email ON prod_intervals(date, agent_email);
CREATE INDEX idx_prod_flags_date_email ON prod_flags(date, agent_email);
CREATE INDEX idx_prod_flags_decision ON prod_flags(decision);
CREATE INDEX idx_prod_flag_log_flag_id ON prod_flag_log(flag_id);
CREATE INDEX idx_prod_daily_layers_layer_email_date ON prod_daily_layers(layer, email, date);
CREATE INDEX idx_prod_flag_analytics_date ON prod_flag_analytics(date);
CREATE INDEX idx_prod_tph_touches_date ON prod_tph_touches(date);
CREATE INDEX idx_config_key ON config(key);
```

---

## 3. Authentication & Authorization

### 3.1 Supabase Auth Setup

**Provider:** Email/Password + Google OAuth (optional)

**Schema Extensions:**
```sql
-- Add custom claims to auth.users via metadata
ALTER TABLE auth.users 
ADD COLUMN role TEXT DEFAULT 'agent',
ADD COLUMN tl_email TEXT,
ADD COLUMN country TEXT;
```

**JWT Claims:**
```typescript
interface JWTPayload {
  role: 'admin' | 'tl' | 'agent' | 'specialist' | 'unknown'
  email: string
  tl_email?: string
  country?: string
}
```

### 3.2 Row-Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE prod_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_daily_layers ENABLE ROW LEVEL SECURITY;
-- ... enable for all tables

-- Admin can access everything
CREATE POLICY "Admin full access" ON prod_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.role = 'admin'
    )
  );

-- TL can access their team
CREATE POLICY "TL team access" ON prod_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u, roster r
      WHERE u.id = auth.uid()
      AND u.role = 'tl'
      AND u.email = r.email
      AND prod_flags.agent_email IN (
        SELECT email FROM roster WHERE tl_email = u.email
      )
    )
  );

-- Agent can access own data
CREATE POLICY "Agent own access" ON prod_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = prod_flags.agent_email
    )
  );
```

### 3.3 Middleware Implementation

```typescript
// middleware.ts
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect to login if no session
  if (!session && !req.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Check role-based access
  if (session) {
    const { data: user } = await supabase
      .from('roster')
      .select('role')
      .eq('email', session.user.email)
      .single()
    
    const requiredRole = getRequiredRole(req.nextUrl.pathname)
    if (!hasRole(user.role, requiredRole)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  return res
}

function getRequiredRole(pathname: string): string {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/status-validation')) return 'tl'
  return 'agent'
}
```

---

## 4. API Design

### 4.1 API Structure

```
/api/auth/
  ├── POST /login
  ├── POST /logout
  ├── POST /register
  └── GET /user

/api/productivity/
  ├── GET /flags [admin, tl, agent]
  ├── GET /flags/:id [admin, tl, agent]
  ├── POST /flags/:id/decide [admin, tl]
  ├── GET /review-page [admin, tl]
  ├── GET /my-page [admin, tl, agent]
  ├── GET /analytics [admin, tl]
  ├── POST /detect
  ├── POST /aggregate
  └── GET /flag-analytics [admin]

/api/tph/
  ├── GET /grid [admin, tl]
  ├── POST /tasks [admin, tl]
  ├── PUT /tasks/:id [admin, tl]
  ├── DELETE /tasks/:id [admin, tl]
  ├── GET /cases [admin, tl]
  └── GET /analytics [admin, tl]

/api/config/
  ├── GET /settings [admin]
  ├── PUT /settings/:key [admin]
  └── GET /settings/:key [admin, tl, agent]

/api/admin/
  ├── POST /setup [admin]
  ├── POST /install-triggers [admin]
  ├── POST /import-email [admin]
  └── POST /backfill [admin]
```

### 4.2 Example API Routes

**Status Validation Page:**
```typescript
// app/api/productivity/review-page/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user role
  const { data: userData } = await supabase
    .from('roster')
    .select('role, tl_email')
    .eq('email', user.email)
    .single()

  if (!['admin', 'tl'].includes(userData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  // Build query based on role
  let flagsQuery = supabase
    .from('prod_flags')
    .select('*')
    .neq('decision', 'void')
    .gte('date', thirtyDaysAgo)

  if (userData.role === 'tl') {
    // Filter by team
    const { data: team } = await supabase
      .from('roster')
      .select('email')
      .eq('tl_email', user.email)
    
    const teamEmails = team.map(r => r.email)
    flagsQuery = flagsQuery.in('agent_email', teamEmails)
  }

  const { data: flags } = await flagsQuery

  // Transform to view format
  const pending = flags
    .filter(f => f.decision === 'pending')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(transformFlagView)

  const decided = flags
    .filter(f => f.decision !== 'pending' && f.date >= thirtyDaysAgo)
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at))
    .slice(0, 150)
    .map(transformFlagView)

  return NextResponse.json({
    today,
    pending,
    decided,
    disputes: [], // Empty since disputes removed
    statuses: await getStatusChoices(supabase),
    reasonStatuses: await getReasonStatuses(supabase),
    rule: await getRuleView(supabase),
    isAdmin: userData.role === 'admin',
    ready: true
  })
}
```

---

## 5. Frontend Architecture

### 5.1 Next.js App Structure

```
app/
├── auth/
│   ├── login/page.tsx
│   ├── logout/page.tsx
│   └── register/page.tsx
├── status-validation/
│   ├── page.tsx
│   ├── components/
│   │   ├── FlagList.tsx
│   │   ├── FlagDetail.tsx
│   │   └── DecisionDialog.tsx
│   └── hooks/
│       └── useFlags.ts
├── my-status/
│   ├── page.tsx
│   └── components/
│       └── MyFlags.tsx
├── tph/
│   ├── page.tsx
│   └── components/
│       ├── TPHGrid.tsx
│       └── TaskForm.tsx
├── admin/
│   ├── page.tsx
│   ├── settings/page.tsx
│   └── setup/page.tsx
├── layout.tsx
├── page.tsx
└── globals.css
```

### 5.2 Component Example

```typescript
// app/status-validation/components/FlagList.tsx
'use client'

import { useFlags } from '../hooks/useFlags'
import { FlagCard } from './FlagCard'

export function FlagList() {
  const { flags, loading, error } = useFlags()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="space-y-4">
      {flags.map(flag => (
        <FlagCard key={flag.flagId} flag={flag} />
      ))}
    </div>
  )
}
```

### 5.3 Data Fetching Hook

```typescript
// app/status-validation/hooks/useFlags.ts
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function useFlags() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function fetchFlags() {
      try {
        const { data, error } = await supabase
          .from('prod_flags')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) throw error
        setFlags(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFlags()
  }, [supabase])

  return { flags, loading, error }
}
```

---

## 6. Scheduled Jobs (Cron)

### 6.1 Gmail Import Job

**Current:** Trigger fires at 08:30 Kuwait, reads Gmail attachment

**New:** Vercel Cron + Supabase Edge Function

```typescript
// app/api/cron/gmail-import/route.ts
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
  maxDuration: 300,
}

export default async function handler(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Call Edge Function for Gmail import
  const { data, error } = await supabase.functions.invoke('gmail-import', {
    body: { date: new Date().toISOString().split('T')[0] }
  })

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true, rows: data.rowsOut }))
}
```

**Vercel Cron Configuration:**
```json
{
  "crons": [
    {
      "path": "/api/cron/gmail-import",
      "schedule": "30 5 * * *" // 08:30 Kuwait = 05:30 UTC
    }
  ]
}
```

### 6.2 Edge Function: Gmail Import

```typescript
// supabase/functions/gmail-import/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

serve(async (req) => {
  const { date } = await req.json()
  
  // Gmail API call using OAuth
  const gmailToken = await getGmailToken()
  const messages = await fetchGmailMessages(gmailToken, 'subject:"Agents Activity" has:attachment')
  
  if (!messages.length) {
    return new Response(JSON.stringify({ skipped: 'No matching emails' }))
  }

  const latestMessage = messages[0]
  const attachment = await fetchAttachment(gmailToken, latestMessage.id, latestMessage.attachmentId)
  
  // Parse CSV
  const intervals = parseCSV(attachment)
  
  // Upsert to Supabase
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  
  const { error } = await supabase
    .from('prod_intervals')
    .upsert(intervals, { onConflict: 'interval_key' })
  
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  return new Response(JSON.stringify({ rowsOut: intervals.length }))
})
```

### 6.3 Other Scheduled Jobs

```typescript
// Flag detection (after Gmail import)
{
  "path": "/api/cron/detect-flags",
  "schedule": "0 6 * * *" // 09:00 Kuwait
}

// Flag analytics aggregation
{
  "path": "/api/cron/aggregate-flags",
  "schedule": "0 6 * * *"
}

// Quarterly reports (1st of month at 00:00 UTC)
{
  "path": "/api/cron/quarterly-report",
  "schedule": "0 0 1 * *"
}

// TPH sync (every 15 minutes)
{
  "path": "/api/cron/tph-sync",
  "schedule": "*/15 * * * *"
}
```

---

## 7. External Integrations

### 7.1 Gmail Integration

**Challenge:** No direct equivalent to Gmail Advanced Service

**Solution:** Gmail API with OAuth 2.0

**Implementation:**
1. Create Google Cloud Project
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Store refresh token in Supabase secrets
5. Use Edge Function to call Gmail API

**Code:**
```typescript
async function getGmailToken(): Promise<string> {
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN')
  const clientId = Deno.env.get('GMAIL_CLIENT_ID')
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  })
  
  const { access_token } = await response.json()
  return access_token
}
```

### 7.2 Freshdesk Integration

**Current:** Direct API calls from GAS

**New:** Edge Functions with Freshdesk API

```typescript
// supabase/functions/freshdesk-sync/index.ts
const FRESHDESK_DOMAIN = Deno.env.get('FRESHDESK_DOMAIN')
const FRESHDESK_API_KEY = Deno.env.get('FRESHDESK_API_KEY')

serve(async (req) => {
  const response = await fetch(`https://${FRESHDESK_DOMAIN}/api/v2/tickets`, {
    headers: {
      'Authorization': `Basic ${btoa(FRESHDESK_API_KEY + ':x')}`
    }
  })
  
  const tickets = await response.json()
  
  // Sync to Supabase
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  // ... sync logic
  
  return new Response(JSON.stringify({ synced: tickets.length }))
})
```

### 7.3 Freshchat/Maqsam Integration

**Current:** Spreadsheet imports

**New:** Option A - Keep spreadsheet + sync to Supabase, Option B - Direct API

**Recommended:** Keep spreadsheet for data collection, sync to Supabase via cron job

```typescript
// Edge Function to sync spreadsheet to Supabase
async function syncSpreadsheet(spreadsheetId: string, sheetName: string, tableName: string) {
  const data = await fetchSpreadsheetData(spreadsheetId, sheetName)
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  
  await supabase
    .from(tableName)
    .upsert(data, { onConflict: 'date,agent_email' })
}
```

---

## 8. Data Migration Strategy

### 8.1 Migration Script

```typescript
// scripts/migrate.ts
import { createClient } from '@supabase/supabase-js'
import { GoogleSpreadsheet } from 'google-spreadsheet'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateIntervals() {
  const doc = new GoogleSpreadsheet(process.env.PRODUCTIVITY_SS_ID)
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
  })
  
  const sheet = doc.sheetsByTitle['prod_intervals']
  const rows = await sheet.getRows()
  
  const intervals = rows.map(row => ({
    interval_key: row.interval_key,
    date: row.date,
    agent_email: row.agent_email,
    // ... map all fields
  }))
  
  const { error } = await supabase
    .from('prod_intervals')
    .upsert(intervals, { onConflict: 'interval_key' })
  
  if (error) console.error('Migration failed:', error)
  else console.log(`Migrated ${intervals.length} intervals`)
}

async function migrateAll() {
  await migrateIntervals()
  await migrateFlags()
  await migrateFlagLog()
  await migrateDailyLayers()
  await migrateTPH()
  // ... migrate all tables
}

migrateAll()
```

### 8.2 Migration Execution Plan

1. **Pre-migration validation**
   - Backup all Google Sheets
   - Record row counts in each table
   - Verify Supabase project is empty

2. **Dry run**
   - Run migration script with write disabled
   - Validate data transformations
   - Check for data loss or corruption

3. **Actual migration**
   - Migrate static tables first (config, roster)
   - Migrate historical data (intervals, flags)
   - Migrate analytics (daily_layers, window_hist)
   - Validate row counts match

4. **Post-migration validation**
   - Compare aggregate statistics
   - Run sample queries
   - Verify data integrity

5. **Parallel run**
   - Keep GAS system running
   - Run Supabase system in parallel
   - Compare outputs
   - Fix discrepancies

---

## 9. Deployment Strategy

### 9.1 GitHub Repository Structure

```
cx-helm-productivity/
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── test.yml
├── app/                      # Next.js app
├── supabase/
│   ├── functions/            # Edge Functions
│   ├── migrations/           # SQL migrations
│   └── seed.sql             # Initial data
├── scripts/
│   ├── migrate.ts            # Data migration
│   └── sync-sheet.ts         # Spreadsheet sync
├── public/
├── components/               # Shared components
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   └── utils.ts
├── .env.local
├── .env.example
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### 9.2 GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 9.3 Environment Variables

**Required in Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
FRESHDESK_DOMAIN=
FRESHDESK_API_KEY=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
PRODUCTIVITY_SS_ID=
DAILY_REPORT_SS_ID=
```

**Required in Supabase:**
```
CRON_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

---

## 10. Security Considerations

### 10.1 Authentication Flow

```
1. User visits /auth/login
2. Enters email/password
3. Supabase Auth validates credentials
4. JWT token issued with custom claims (role, tl_email, country)
5. Token stored in httpOnly cookie
6. Subsequent requests include token
7. Middleware validates token and checks role
8. RLS policies enforce database access
```

### 10.2 Secrets Management

**Store in Supabase Edge Secrets:**
- Gmail OAuth credentials
- Freshdesk API key
- Database service role key
- Cron secret

**Store in Vercel Environment Variables:**
- Supabase anon key
- Google service account credentials (for migration only)

### 10.3 API Security

```typescript
// Rate limiting
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s')
})

export async function GET(req: NextRequest) {
  const ip = req.ip || '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return new Response('Too many requests', { status: 429 })
  }
  // ... rest of handler
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// __tests__/flag-detection.test.ts
import { detectFlags } from '../lib/flag-detection'

describe('Flag Detection', () => {
  it('should flag IDLE with 2+ cases in 10 min window', () => {
    const intervals = [
      { agentEmail: 'test@test.com', status: 'IDLE', startMs: 0, endMs: 600000 }
    ]
    const cases = [
      { agentEmail: 'test@test.com', timestamp: 180000, ticketId: '123' },
      { agentEmail: 'test@test.com', timestamp: 300000, ticketId: '456' }
    ]
    
    const flags = detectFlags(intervals, cases, { x: 2, windowMin: 10 })
    
    expect(flags).toHaveLength(1)
    expect(flags[0].distinctCases).toBe(2)
  })
})
```

### 11.2 Integration Tests

```typescript
// __tests__/api/review-page.test.ts
import { GET } from '@/app/api/productivity/review-page/route'

describe('Review Page API', () => {
  it('should return flags for TL', async () => {
    const req = new Request('http://localhost:3000/api/productivity/review-page', {
      headers: { Authorization: 'Bearer mock-tl-token' }
    })
    
    const res = await GET(req)
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.pending).toBeInstanceOf(Array)
  })
})
```

### 11.3 E2E Tests

```typescript
// e2e/status-validation.spec.ts
import { test, expect } from '@playwright/test'

test('TL can review flags', async ({ page }) => {
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', 'tl@test.com')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')
  
  await page.goto('/status-validation')
  await expect(page.locator('h1')).toContainText('Status Validation')
  
  await page.click('[data-testid="flag-1"]')
  await page.click('button:has-text("Accept")')
  await page.selectOption('select[name="status"]', 'Available')
  await page.click('button:has-text("Submit")')
  
  await expect(page.locator('text=Flag accepted')).toBeVisible()
})
```

---

## 12. Rollback Plan

### 12.1 Rollback Triggers

**Immediate rollback if:**
- Critical bug preventing productivity calculation
- Data corruption detected
- Security vulnerability discovered
- Performance degradation > 50%

### 12.2 Rollback Procedure

1. **Switch back to GAS system:**
   - Redirect traffic to GAS web app URL
   - Stop Vercel deployment
   - Disable cron jobs

2. **Data rollback:**
   - Export Supabase data to CSV
   - Import back to Google Sheets
   - Resume GAS operations

3. **Communication:**
   - Notify all users of rollback
   - Provide estimated downtime
   - Document root cause

### 12.3 Rollback Testing

**Before cutover:**
- Practice rollback procedure
- Verify data export/import works
- Test GAS system still functional

---

## 13. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Implement RLS policies
- [ ] Set up authentication
- [ ] Initialize Next.js project
- [ ] Configure Vercel deployment
- [ ] Set up GitHub repository

### Phase 2: Backend Core (Weeks 4-7)
- [ ] Implement API routes for productivity
- [ ] Implement API routes for TPH
- [ ] Implement config API
- [ ] Implement auth middleware
- [ ] Set up Gmail integration (Edge Function)
- [ ] Set up Freshdesk integration (Edge Function)
- [ ] Implement cron jobs structure

### Phase 3: Data Migration (Weeks 8-9)
- [ ] Write migration scripts
- [ ] Test migration with dry run
- [ ] Execute data migration
- [ ] Validate data integrity
- [ ] Compare aggregate statistics

### Phase 4: Frontend (Weeks 10-12)
- [ ] Convert status validation page
- [ ] Convert my status page
- [ ] Convert TPH grid
- [ ] Convert admin pages
- [ ] Implement auth UI
- [ ] Implement responsive design

### Phase 5: Testing (Weeks 13-14)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance testing
- [ ] Security audit

### Phase 6: Parallel Run (Weeks 15-16)
- [ ] Deploy to production (read-only)
- [ ] Compare outputs with GAS system
- [ ] Fix discrepancies
- [ ] Gather user feedback

### Phase 7: Cutover (Week 17)
- [ ] Switch to write mode
- [ ] Enable cron jobs
- [ ] Disable GAS triggers
- [ ] Monitor for issues
- [ ] Support users

### Phase 8: Decommission (Week 18)
- [ ] Archive GAS project
- [ ] Clean up Google Sheets
- [ ] Document lessons learned
- [ ] Celebrate! 🎉

---

## 14. Cost Estimation

### 14.1 Supabase (Free Tier)
- Database: 500MB storage
- API calls: 50,000/month
- Edge Functions: 500,000 invocations/month
- Bandwidth: 1GB
- **Cost: $0/month**

### 14.2 Vercel (Pro Tier)
- Bandwidth: 1TB
- Serverless Functions: 1000GB-hrs
- Edge Network: 100GB
- Cron Jobs: Unlimited
- **Cost: $20/month**

### 14.3 Gmail API
- Free tier sufficient for daily usage
- **Cost: $0/month**

### 14.4 Freshdesk API
- Depends on Freshdesk plan
- **Cost: Included in Freshdesk subscription**

### 14.5 Total Monthly Cost
**Estimated: $20/month** (Vercel Pro only)

---

## 15. Risk Assessment

### 15.1 High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Gmail API limits | High | Medium | Use service account, implement queuing |
| Cron job reliability | High | Low | Backup with external cron service |
| Data migration errors | High | Medium | Extensive testing, dry runs, parallel run |
| View-as implementation | Medium | High | Simplify or deprecate initially |
| Freshdesk API changes | Medium | Low | Version API calls, monitor for breaking changes |

### 15.2 Medium Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| RLS policy complexity | Medium | Medium | Thorough testing, start with simpler policies |
| Frontend performance | Medium | Low | Use Next.js optimization, lazy loading |
| Edge Function cold starts | Low | Medium | Implement warming cron calls |
| Authentication migration | Medium | Low | Support both systems during transition |

---

## 16. Success Criteria

### 16.1 Functional Requirements
- [ ] All current features work identically
- [ ] Auto-accept with confidence scoring works
- [ ] Monitoring dashboard functional
- [ ] Quarterly reports generate correctly
- [ ] TPH grid operates normally
- [ ] Analytics match GAS system within 1%

### 16.2 Non-Functional Requirements
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] 99.9% uptime
- [ ] Zero data loss during migration
- [ ] All data migrated accurately
- [ ] Security audit passed

### 16.3 User Acceptance
- [ ] TLs can review flags without training
- [ ] Agents can view their status intuitively
- [ ] Admins can manage settings easily
- [ ] No degradation in productivity calculation accuracy

---

## 17. Appendix

### 17.1 Technology Stack Details

**Database:**
- PostgreSQL 15 (via Supabase)
- pg_auth for authentication
- pg_cron for scheduled tasks (alternative to Vercel cron)
- pgvector (future: AI features)

**Backend:**
- Next.js 14 (App Router)
- TypeScript 5
- Supabase JS Client v2
- Supabase Auth Helpers Next.js
- Edge Functions (Deno runtime)

**Frontend:**
- React 18
- Tailwind CSS 3
- shadcn/ui components
- React Query for data fetching
- Zustand for state management

**DevOps:**
- GitHub Actions for CI/CD
- Vercel for hosting
- Supabase for database
- Gmail API for email integration

### 17.2 Open Questions

1. **View-as functionality:** Should we keep this complex feature or simplify it?
2. **Gmail OAuth:** Should we use service account or individual user OAuth?
3. **Spreadsheet sync:** Should we maintain spreadsheet sync or move to direct API?
4. **Timeline:** Can we allocate 18 weeks, or do we need a faster timeline?
5. **Budget:** Is $20/month acceptable, or do we need to optimize further?

### 17.3 Decision Log

| Decision | Date | Reason |
|----------|------|--------|
| Use Supabase over other DBs | - | Built-in auth, RLS, Edge Functions |
| Use Next.js over other frameworks | - | Full-stack, Vercel integration, great DX |
| Keep spreadsheet sync for Freshchat/Maqsam | - | Less risky, existing data flow works |
| Deprecate View-as initially | - | Complex to reimplement, low usage |
| Use Vercel Cron over pg_cron | - | Easier integration with Next.js |

---

## 18. Next Steps

1. **Review this specification** with stakeholders
2. **Answer open questions** in Appendix 17.2
3. **Get approval** for budget and timeline
4. **Set up GitHub repository** with initial structure
5. **Create Supabase project** and start schema design
6. **Begin Phase 1 implementation**

---

**Document Version:** 1.0  
**Last Updated:** 2026-10-30  
**Author:** Migration Team  
**Status:** Draft - Pending Review
