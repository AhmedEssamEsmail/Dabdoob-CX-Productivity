# Appendix

See [MIGRATION_SPECIFICATION.md](../../MIGRATION_SPECIFICATION.md) Section 18 for complete appendix.

## Technology Stack Details

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

## Open Questions

1. **View-as functionality:** Should we keep this complex feature or simplify it?
2. **Gmail OAuth:** Should we use service account or individual user OAuth?
3. **Spreadsheet sync:** Should we maintain spreadsheet sync or move to direct API?
4. **Timeline:** Can we allocate 18 weeks, or do we need a faster timeline?
5. **Budget:** Is $20/month acceptable, or do we need to optimize further?

## Decision Log

| Decision | Date | Reason |
|----------|------|--------|
| Use Supabase over other DBs | - | Built-in auth, RLS, Edge Functions |
| Use Next.js over other frameworks | - | Full-stack, Vercel integration, great DX |
| Keep spreadsheet sync for Freshchat/Maqsam | - | Less risky, existing data flow works |
| Deprecate View-as initially | - | Complex to reimplement, low usage |
| Use Vercel Cron over pg_cron | - | Easier integration with Next.js |

## Next Steps

Extract complete appendix details from MIGRATION_SPECIFICATION.md Section 18 during implementation.
