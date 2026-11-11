# P2FAPP-02 result
Status: done (static verify); browser re-check pending TL.
Files: src/app/auth/logout/page.tsx (client page: BootSplash + useEffect window.location.assign('/api/auth/logout')).
Checks: `npx eslint src/app/auth/logout/page.tsx` clean (0 problems, one justified eslint-disable for no-location-assign on API route); `npx tsc --noEmit` clean.
Notes: page-level splash is inside #app so layout BootSplash sibling is unaffected; identical markup = no double flash. Sign-out flow unchanged (still hits /api/auth/logout).
Handoff: verify in browser (npm run dev -> /auth/logout -> splash then /auth/login) at 375/1024.
