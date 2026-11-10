<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database migrations (Supabase)

Schema changes ship only as new timestamped migration files — `npx supabase migration new <name>` — which auto-apply to production on merge to `main` via the Supabase GitHub integration. Never apply DDL by hand in the dashboard SQL editor. Remote CLI ops need `--remote` (verify the `Target:` line) and, until the IDE stops injecting it, `env -u SUPABASE_ACCESS_TOKEN`; remote writes need explicit user approval.
