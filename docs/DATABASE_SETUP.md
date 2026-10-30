# Database Setup Instructions

## Run in Supabase SQL Editor

Go to your Supabase project: https://supabase.com/dashboard/project/uugeyulccyytvgcabzzx

Navigate to: SQL Editor → New Query

Run the following SQL statements in order:

### 1. Add custom claims to auth.users

```sql
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS tl_email TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;
```

### 2. Create core tables

```sql
-- Config table
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roster table
CREATE TABLE IF NOT EXISTS roster (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tl', 'agent', 'specialist')),
  tl_email TEXT,
  country TEXT,
  active BOOLEAN DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- View-as table
CREATE TABLE IF NOT EXISTS view_as (
  id SERIAL PRIMARY KEY,
  owner_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start', 'stop')),
  target_email TEXT,
  app TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Create indexes

```sql
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
CREATE INDEX IF NOT EXISTS idx_roster_email ON roster(email);
CREATE INDEX IF NOT EXISTS idx_roster_role ON roster(role);
CREATE INDEX IF NOT EXISTS idx_roster_tl_email ON roster(tl_email);
CREATE INDEX IF NOT EXISTS idx_view_as_owner ON view_as(owner_email);
```

### 4. Insert default configuration

```sql
INSERT INTO config (key, value, description) VALUES
  ('allowed_domain', 'dabdoob.com', 'Email domain restriction'),
  ('admin_emails', '', 'Comma-separated admin emails'),
  ('prod_flag_auto_accept', 'true', 'Auto-accept flags on detection'),
  ('prod_confidence_auto_threshold', '50', 'Minimum confidence for auto-accept'),
  ('prod_confidence_warning_threshold', '30', 'Minimum confidence to avoid warning'),
  ('quarterly_report_recipients', '', 'Comma-separated quarterly report recipients')
ON CONFLICT (key) DO NOTHING;
```

### 5. Enable RLS (for future tables)

When productivity tables are created, enable RLS with:

```sql
ALTER TABLE prod_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_intervals ENABLE ROW LEVEL SECURITY;
```

And add policies (from spec/05-auth-authorization.md)
