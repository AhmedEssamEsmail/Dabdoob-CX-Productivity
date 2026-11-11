# P2FHUB-02 — /admin app_url_* links + setting-key title
Status: DONE (tsx-only; hub.css untouched — P2FHUB-01 rules preserved)
Files: src/features/cx-hub/components/admin-page.tsx (+~16 lines)
Changes: new `Sm()` detects string values starting http(s)://; `.setting-value` renders `<a className="cx-link" target=_blank rel=noopener noreferrer title={url}>` labelled "Open the <app> app" for `app_url_*` keys, "Open link" otherwise — raw URL only in `title`. `.setting-key` gained `title={h.key}`. `Am()`/`Cm()`/`Pm` edit path and boolean toggle unchanged.
Checks: `npx eslint admin-page.tsx` → 0 problems; `npx tsc --noEmit` → clean (empty output). /admin is auth-gated → browser Q3 re-check deferred to auditor.
Handoff: auditor re-runs Q3 @375/1440 (expect link text, no raw script.google.com) + spot-check boolean/json/text rows.
