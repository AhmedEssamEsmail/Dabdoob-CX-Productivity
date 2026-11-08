# S03: Shell rail, ⌘K palette, login page
Kind: package
ID: S03
Dispatch: NEVER

## Goal and contract
PLAN criteria #1-#3: the shell rail becomes the mockup rail — fixed
"Dabdoob CX" brand + "Operations console" sub (NEVER mutates per app
section), a ⌘K search box that opens a real page switcher (fuzzy filter of
role-gated `PAGES`, Arrow/Enter/Esc keyboard nav), an avatar user card in
the rail foot — and `/auth/login` renders the mockup card design.

Invariants (all children):
- Keep e2e hooks: `#nav`, `.nav-link`, `aria-current`, `.rail-*`,
  `.nav-toggle` accessible name "Menu", `.state-screen`, login `form` /
  `input[type=email]` / `button[type=submit]` / `role="alert"`.
- Keep `D()` on user-visible strings; keep role gating helpers
  (`pageAllowed`, `inApp`, `groupEntryLink`, `resolveLink`).
- Prefer additive classes/new nodes over renames (legacy-parity DOM note);
  deliberate markup changes are allowed but ids/aria hooks stay.
- View-transition SPA navigation (`navigate` helper) is reused by the
  palette for same-app pages; cross-app entries keep `target="_top"` links.

## Children
Index: `S03/00-index.md`
| Leaf | Outcome |
|---|---|
| S03-01 | `CommandPalette.tsx` component + pure filter + unit test |
| S03-02 | AppShell rail markup: brand+sub, rail-search button, avatar foot |
| S03-03 | Palette wiring in AppShell (⌘K listener, open state, render) |
| S03-04 | `/auth/login` page markup -> mock 01 card design + rebrand |

## Completion
All four leaves done; rail shows fixed brand + ⌘K box + avatar; palette
filters/navigates; login matches mock in light and dark (shot harness
`auth-login*` evidence, PM-run).
