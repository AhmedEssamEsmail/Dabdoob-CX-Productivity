# S05-02: One 60s client poller feeds Popups + OneOnOneAlerts
Kind: mini
ID: S05-02
Parent: S05
Owner: dev
Depends: S05-01
Criteria: PLAN #5 (one payload per 60s tick per tab)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=3; actions=5; changed_lines=120; minutes=9

## Goal
`Popups.tsx` becomes the only 60s poller: it calls the merged
`GET /api/popups` and passes `alerts` down to `OneOnOneAlerts`, which drops
its own polling and renders from a prop.

## Files
- Edit: `src/features/shared/shell/context.ts` | `alertsApi` (110-115): `popupsPoll` returns the merged payload; remove `oneOnOneAlerts` GET helper (keep `oneOnOneAlertsSeen`)
- Edit: `src/features/shared/components/shell/Popups.tsx` | single poller (24-58) + pass alerts prop (line 118)
- Edit: `src/features/shared/components/shell/OneOnOneAlerts.tsx` | accept `incoming: OneOnOneAlert[]` prop; delete its poll effect (123-153)

## Context
- `src/features/shared/components/shell/Popups.tsx:24-58,118` | existing visibility-gated 60s loop + `<OneOnOneAlerts />` mount point
- `src/features/shared/components/shell/OneOnOneAlerts.tsx:79-153` | merge.current + poll effects to rewire; `chime`/seen/dismiss logic stays
- `src/features/shared/shell/context.ts:109-115` | alertsApi shape consumed by both components
- `src/features/shared/components/shell/OneOnOneAlerts.tsx:139` | its 2.5s first-hit — reproduce via the parent's first poll firing once on mount (not after 60s)

## Contract
- `alertsApi.pollTick(): Promise<{ popups: ShellPopup[]; alerts: OneOnOneAlert[]; now: string }>` -> GET /api/popups; `popupsPoll`/`oneOnOneAlerts` GET helpers removed; `oneOnOneAlertsSeen` unchanged.
- Popups.tsx: keep the visibility-gated 60s loop but fire once on mount too (the 2.5s first-hit UX), then feed `data.alerts` into `<OneOnOneAlerts incoming={alerts} />`; popup-side seen/chime/title-flash logic unchanged.
- OneOnOneAlerts.tsx: props `{ incoming: OneOnOneAlert[] }`; run `merge.current(incoming)` in an effect on `incoming` identity; its own fetch/visibility/timeout polling effects removed entirely (keep soon->start promotion timers, audio unlock, chime, dismiss).
- Net effect: exactly ONE request/60s/tab serves both widgets.
Out of scope: Toasts, server files, tests beyond typecheck.

## Actions
1. context.ts: replace the two GET helpers with `pollTick()` (merged type).
2. Popups.tsx: call `pollTick()` in the existing loop + once at mount; store `data.alerts`; keep popup freshness/seen logic on `data.popups`.
3. Popups.tsx: render `<OneOnOneAlerts incoming={alerts} />`.
4. OneOnOneAlerts.tsx: add the prop + merge-on-incoming effect; delete its own polling effect and timers cleanup for it.
5. Remove dead imports (`alertsApi.oneOnOneAlerts`, now-unused refs/state if any).

## Done when
- One merged call per 60s visible tick; no other alerts fetch exists.
- Alerts still merge/promote/chime/dismiss identically (visual parity).
- `npx tsc --noEmit` clean; `npx eslint src/features/shared/components/shell src/features/shared/shell` clean.

## Verify
- Run: `npx eslint src/features/shared/components/shell src/features/shared/shell && npx tsc --noEmit` -> no findings.

## Handoff
None. Write results/S05-02.md (<=10 lines); TL alone updates TRACKER.md.
