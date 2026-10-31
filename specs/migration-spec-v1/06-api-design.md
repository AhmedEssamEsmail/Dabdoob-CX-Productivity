# API Design

See [MIGRATION_SPECIFICATION.md](../../MIGRATION_SPECIFICATION.md) Section 5 for complete API design.

## API Structure

```
/api/auth/
  ├── POST /login
  ├── POST /logout
  ├── POST /register
  └── GET /user

/api/productivity/
  ├── GET /flags [admin, tl, agent]
  ├── GET /flags/:id [admin, tl, agent]
  ├── POST /flags/:id/decide [admin, tl]
  ├── GET /review-page [admin, tl]
  ├── GET /my-page [admin, tl, agent]
  ├── GET /analytics [admin, tl]
  ├── POST /detect
  ├── POST /aggregate
  └── GET /flag-analytics [admin]

/api/tph/
  ├── GET /grid [admin, tl]
  ├── POST /tasks [admin, tl]
  ├── PUT /tasks/:id [admin, tl]
  ├── DELETE /tasks/:id [admin, tl]
  ├── GET /cases [admin, tl]
  └── GET /analytics [admin, tl]

/api/config/
  ├── GET /settings [admin]
  ├── PUT /settings/:key [admin]
  └── GET /settings/:key [admin, tl, agent]

/api/admin/
  ├── POST /setup [admin]
  ├── POST /install-triggers [admin]
  ├── POST /import-email [admin]
  └── POST /backfill [admin]
```

## Next Steps

Extract complete API implementation from MIGRATION_SPECIFICATION.md Section 5 during implementation.
