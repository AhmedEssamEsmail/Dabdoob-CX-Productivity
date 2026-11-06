# audits/

Output directory for megaplan work-package reports. Naming per wave briefs:

- `w0-baseline.md` — WP-03 build/smoke/e2e results
- `hub.md` … `api-surface.md` — wave-1 module audits (WP-10..18)
- `jobs.md` — WP-24 job/scheduling audit
- `credentials.md` — WP-34 probe results (never paste secrets)
- `migration-dryrun.md`, `../migration-report.md` — wave-3 outputs
- `admin-ui.md`, `viewas-sweep.md`, `routing.md`, `appearance.md`, `parity-method.md` — wave-4 outputs
- `cutover-plan.md` — WP-54

Each report ends with: what shipped, what's stubbed/blocked and why, gate results, questions for the orchestrator.
