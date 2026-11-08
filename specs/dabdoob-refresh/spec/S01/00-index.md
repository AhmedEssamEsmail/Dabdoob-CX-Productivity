# S01: Rebrand — every user-facing "CX Helm"/"CX Productivity" -> "Dabdoob CX"
Kind: package
ID: S01
Dispatch: NEVER

## Goal and contract
PLAN criterion #1: `grep -rn "CX Helm\|CX Productivity" src/` finds 0 hits
outside comments; "Dabdoob CX" appears in rail brand (S03), `layout.tsx`
title, `BootSplash`, `APPS` titles, mail sender name and email footers.
Rules: code identifiers, `server:` legacy filenames, docs, specs and
`_archive` stay untouched; hits inside comments may remain; the APPS line
in `registry.ts` says do-not-hand-edit — rebrand overrides, edit `title`
values only, never structure. `src/app/auth/login/page.tsx` is NOT in this
package — its strings are rewritten by S03-04.

## Children
Index: `S01/00-index.md`
| Leaf | Outcome |
|---|---|
| S01-01 | Chrome strings: layout.tsx, BootSplash.tsx, registry APPS |
| S01-02 | Hub titles: admin-page.tsx APPS map, ecosystem-page.tsx title |
| S01-03 | Mail/notify templates (platform+desk+hub+queue) + 2 vitest strings — source applied (results/S01-03.md); oracle-parity remainder -> S01-05 |
| S01-04 | People email templates: reminders/tasks/meetings/1:1s |
| S01-05 | Golden desk oracle: normalize legacy `(via CX Helm)` signature in the test harness only |

## Completion
All five leaves done; `grep -rn "CX Helm\|CX Productivity" src/` shows only
comments; `npx vitest run tests/golden tests/platform` green.
