# Architecture Overview

## Current Architecture (GAS)

```
Google Apps Script (Server)
├── Gmail Advanced Service (CSV import)
├── Google Sheets (Data store)
├── Triggers (Scheduled jobs)
└── Bundled HTML (Frontend)
```

## Target Architecture

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

## Key Architecture Changes

### From:
- Monolithic Google Apps Script project
- Google Sheets as primary data store
- Gmail Advanced Service for CSV import
- Bundled HTML frontend
- Server-side triggers for scheduled jobs

### To:
- Modular Next.js application
- PostgreSQL database via Supabase
- Gmail API via Edge Functions
- Proper Next.js/React frontend
- Vercel Cron for scheduled jobs
- GitHub Actions for CI/CD

## Data Flow

### Current:
```
Gmail → GAS (Advanced Service) → Google Sheets → GAS (calculation) → HTML → User
```

### Target:
```
Gmail → Edge Function → Supabase → Next.js API → Next.js Frontend → User
         (Gmail API)      (PostgreSQL)     (API Routes)    (React)
```

## Technology Rationale

### Supabase (PostgreSQL)
- Built-in authentication
- Row-level security (RLS)
- Edge Functions for serverless logic
- PostgreSQL features (JSONB, triggers, functions)
- Free tier sufficient for this workload

### Next.js
- Full-stack framework (frontend + API routes)
- Great developer experience
- Vercel integration
- App Router for modern routing
- Server components for performance

### Vercel
- Seamless Next.js deployment
- Built-in CDN
- Cron jobs for scheduled tasks
- Preview deployments
- Analytics and monitoring

### GitHub Actions
- Free CI/CD
- Automatic testing on push
- Automated deployment to Vercel
- Version control integration
