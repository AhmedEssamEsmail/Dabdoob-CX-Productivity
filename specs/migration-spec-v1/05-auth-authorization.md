# Authentication & Authorization

See [MIGRATION_SPECIFICATION.md](../../MIGRATION_SPECIFICATION.md) Section 4 for complete auth/authorization design.

## Overview

Supabase Auth with custom claims for role-based access control and Row-Level Security (RLS) policies.

## User Roles

- `admin` - Full access to all data
- `tl` - Access to team data
- `agent` - Access to own data
- `specialist` - Agent-level access, not in agent lists
- `unknown` - No access

## Authentication Flow

1. User visits /auth/login
2. Enters email/password
3. Supabase Auth validates credentials
4. JWT token issued with custom claims (role, tl_email, country)
5. Token stored in httpOnly cookie
6. Subsequent requests include token
7. Middleware validates token and checks role
8. RLS policies enforce database access

## Next Steps

Extract complete auth implementation from MIGRATION_SPECIFICATION.md Section 4 during implementation.
