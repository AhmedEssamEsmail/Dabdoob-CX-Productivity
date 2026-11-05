# CX-Hub Parity — Tracker

Rule (carried from `IMPLEMENTATION_TRACKER.md`): each shard lands as **separate commits** after its gates pass. Update this file as shards complete.

| Shard | Item | Status | Notes |
|---|---|---|---|
| 00 | Repo restructure (rename → CX-Hub; features/ layout; move cx-productivity) | **done 2026-11-05** | rename by owner; moves+imports commit c321d22/86f5c43 |
| 01 | Unified-app shell context (per-group app ctx, rail/brand/title, internal cross-group links) | **done 2026-11-05** | commit 86f5c43 |
| 02 | Extraction pipeline (per-app bundle decompile → `.devin/work/extract/<app>/`) | **done 2026-11-05** | `scripts/legacy-extract.mjs`, commit 25079ce; 37 built pages + ecosystem; escalation-matrix/hard-cases/kpi-close/fcr unbuilt-in-legacy |
| 10 | Hub (overview, admin, people-holidays, my-day, ecosystem + jobs) | pending | XL; ecosystem = full Three.js scene |
| 20 | Quality (10 pages + QaEngine + workflows + jobs) | pending | XL |
| — | FCR | **skipped** | D-FCR: dedicated plan later |
| 30 | Queue & Workforce (6 pages + scheduler/heatmap + syncs) | in progress | wave-1 commit e7bd2a5: 6 pages + jobs + freshdesk + 007 DDL |
| 40 | People & Performance (9 pages + scorecard + reminders) | in progress | wave-1 commit 8177649: actions/notes/coaching/1:1 engines + 008 DDL; continuation agent on pages+rest |
| 50 | Operations & Trackers (trackers, escalation-matrix) | in progress | wave-1 commit 515a033: trackers page+APIs+009 DDL; golden tests pending |
| 60 | TL Desk (4 pages + mail desk) | in progress | wave-1 commit 515a033: 4 pages + SLA engine + 010 DDL; golden tests + gmail creds → 90 |
| 70 | Utilities + sweep | pending | M |
| 80 | Data migration sweep + validation report | pending | per-module backfills inside each shard |
| 90 | Google-access phase | **STOP gate** | discuss each item with owner first |

## Log

- 2026-11-05 — Programme re-scoped: all 8 legacy builds present (server source complete for all modules); owner decisions D-FCR/D-SCHED/D-DATA/D-GOOGLE locked; shard 01 implemented; plan + shards written under `specs/cx-hub/`; `Dabdoob-CX-Productivity` rename → `CX-Hub` blocked (EPERM), then done manually by owner.
