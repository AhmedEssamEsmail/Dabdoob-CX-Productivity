# Complete Feature Inventory

## CRITICAL REQUIREMENT: Zero Feature Loss

**MANDATORY:** The migration MUST preserve ALL features, concepts, and functionality from the original CX Helm ecosystem. No feature may be omitted, simplified, or removed without explicit approval from the system owner.

The original project is a complete CX management ecosystem. The migration must include ALL systems.

## Complete System Inventory

### Core Systems to Migrate

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

## Complete Data Inventory

### All tables to migrate:

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

## Complete API Inventory

### All API endpoints to migrate:

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

## Complete Integration Inventory

### All external integrations to preserve:

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

## Complete UI/UX Inventory

### All pages and components to preserve:

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

## Complete Business Logic Inventory

### All calculations and rules to preserve:

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

## Validation: Zero Omission Checklist

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
