# Data Migration Requirements

## Overview
This document details what is needed to actually migrate data from the original Google Sheets/Google Apps Script system to the new Supabase-based system.

## Prerequisites

### 1. Google Credentials
You need access to the original Google Sheets and Google Apps Script project:

**Required:**
- [ ] Google account with access to the original productivity spreadsheet
- [ ] Google Service Account credentials (JSON key file) for programmatic access
- [ ] OR OAuth credentials if using user authentication flow

**How to obtain Google Service Account credentials:**
1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Sheets API and Google Drive API
4. Create a Service Account
5. Download the JSON key file
6. Share the Google Sheet with the service account email
7. Store the JSON key file securely (never commit to Git)

**Environment variables needed:**
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id
```

### 2. Source Spreadsheet Access
**Required:**
- [ ] Spreadsheet ID of the original productivity system
- [ ] Spreadsheet name: "CC2 Productivity" (or current name)
- [ ] Read access to all relevant sheets

**Sheets to migrate from:**
- `config` - Configuration values
- `roster` - User roster (email, name, role, TL email, country)
- `prod_intervals` - Productivity intervals
- `prod_flags` - Productivity flags
- `prod_flag_log` - Flag decision log
- `prod_daily_layers` - Daily productivity layers
- `prod_window_hist` - Window histogram (calibration data)
- `prod_flag_analytics` - Flag analytics
- `prod_quarterly_reports` - Quarterly reports
- `prod_tph_days` - TPH daily data
- `prod_tph_tasks` - TPH tasks
- `prod_tph_cases` - TPH cases
- `prod_tph_touches` - TPH touches
- `prod_tph_calls` - TPH calls
- `quality_audits` - Quality audits
- `fcr_daily` - FCR daily data
- `people` - People data
- `work_calendar` - Work calendar
- `tl_snapshots` - TL snapshots

### 3. Supabase Credentials
**Already configured:**
- [x] Supabase URL: `https://uugeyulccyytvgcabzzx.supabase.co`
- [x] Supabase anon key
- [x] Supabase service role key

**Stored in:** `.env.local` and Vercel environment variables

### 4. External Data Sources
**Freshdesk Integration:**
- [ ] Freshdesk API key
- [ ] Freshdesk subdomain
- [ ] Access to Freshdesk Activities log
- [ ] Access to Freshdesk Queue board
- [ ] Access to Freshdesk groups for case counting

**Freshchat Integration:**
- [ ] Freshchat API credentials
- [ ] Access to Freshchat conversation history

**Maqsam Integration:**
- [ ] Maqsam API credentials
- [ ] Access to call logs
- [ ] Access to call state data

**Gmail Integration:**
- [ ] Gmail API credentials
- [ ] Access to "Agents Activity" emails
- [ ] Read-only scope is sufficient

## Migration Process

### Step 1: Prepare Migration Environment
```bash
# Install dependencies (already done)
npm install

# Verify environment variables
# .env.local should contain:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_PRIVATE_KEY
# - GOOGLE_PROJECT_ID
```

### Step 2: Dry Run Migration
```bash
# Run dry-run to see what will be migrated
npx tsx migration/migrate-dry-run.ts
```

**Dry run will:**
- Read all data from Google Sheets
- Validate data structure
- Count records per sheet
- Show potential conflicts
- NOT write to Supabase

### Step 3: Review Dry Run Output
**Check:**
- [ ] Record counts match expectations
- [ ] No data validation errors
- [ ] No missing required fields
- [ ] No duplicate keys detected
- [ ] Date formats are correct
- [ ] Email addresses are valid

### Step 4: Execute Migration
```bash
# Run actual migration
npx tsx migration/migrate.ts
```

**Migration will:**
- Migrate config table
- Migrate roster table
- Migrate productivity tables (intervals, flags, layers, etc.)
- Migrate TPH tables
- Migrate quality tables
- Migrate FCR tables
- Migrate people, calendar, snapshots
- Log all operations
- Report any errors

