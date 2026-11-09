# ux report - qa-card-compact-strips - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/5L

States checked: loading (LinesSkeleton via QaPage — unchanged), error (LoadError + `role="alert"` form errors — unchanged), empty (`.empty` kept on all three pages), disabled (`cx-btn` disabled during send/submit/deny — unchanged), long text (`qa-meta`/`qa-note-txt` ellipsis), mobile (wrap declared at ≤64rem), dark (token-only, both `data-theme` token sets resolve), keyboard (native `<details>/<summary>` operable; tab order = DOM order), focus (global `:focus-visible` 2px `--cx-focus` outline at cx-kit.css:115 covers `summary`, links, buttons).

Mockup parity: strip order (chevron/score/name/meta/status/acts), `qa-list` gap `space-2` = mock `.ctl-list` .5rem, wrap breakpoint 64rem, `.qa-detail` border-top + padding, `.qa-cap` style — all match `mockups/ctl-compact/a.html` + `mockups/disputes-compact/a.html` (`.va-*`/`.da-*` mechanics). `data-late` stripe and `data-picked` outline preserved via existing `.qa-card` hooks.

Measured contrasts (sRGB→OKLab mix for `--cx-ink-3`, WCAG luminance):
- `.qa-meta`/`.qa-cap` ink-3 on strip: **4.84:1 light** (#677380/#fff), **5.05:1 dark** (#85939e/#1a232b) ✓
- `.qa-note-txt` ink-2: 6.75:1 light / 6.60:1 dark ✓ · chevron (1.4.11, ≥3:1): 4.84/5.05 ✓
- pills: ok 5.08/7.28 · warn 6.16/8.29 · bad 5.58/7.56 · neutral 6.39/7.11 ✓
- `data-late` stripe: 4.24/4.42 (≥3:1, plus redundant "Overdue since" pill) ✓ · `data-picked` outline: 6.37/4.08 ✓ · focus: 4.55/6.87 ✓

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-1 | LOW | disputes-page.tsx:176 | `.qa-sep` "·" renders unconditionally → meta starts with "·" when `l.audit` is null (ctls-page:392 already guards) | `{l.audit ? <span className="qa-sep">·</span> : null}` | dev |
| ux-2 | LOW | quality.css:230 | `.qa-sep { opacity:.55 }` → effective 2.20:1 light / 2.39:1 dark (incidental separator; approved-mockup parity) | raise to ≥.75 or leave as decorative | dev |
| ux-3 | LOW | disputes-page.tsx:172 | `TicketRef` `<a>` inside `<summary>`: clicking the ticket opens a new tab *and* toggles the strip; keyboard unaffected (`target="_blank"`) | optional `onClick={(e)=>e.stopPropagation()}` on the link | dev |
| ux-4 | LOW | ctls-page.tsx:403 | `.qa-note-txt` truncates closed-CTL notes with no reveal path (no `title`, no expansion — design-approved, but full note is unreachable in-page) | add `title={`${r.action}: ${r.notes}…`}` on `.qa-note-txt` | dev |
| ux-5 | LOW | disputes-page.tsx:166, my-audits-page.tsx:43 | decorative `.qa-chev` svg has no `aria-hidden="true" focusable="false"`; always right-pointing in RTL (`.cx-icon--flip` exists) | add the two attrs; optional `cx-icon--flip` | dev |

Not verified / assumptions:
- 1.4.10 reflow @320px, 1.4.4 resize @200%, 2.4.11 focus-not-obscured: declared intent only (flex-wrap at ≤64rem, meta `flex-basis:100%`, no fixed widths; no sticky overlay in these panes) — not rendered.
- `AppShell.tsx:478` sets `data-app={ctxApp}`; quality routes resolve `data-app="quality"`, so scoped rules apply. `globals.css`/`legacy-apps.css` not imported (dead files).
- Truncated meta info (raised-by, channel/date/auditor) is duplicated inside `.qa-detail` for disputes but not for my-audits summaries — same as approved mockups.
- ResendMail gating (`n.isAdmin`), callbacks, and all form internals verified unchanged in diff.
