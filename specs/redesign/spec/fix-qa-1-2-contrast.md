# Fix: light-theme AA contrast misses (qa-1 + qa-2)

Slug: fix-qa-1-2-contrast. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/qa-1.md` findings qa-1 (HIGH) + qa-2 (MED), PLAN criterion #7.
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Findings
- **qa-1 (HIGH)** `src/app/theme.css:39` `--line-strong` = `color-mix(in oklab, var(--ink-2) 45%, var(--line))` ≈ **2.29:1 vs --surface / 2.14:1 vs --paper** — it is the sole 1px border color of `.btn`/`.cx-btn`/`.cx-input`/`.cx-select`/`.cx-seg`/`.cx-switch`/fieldsets/cards (~15 rules in cx-kit.css). WCAG non-text UI contrast requires **≥3:1**. Also `:146-148` `--cx-status-neutral-edge` `#8a96a8` on chip bg `#e6eaf1` = **2.48:1**, and `:155-157` `--cx-status-warn-edge` `#c68a1a` on `#fdf0d6` = **2.64:1** — the chip edge IS the component boundary.
- **qa-2 (MED)** `theme.css:29` `--age-3: #d05f2a` + `:173` `--cx-age-ink-3: #ffffff` = **3.92:1 < 4.5:1** text AA (white age-3 badge text, light theme).

## Goal
Light-theme tokens meet AA: `--line-strong` ≥3:1 vs BOTH `--surface` (#fff) and `--paper` (#f6f7f8); status chip edges ≥3:1 vs chip bg AND vs surface/paper; age-3 badge text pair ≥4.5:1. Dark theme must stay ≥3:1 / ≥4.5:1 (currently passes — do not regress).

## Files (only these)
- `src/app/theme.css`

## Rules
- Change LIGHT-theme (`:root`) values only; leave `html[data-theme="dark"]` / prefers-color-scheme blocks untouched unless a re-declare references the changed token (if so, keep the dark value as-is).
- Suggested targets from the report (verify, don't blindly copy): `--line-strong` mix ≈70% `--ink-2`, or literal ≈`#8a93a1`; `--cx-status-neutral-edge` ≈`#6e7887`; `--cx-status-warn-edge` ≈`#9a6b12`; either darken `--age-3` to ≈`#b8531f` OR flip `--cx-age-ink-3` to `#0f1720` (like ink-0/1/2). Prefer the `--cx-age-ink-3` flip if it keeps the ramp hue — your call, justify in one line.
- No new tokens unless needed; no tsx/other css edits; keep the file's comment style.

## Verify
1. Compute sRGB relative-luminance contrast for each changed pair (both light surfaces) and report the ratios; all thresholds above must pass.
2. `npx tsc --noEmit` 0 errors; `npx eslint .` 0 errors (css isn't linted but confirm tree still clean).
3. Update your TRACKER row notes + mark the `fix-qa-1-2-contrast` Review-findings row done with evidence. Reply <=100 words.