### Step 5: Validate Migration
```bash
# Run validation script
npx tsx migration/validate.ts
```

**Validation checks:**
- [ ] Record counts match between source and destination
- [ ] Data integrity (no corruption)
- [ ] Foreign key relationships
- [ ] Index coverage
- [ ] Config values match
- [ ] Roster matches

### Step 6: Test Application
```bash
# Build and start application
npm run build
npm start

# Test in browser
# - Login with migrated users
# - View status validation
# - View my status
# - Check TPH grid
# - Verify analytics
```

## Data Mapping

### Config Table Mapping
| Google Sheet Column | Supabase Column | Notes |
|---------------------|------------------|-------|
| key | key | Primary key |
| value | value | JSON for complex values |
| description | description | - |
| updated_by | updated_by | Email |
| updated_at | updated_at | Timestamp |

### Roster Table Mapping
| Google Sheet Column | Supabase Column | Notes |
|---------------------|------------------|-------|
| email | email | Primary key |
| name | name | - |
| role | role | admin/tl/agent/specialist |
| tl_email | tl_email | Nullable |
| country | country | - |
| active | active | Boolean |
| submitted_by | submitted_by | Email |
| submitted_at | submitted_at | Timestamp |

### Productivity Intervals Mapping
| Google Sheet Column | Supabase Column | Notes |
|---------------------|------------------|-------|
| interval_key | interval_key | Primary key |
| date | date | Date key |
| agent_email | agent_email | Foreign key to roster |
| agent_name | agent_name | Denormalized |
| status | status | - |
| source_status | source_status | Original status |
| start_at | start_at | Timestamp |
| end_at | end_at | Timestamp |
| minutes | minutes | Calculated |
| source | source | CSV/FD_AUX |
| snapshot_at | snapshot_at | Timestamp |

### Productivity Flags Mapping
| Google Sheet Column | Supabase Column | Notes |
|---------------------|------------------|-------|
| flag_id | flag_id | Primary key |
| date | date | Date key |
| agent_email | agent_email | Foreign key |
| agent_name | agent_name | Denormalized |
| tl_email | tl_email | Nullable |
| raw_status | raw_status | - |
| interval_start | interval_start | Timestamp |
| interval_end | interval_end | Timestamp |
| interval_min | interval_min | - |
| spans_json | spans_json | JSON array |
| flagged_min | flagged_min | - |
| case_count | case_count | - |
| distinct_cases | distinct_cases | - |
| case_ids_json | case_ids_json | JSON array |
| channel_mix_json | channel_mix_json | JSON object |
| suggested_status | suggested_status | - |
| decision | decision | accept/reject/override |
| validated_status | validated_status | Final status |
| decided_by | decided_by | Email |
| decided_at | decided_at | Timestamp |
| reason | reason | Text |
| review_open_ms | review_open_ms | Milliseconds |
| due_date | due_date | Date |
| created_at | created_at | Timestamp |
| rule_json | rule_json | JSON object |
| updated_at | updated_at | Timestamp |
| confidence_score | confidence_score | 0-100 |
| confidence_level | confidence_level | high/medium/low |
| confidence_factors_json | confidence_factors_json | JSON object |

## Potential Issues & Solutions

### Issue 1: Large Dataset Size
**Problem:** Too many records to migrate in one batch
**Solution:**
- Implement batch processing (1000 records at a time)
- Use streaming for large tables
- Implement resume capability (track last migrated ID)

### Issue 2: Data Validation Errors
**Problem:** Some records fail validation
**Solution:**
- Log all validation errors to a file
- Continue migration for valid records
- Manual review of failed records
- Fix in source or skip with flag

### Issue 3: Google API Rate Limits
**Problem:** Google Sheets API has rate limits
**Solution:**
- Implement exponential backoff
- Use batch operations where possible
- Throttle requests
- Handle 429 errors gracefully

### Issue 4: Supabase Insert Failures
**Problem:** Some inserts fail due to constraints
**Solution:**
- Use upsert operations (ON CONFLICT DO NOTHING/UPDATE)
- Validate before insert
- Log failures for manual review
- Ensure indexes exist before migration

