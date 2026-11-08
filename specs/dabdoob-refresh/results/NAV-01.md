# NAV-01 — unified collapsible nav
Status: done
Files: src/features/shared/components/shell/AppShell.tsx (only)
Changes: all GROUP_ORDER groups render inline via `navVisible` (no inApp filter); `.nav-group-label` is a toggle button with chevron, aria-expanded/controls, sessionStorage `cx.nav-groups` open-set; auto-expand of current route's group (adjust-during-render); cross-app branch, nav-ext, nav-link--off, target="_top", isAdmin, groupEntryLink/GROUP_DEFAULT_PAGE imports removed; brand/cx-note/"Open the Hub" links now use navigate().
Checks: `npx eslint AppShell.tsx` exit 0; `npx tsc --noEmit` exit 0; grep for nav-ext|nav-group--app|target="_top"|groupEntryLink|GROUP_DEFAULT_PAGE|isAdmin -> no output.
Handoff: NAV-02 CSS hooks ready (button.nav-group-label, .nav-label-text, .nav-chevron, ul[hidden], [aria-expanded]); NAV-03 e2e hooks: aria-expanded/controls/hidden + sessionStorage['cx.nav-groups'].
Blockers: none.
