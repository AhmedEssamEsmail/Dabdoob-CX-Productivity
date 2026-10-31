# CX Helm Productivity Migration - Specification Index

This directory contains the complete technical specification for migrating the CX Helm Productivity system from Google Sheets/Google Apps Script to Supabase/Next.js/Vercel.

## Specification Documents

### Overview
- **[01-architecture.md](./01-architecture.md)** - Current and target architecture diagrams
- **[02-preservation.md](./02-preservation.md)** - Business logic, data formats, UI/UX preservation requirements

### Feature Inventory
- **[03-feature-inventory.md](./03-feature-inventory.md)** - Complete inventory of all systems, tables, APIs, integrations, and UI pages

### Technical Design
- **[04-database-schema.md](./04-database-schema.md)** - PostgreSQL schema for all tables
- **[05-auth-authorization.md](./05-auth-authorization.md)** - Supabase Auth and RLS policies
- **[06-api-design.md](./06-api-design.md)** - Next.js API routes and endpoints
- **[07-frontend-architecture.md](./07-frontend-architecture.md)** - Next.js app structure and components

### Implementation
- **[08-scheduled-jobs.md](./08-scheduled-jobs.md)** - Cron jobs and Edge Functions
- **[09-external-integrations.md](./09-external-integrations.md)** - Gmail, Freshdesk, Freshchat, Maqsam integrations
- **[10-data-migration.md](./10-data-migration.md)** - Data migration scripts and strategy
- **[11-deployment.md](./11-deployment.md)** - GitHub Actions CI/CD and Vercel deployment

### Quality & Operations
- **[12-security.md](./12-security.md)** - Security considerations and secrets management
- **[13-testing.md](./13-testing.md)** - Unit, integration, and E2E testing strategy
- **[14-rollback.md](./14-rollback.md)** - Rollback procedures and triggers

### Planning
- **[15-implementation-phases.md](./15-implementation-phases.md)** - 18-week implementation timeline
- **[16-cost-estimation.md](./16-cost-estimation.md)** - Monthly cost breakdown
- **[17-risk-assessment.md](./17-risk-assessment.md)** - Risk matrix and mitigation strategies
- **[18-success-criteria.md](./18-success-criteria.md)** - Functional and non-functional requirements

### Reference
- **[19-appendix.md](./19-appendix.md)** - Technology stack details, open questions, decision log
- **[20-ui-preservation-plan.md](./20-ui-preservation-plan.md)** - Detailed plan to preserve original visual design, colors, and UX
- **[21-test-coverage-plan.md](./21-test-coverage-plan.md)** - Comprehensive test coverage plan (unit, integration, E2E, performance, security)
- **[22-data-migration-requirements.md](./22-data-migration-requirements.md)** - What is needed to actually migrate data from Google Sheets

## Quick Reference

**Target Stack:**
- Database: Supabase (PostgreSQL)
- Backend: Next.js API Routes + Supabase Edge Functions
- Frontend: Next.js (React)
- Hosting: Vercel
- CI/CD: GitHub Actions

**Timeline:** 18 weeks
**Monthly Cost:** ~$20 (Vercel Pro)
**Migration Scope:** 13 core systems, 70+ tables, 50+ APIs

## Critical Requirement

**MANDATORY:** The migration MUST preserve ALL features, concepts, and functionality from the original CX Helm ecosystem. No feature may be omitted, simplified, or removed without explicit approval from the system owner.

See [03-feature-inventory.md](./03-feature-inventory.md) for the complete feature inventory and zero omission checklist.
