# ux report - ctl-strip-overflow - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/1M/3L

States checked: loading (QaPage `aria-busy` + LinesSkeleton, qa-shared.tsx:165-169), error (LoadError + retry), empty (`.empty>.s`), disabled (`cx-btn:disabled` .55+not-allowed), long text/overflow, dark, keyboard, focus. Not verified: live 320px render, 200% text, SR announcement, focus-obscured (no sticky page header over `.qa-list` found — only in-card `.qa-score` sticky, offsets below `--cx-topbar-height`).

Changed file reviewed: `src/app/styles/quality.css` (delta :217; strip block :214-239). Markup read for judgment: ctls-page.tsx:375-446, disputes-page.tsx:162-184, my-audits-page.tsx:140,164-190. WIG applied to these.

## Passes (measured)
- Fix is correct and consistent: `grid-template-columns:minmax(0,1fr)` on `.qa-list` matches the hub.css `.md-layout` precedent, is token-based, and covers `article` + `details` variants via the shared selector (disputes:162, my-audits:164,183). Visuals of e41f9f1 unchanged.
- Ellipsis path intact: `.qa-meta` `min-width:0;flex:1;overflow:hidden` + `.qa-meta>span`/`qa-note-txt` `text-overflow:ellipsis` (quality.css:228-231).
- Contrast (computed): `.qa-meta`/`.qa-cap`/`qa-chev` `--cx-ink-3` (85% mix) = **4.71:1 light, 5.18:1 dark** vs surface — pass 4.5. Pills 5.08-8.29:1 both modes. `.cx-btn--primary` 6.37 light / 4.85 dark. `[data-late]` accent edge 4.42:1 dark (>=3). `pill::before` dot is decorative (`currentColor`, text label present — not color-only).
- Focus/keyboard: global `:focus-visible` 2px `--cx-focus` ring covers summary/buttons/links (cx-kit.css:115); `summary` natively operable; `.qa-chev` transition zeroed by global reduced-motion block (theme.css:498-513); `scroll-behavior:auto` set there too.
- Targets: `.cx-btn--small` min-height 2rem (32px) >=24px; strip row ~30px. Logical properties throughout — RTL-safe.

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | quality.css:226-227 | `.qa-name` is `white-space:nowrap` + `flex:none` with no `overflow`/`min-width:0` — it can never shrink. `.qa-meta` absorbs shrink first, but at <=~360px (≤64rem wrap is on, `.card` has no `overflow:hidden`) a long real name ("Abdelsamad Mohamed Abdelsamad Youssef", ~37ch ~= 275px) exceeds the ~220px strip content box at 320px → overflow paints outside the card → document h-scroll returns = residual of the same bug class; 1.4.10 reflow failure | Let the name shrink as last resort, after meta is clipped: `.qa-card--strip .qa-name{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}` (remove `.qa-name` from the `flex:none` group, keep `nowrap`). Full name still shown whenever space allows | dev |
| ux-2 | LOW | quality.css:228-231; ctls-page.tsx:386-410 | Ellipsized `.qa-meta`/`.qa-note-txt` content is unreachable for sighted users on the `article` variant (no `title`, no expansion; only details-variant rows can expand). SR users get full DOM text | Add `title` (or `aria-label`/sr-only full text) on the meta/note span with the untruncated string | dev |
| ux-3 | LOW | disputes-page.tsx:166 (+ same svg in my-audits strip) | Decorative `.qa-chev` `<svg>` lacks `aria-hidden`/`focusable`; `summary{list-style:none;display:flex}` relies on that chevron as sole disclosure affordance — verify VoiceOver/Safari still announces expanded/collapsed | `aria-hidden="true" focusable="false"` on the svg | dev |
| ux-4 | LOW | ctls-page.tsx:332 | `scrollIntoView({behavior:'smooth'})` bypasses the app's own `reduceMotion()` helper (qa-shared.tsx:1062) and CSS `scroll-behavior` (JS 'smooth' wins over the `!important` auto) | `behavior: reduceMotion() ? 'auto' : 'smooth'` | dev |

Not verified / assumptions:
- ux-1 pixel estimate (name ~275px vs ~220-260px box) is computed from font metrics, not rendered; a 320px Playwright pass would confirm exact threshold. All other contrasts measured from token hex values; `--cx-ink-3` oklab mix approximated in sRGB (real value within ±0.1 of reported ratio).
- globals.css/legacy-apps.css define a weaker `--cx-ink-3` (72%) but are not imported by layout.tsx (theme.css is the loaded token layer) — confirmed via import graph.
- LOWs are pre-existing in e41f9f1/adjacent code, not introduced by this fix; listed for the record.
