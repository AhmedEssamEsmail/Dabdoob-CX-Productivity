-- Core tables for authentication and configuration

-- Config table for system settings
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roster table for user management
CREATE TABLE roster (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tl', 'agent', 'specialist')),
  tl_email TEXT,
  country TEXT,
  active BOOLEAN DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- View-as state table
CREATE TABLE view_as (
  id SERIAL PRIMARY KEY,
  owner_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start', 'stop')),
  target_email TEXT,
  app TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_config_key ON config(key);
CREATE INDEX idx_roster_email ON roster(email);
CREATE INDEX idx_roster_role ON roster(role);
CREATE INDEX idx_roster_tl_email ON roster(tl_email);
CREATE INDEX idx_view_as_owner ON view_as(owner_email);

-- Insert default configuration values
INSERT INTO config (key, value, description) VALUES
  ('allowed_domain', 'dabdoob.com', 'Email domain restriction'),
  ('admin_emails', '', 'Comma-separated admin emails'),
  ('prod_flag_auto_accept', 'true', 'Auto-accept flags on detection'),
  ('prod_confidence_auto_threshold', '50', 'Minimum confidence for auto-accept'),
  ('prod_confidence_warning_threshold', '30', 'Minimum confidence to avoid warning'),
  ('quarterly_report_recipients', '', 'Comma-separated quarterly report recipients');
