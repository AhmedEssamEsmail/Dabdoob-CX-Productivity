# Database Schema Design

See [MIGRATION_SPECIFICATION.md](../../MIGRATION_SPECIFICATION.md) Section 3 for complete database schema.

## Overview

This section contains the complete PostgreSQL schema for all tables in the CX Helm ecosystem.

## Table Categories

### Productivity Tables
- prod_intervals
- prod_flags
- prod_flag_log
- prod_flag_analytics
- prod_quarterly_reports
- prod_daily_layers
- prod_window_hist

### TPH Tables
- prod_tph_days
- prod_tph_tasks
- prod_tph_cases
- prod_tph_touches
- prod_tph_calls

### Quality Tables
- qa_audits
- qa_flags
- qa_flag_log
- qa_daily
- qa_months

### FCR Tables
- fcr_daily
- fcr_weekly
- fcr_monthly

### KPI Tables
- kpi_logs
- kpi_ol_cases
- kpi_unplanned_leave

### Queue Tables
- agg_queue_now
- agg_inflow_daily
- agg_inflow_weekly
- agg_inflow_monthly
- agg_agent_perf
- agg_agent_daily
- agg_snapshots_today
- refresh_log

### People Tables
- roster
- headcount
- team_structure

### Work Calendar Tables
- schedule
- days_off
- weekly_schedule

### TL Tables
- tls
- tlp
- md (mail desk)

### Core Tables
- config
- view_as
- tickets
- esc_seen
- sc_daily
- sc_behaviour
- sc_months

## Indexes

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

## Next Steps

Extract complete SQL from MIGRATION_SPECIFICATION.md Section 3 during implementation.