### Issue 5: Date/Time Format Mismatches
**Problem:** Google Sheets dates don't match Supabase format
**Solution:**
- Normalize all dates to ISO 8601
- Handle timezone conversions (Asia/Kuwait)
- Use consistent date parsing library
- Validate date ranges

### Issue 6: Email Case Sensitivity
**Problem:** Email addresses have inconsistent casing
**Solution:**
- Normalize all emails to lowercase
- Use case-insensitive comparison
- Update roster to use lowercase emails

## Post-Migration Tasks

### 1. Verify Data Integrity
```sql
-- Check record counts
SELECT COUNT(*) FROM config;
SELECT COUNT(*) FROM roster;
SELECT COUNT(*) FROM prod_intervals;
SELECT COUNT(*) FROM prod_flags;
-- etc for all tables
```

### 2. Rebuild Indexes
```sql
-- Rebuild indexes if needed
REINDEX TABLE prod_intervals;
REINDEX TABLE prod_flags;
-- etc
```

### 3. Update Statistics
```sql
-- Update PostgreSQL statistics
ANALYZE;
```

### 4. Test Application Functionality
- [ ] Login works with migrated users
- [ ] Status validation page loads
- [ ] My status page loads
- [ ] TPH grid loads
- [ ] Analytics display correctly
- [ ] Config values work

### 5. Run Scheduled Jobs
```bash
# Test scheduled jobs manually
curl -X POST https://dabdoob-cx-productivity.vercel.app/api/cron/flag-detection
curl -X POST https://dabdoob-cx-productivity.vercel.app/api/cron/analytics-aggregation
curl -X POST https://dabdoob-cx-productivity.vercel.app/api/cron/daily-layers
```

### 6. Compare with Original System
- [ ] Compare productivity percentages
- [ ] Compare flag counts
- [ ] Compare TPH numbers
- [ ] Compare quality scores
- [ ] Compare FCR rates

### 7. Enable External Integrations
- [ ] Configure Gmail integration
- [ ] Configure Freshdesk integration
- [ ] Configure Freshchat integration
- [ ] Configure Maqsam integration
- [ ] Test real-time data flow

## Rollback Plan

If migration fails or data is corrupted:

### Option 1: Database Restore
```bash
# Supabase CLI
supabase db restore -f backup-before-migration.sql
```

### Option 2: Table Truncate
```sql
-- Truncate all migrated tables
TRUNCATE TABLE prod_intervals CASCADE;
TRUNCATE TABLE prod_flags CASCADE;
TRUNCATE TABLE prod_daily_layers CASCADE;
-- etc
```

### Option 3: Keep Original Running
- Keep original Google Sheets system running
- Use new system in parallel
- Compare outputs before cutover

## Timeline Estimate

| Task | Estimate |
|------|----------|
| Obtain Google credentials | 1-2 days |
| Set up migration environment | 0.5 day |
| Dry run migration | 0.5 day |
| Review dry run output | 0.5 day |
| Execute migration | 1-2 days (depending on data size) |
| Validate migration | 1 day |
| Test application | 1 day |
| Post-migration tasks | 1-2 days |
| **Total** | **5-9 days** |

## Next Steps

To proceed with migration:

1. **Provide Google credentials:**
   - Share the Google Service Account JSON key file
   - Or provide OAuth credentials
   - Specify the spreadsheet ID

2. **Verify source data:**
   - Confirm which sheets exist in the spreadsheet
   - Confirm column names match expected structure
   - Confirm data volume (row counts)

3. **Run dry run:**
   - Execute dry-run migration
   - Review output
   - Fix any issues

4. **Schedule migration:**
   - Choose low-traffic time
   - Notify users of downtime
   - Have rollback plan ready

5. **Execute migration:**
   - Run migration script
   - Monitor progress
   - Validate results

6. **Cutover:**
   - Switch users to new system
   - Monitor for issues
   - Keep original available for fallback
