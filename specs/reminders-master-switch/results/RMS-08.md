# RMS-08 result
Status: done
Files: src/features/cx-hub/components/admin-page.tsx
Changed: added `Rb` reminders master-switch block; rendered `<Rb rows={r} onSaved={a} />` after `<Im />`.
Checks: `npx tsc --noEmit` -> exit 0.
Handoff: toggle persists via `Ln.saveConfigSetting('reminders_enabled', !on)`; no blockers.
