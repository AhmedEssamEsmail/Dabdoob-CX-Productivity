# ux report - ctl-strip-overflow - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/3L

States checked: long text/overflow at 320px, mobile, dark (tokens unchanged), keyboard, focus. Not verified: live app render (fixture-based Playwright only), SR announcement.

Delta since ux-1: `src/app/styles/quality.css`:226-227 (`.qa-name` shrink fix) + `tests/ui/qa-strip-overflow.pw.ts`:97-126 (new 320px regression test; test code, not UI surface). WIG (fetched fresh → reports/wig.md) applied to the changed CSS.

## Verified fixed
- **ux-1 (MED) — FIXED.** quality.css:226 now `.qa-name{…white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}` and is removed from the `flex:none` group (:227 keeps `.pill`/`.cx-chip`/`.qa-acts`). Exactly the prescribed fix; `nowrap` kept. Applies to both `article` and `details>summary` variants (descendant selector). `.qa-name` is plain `<strong>` text (ctls-page.tsx:384, disputes-page.tsx:168, my-audits-page.tsx:57) — no focusable children, so `overflow:hidden` can't clip a focus ring. Rendered proof: `gate-pw2.log` — 2/2 pass; 320px test asserts `documentElement.scrollWidth<=clientWidth`, strip rights ≤ `.qa-list` right, and `.qa-name` ellipsis engaged (`scrollWidth>clientWidth`). Closes the residual h-scroll; 1.4.10 reflow now holds at 320px.
- WIG: "flex children need min-w-0" and "handle long content (truncate)" now satisfied for `.qa-name`; no new violations on the delta.

## Findings
| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-2 | LOW | quality.css:226,228-231; ctls-page.tsx:384-410 | Ellipsized `.qa-meta`/`.qa-note-txt` — and now `.qa-name` (only truncates at ≤~360px) — is unreachable for sighted users on the `article` variant (no `title`, no expansion; details-variant rows can expand). SR gets full DOM text | `title` (or aria-label/sr-only full text) on the meta/note/name span carrying the untruncated string | dev |
| ux-3 | LOW | disputes-page.tsx:166 (+ same svg in my-audits strip) | Decorative `.qa-chev` `<svg>` lacks `aria-hidden`/`focusable`; `summary{list-style:none}` relies on the chevron as sole disclosure affordance | `aria-hidden="true" focusable="false"` on the svg | dev |
| ux-4 | LOW | ctls-page.tsx:332 | `scrollIntoView({behavior:'smooth'})` bypasses the app's `reduceMotion()` helper (qa-shared.tsx:1062); JS 'smooth' wins over the CSS `!important` auto | `behavior: reduceMotion() ? 'auto' : 'smooth'` | dev |

Not verified / assumptions:
- ux-2/3/4 unchanged from ux-1: pre-existing in e41f9f1/adjacent code, deferred per FIX rules, tracked in TRACKER. ux-2 scope widened to include `.qa-name` since this fix introduces name truncation.
- 320px result is fixture-rendered (real CSS cascade incl. theme/cx-kit), not a live page; live `/quality` render not re-verified this round.
