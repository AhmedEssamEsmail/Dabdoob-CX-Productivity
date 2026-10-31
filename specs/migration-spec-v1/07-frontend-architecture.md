# Frontend Architecture

See [MIGRATION_SPECIFICATION.md](../../MIGRATION_SPECIFICATION.md) Section 6 for complete frontend architecture.

## Next.js App Structure

```
app/
├── auth/
│   ├── login/page.tsx
│   ├── logout/page.tsx
│   └── register/page.tsx
├── status-validation/
│   ├── page.tsx
│   └── components/
├── my-status/
│   ├── page.tsx
│   └── components/
├── tph/
│   ├── page.tsx
│   └── components/
├── admin/
│   ├── page.tsx
│   └── settings/page.tsx
├── layout.tsx
├── page.tsx
└── globals.css
```

## Next Steps

Extract complete frontend implementation from MIGRATION_SPECIFICATION.md Section 6 during implementation.
