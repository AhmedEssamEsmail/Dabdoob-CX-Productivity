# Migration Readiness Checklist

## ✅ What We Have

### 1. Google Sheet ID
- **Sheet ID:** `1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs`
- **Sheet Name:** CC2 Core

### 2. Vercel Environment Variables (Production)
✅ **All Required Credentials Present:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Google Service Account email
- `GOOGLE_PRIVATE_KEY` - Google Service Account private key
- `GOOGLE_PROJECT_ID` - Google Cloud Project ID
- `GOOGLE_SHEET_ID` - Google Sheet ID (just added)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase anon key
- `FRESHDESK_DOMAIN`, `FRESHDESK_API_KEY` - Freshdesk credentials
- `FRESHCHAT_API_KEY`, `FRESHCHAT_DOMAIN` - Freshchat credentials
- `MAQSAM_API_KEY`, `MAQSAM_API_SECRET`, `MAQSAM_DOMAIN` - Maqsam credentials

### 3. Migration Scripts Ready
- ✅ `migration/validate.ts` - Validation script
- ✅ `migration/migrate-dry-run.ts` - Dry run script
- ✅ `migration/migrate.ts` - Full migration script
- ✅ `migration/migrate-lib.ts` - Library with auth setup

### 4. Supabase Database
- ✅ 47 tables created
- ✅ All required tables exist (config, roster, prod_*, tph_*, quality, fcr)
- ✅ RLS policies configured
- ✅ Indexes created

---

## 🔴 What's Needed

### To Run Migration Locally

**Option 1: Manual Environment Setup**

Create a `.env.local` file with these values (get them from Vercel dashboard or Google Cloud Console):

```env
# Google Sheets (REQUIRED for migration)
GOOGLE_SHEET_ID=1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Supabase (already in .env.local or Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://uugeyulccyytvgcabzzx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Option 2: Run Migration on Vercel**

Deploy the migration as a serverless function or Edge Function that can access Vercel environment variables.

**Option 3: Use Google Cloud Credentials**

Download the service account JSON key file and use it directly:

```typescript
// Alternative auth method
const credentials = require('./service-account-key.json')
await doc.useServiceAccountAuth(credentials)
```

---

## 📋 Migration Steps

### Step 1: Validate Environment
```bash
npx tsx migration/validate.ts
```

### Step 2: Dry Run
```bash
npx tsx migration/migrate-dry-run.ts
```

**Expected output:**
```
✓ Config sheet: X rows
✓ Roster sheet: X rows
✓ Prod Intervals sheet: X rows
✓ Prod Flags sheet: X rows
```

### Step 3: Review Dry Run
- Check all sheets are found
- Verify row counts are reasonable
- Check for any validation errors

### Step 4: Run Migration
```bash
npx tsx migration/migrate.ts
```

### Step 5: Verify Migration
- Check Supabase dashboard
- Compare record counts
- Test application functionality

---

## 🗂️ Tables to Migrate

### Core Tables
- ✅ `config` - Configuration values
- ✅ `roster` - User roster

### Productivity Tables
- ✅ `prod_intervals` - Status intervals
- ✅ `prod_flags` - Productivity flags
- ✅ `prod_flag_log` - Flag decision log
- ✅ `prod_daily_layers` - Daily productivity layers
- ✅ `prod_window_hist` - Window histogram
- ✅ `prod_flag_analytics` - Flag analytics
- ✅ `prod_quarterly_reports` - Quarterly reports

### TPH Tables
- ✅ `prod_tph_days` - TPH daily data
- ✅ `prod_tph_tasks` - TPH tasks
- ✅ `prod_tph_cases` - TPH cases
- ✅ `prod_tph_touches` - TPH touches
- ✅ `prod_tph_calls` - TPH calls

### Quality & FCR Tables
- ✅ `quality_audits` - Quality audits
- ✅ `fcr_daily` - FCR daily data

### People & Calendar Tables
- ✅ `people` - People data
- ✅ `work_calendar` - Work calendar
- ✅ `tl_snapshots` - TL snapshots

---

## ⚠️ Potential Issues

### 1. Large Dataset
- **Issue:** If there are thousands of rows, migration may take time
- **Solution:** Batch processing (1000 rows at a time) - already implemented

### 2. Google API Rate Limits
- **Issue:** Google Sheets API has rate limits
- **Solution:** Exponential backoff, batch operations

### 3. Data Validation Errors
- **Issue:** Some records may fail validation
- **Solution:** Log errors, continue migration, manual review

### 4. Duplicate Keys
- **Issue:** Some records may already exist
- **Solution:** Use upsert operations (ON CONFLICT DO NOTHING/UPDATE)

### 5. Date/Time Format Mismatches
- **Issue:** Google Sheets dates may not match Supabase format
- **Solution:** Normalize to ISO 8601, handle timezone (Asia/Kuwait)

---

## 🔧 Alternative: Run Migration on Vercel

If you want to run the migration without setting up local credentials, you can:

### Option A: Create API Endpoint
Create `/api/admin/migrate` endpoint that runs the migration:

```typescript
// src/app/api/admin/migrate/route.ts
import { runMigration } from '@/migration/migrate'

export async function POST() {
  try {
    await runMigration()
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
```

Then call it with:
```bash
curl -X POST https://dabdoob-cx-productivity.vercel.app/api/admin/migrate
```

### Option B: Vercel Cron Job
Schedule a one-time migration job:

```typescript
// src/app/api/cron/migrate/route.ts
export async function GET() {
  // Run migration
  return Response.json({ status: 'completed' })
}
```

### Option C: Supabase Edge Function
Create a Supabase Edge Function that reads from Google Sheets and writes to Supabase:

```typescript
// supabase/functions/migrate-data/index.ts
Deno.serve(async () => {
  // Migration logic here
  return new Response('Migration complete')
})
```

---

## ✅ Recommendation

**Best approach for your situation:**

1. **Provide Google Service Account credentials manually**
   - Download the JSON key file from Google Cloud Console
   - Share the file with me or add the credentials to `.env.local`
   - Run validation: `npx tsx migration/validate.ts`
   - Run dry run: `npx tsx migration/migrate-dry-run.ts`
   - Run migration: `npx tsx migration/migrate.ts`

2. **Or create a Vercel API endpoint**
   - I can create `/api/admin/migrate` endpoint
   - You call it once via curl or browser
   - Migration runs on Vercel with access to env vars

**Which approach would you prefer?**

---

## 📊 Current Status

| Item | Status | Notes |
|------|--------|-------|
| Google Sheet ID | ✅ | `1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs` |
| Google Credentials | ⚠️ | In Vercel, need local access or API endpoint |
| Supabase URL | ✅ | `https://uugeyulccyytvgcabzzx.supabase.co` |
| Supabase Keys | ✅ | In Vercel env vars |
| Migration Scripts | ✅ | Ready to run |
| Database Tables | ✅ | All 47 tables created |
| Validation Script | ✅ | `migration/validate.ts` |
| Dry Run Script | ✅ | `migration/migrate-dry-run.ts` |
| Migration Script | ✅ | `migration/migrate.ts` |

---

## 🎯 Bottom Line

**You are 95% ready to migrate!**

✅ All infrastructure is in place
✅ All scripts are ready
✅ All environment variables are configured in Vercel

⚠️ **Only issue:** Google credentials can't be pulled from Vercel to local machine

**Solution:** Either provide the Google Service Account JSON key file, or I can create a Vercel API endpoint that runs the migration remotely.

**What would you like to do?**
