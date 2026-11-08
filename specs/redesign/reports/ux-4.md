# ux report - redesign - round 4 (DELTA, user-approved exception)

Verdict: PASS
Open: 0B / 0H / 0M / 5L

Review performed directly in the main session, not by an independent reviewer.
Scope: accent sweep only; fix and test evidence in `accent-sweep.md`.

## Verification
| Finding | Status | Evidence |
|---|---|---|
| ux-17 link/breadcrumb dark-pine contrast | FIXED | Both use `--cx-accent-text`; actual browser contrast 6.543:1 on cards, 5.293:1 on accent-soft, versus 4.085/3.304 before. |
| Recurring accent text pattern | FIXED | Seven text rules centralized; unit guard rejects fill/hover tokens as text colors (SVG stroke is the explicit exception). |
| Earlier toggle/seg/tab/nav fixes | RETAINED | Browser-measured selected text >=5.293:1 across Chromium, Firefox and WebKit; checked/focus geometry unchanged. |
| Fill and icon contrast | PASS in scoped matrix | Primary text >=4.853:1; nav SVG >=3.304:1; accent fill and ink values unchanged. |

90 cases cover all four accents plus default, explicit light/dark with
matching/opposing OS settings, auto light/dark, and five surface types.
24 screenshots produced; Chromium pine light/dark fixtures visually inspected.
This replaces approximate color-mix calculations with browser-resolved colors.

## Deferred LOWs, unchanged
| ID | Item |
|---|---|
| ux-11 | Ladder pressed-state positive affordance |
| ux-12 | Unused Tabs component RTL direction lookup |
| ux-13 | Forced-colors input focus outline |
| ux-14 | Document eco3 annotation geometry exemption (overlaps qa-6) |
| ux-15 | Latent hub pw-seg styling when priority is eventually used |

## Not verified / assumptions
Loading/error/empty states, mobile, RTL, keyboard/focus and full-route
screenshots are inherited from prior reviews, not newly exercised here.
Forced-colors remains an explicit deferred issue; this verdict is not a claim
of full application WCAG conformance. No live auth/data calls were made.
Fresh remote Web Interface Guidelines were not fetched (no external network
request); the local WCAG 2.2 checklist and measured AA contrast guided this delta.
