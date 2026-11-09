# Spec index: google-signin
Kind: index
Size gate: PASS

Feature: Google OAuth sign-in (Supabase Auth) beside the existing email/password
login, gated to `@dabdoob.com` accounts that are authorised (active roster row or
`config.admin_emails`). Source plan: `../PLAN.md`.

| ID | Kind | Spec path | Owner | Depends | Criteria | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | mini | 01-signin-verdict.md | dev | none | #3 #5 | 2/4/180/10 |
| S02 | mini | 02-google-oauth-route.md | dev | none | #1 | 2/3/120/8 |
| S03 | mini | 03-auth-callback.md | dev | S01 | #2 #3 #5 | 2/4/160/10 |
| S04 | mini | 04-login-page-google.md | dev | S02 | #1 #3 #4 | 2/5/100/10 |
| S05 | mini | 05-before-user-created-hook.md | supabase-expert | none | #3 defense-in-depth | 1/2/60/8 |
| S06 | mini | 06-e2e-google-button.md | test-engineer | S04 | #1 #3 #4 | 1/3/60/8 |
| S07 | mini | 07-setup-runbook.md | tech-writer | S02 S03 S05 | #6 | 2/2/140/8 |

Ready work: S01, S02, S05 in parallel (wave 1, disjoint files); then S03 and S04
(wave 2); then S06 and S07 (wave 3). Max 4 workers; no two leaves share a file.

Criteria map: #1 -> S02+S04+S06. #2 -> S03. #3 -> S01+S03 (+S05 defense, S06 UX).
#4 -> no code change by design; e2e/auth.spec.ts keeps its password tests and S06
only appends. #5 -> S01+S03 (verified `email` from `exchangeCodeForSession`,
never `user_metadata`/`hd`). #6 -> S07.

Manual prerequisites (not shards; documented by S07): Google Cloud Internal OAuth
client, Supabase dashboard Google provider + redirect URLs, optional auth-hook
enable. Applying the S05 migration to the live DB needs user approval.

Size gate evidence: 7 mini leaves; all <=10 files / <=10 actions / <=2000 changed
lines / <=10 min; largest S01 ~180 lines. PM/TL run
`python "C:\Users\AHMED\AppData\Roaming\devin\skills\spec-sharding\check_shards.py" <leaves>` before dispatch.
