# P2FAPP-01 — /auth/login single <main> landmark
Status: DONE
Files: src/app/auth/login/page.tsx (login-wrap main->div, open+close tags)
Checks: eslint page.tsx 0 problems; tsc --noEmit exit 0; dev server /auth/login HTML shows exactly 1 <main> (SiteChrome main#main), login-wrap rendered as div
Note: dev server left running on :3000 (started for verify; kill if needed)
Handoff: ready for Q7 re-audit @375/1440/1024
