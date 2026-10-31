# Test Coverage Plan

## Overview
This plan defines comprehensive test coverage for the CX Helm Productivity system migration, ensuring reliability, correctness, and maintainability.

## Test Strategy

### Testing Pyramid
```
          /\
         /E2E\        - 10% of tests
        /------\
       /Integration\  - 30% of tests
      /------------\
     /   Unit Tests \ - 60% of tests
    /----------------\
```

### Test Tools
- **Unit Tests:** Vitest
- **Integration Tests:** Vitest + Supabase test client
- **E2E Tests:** Playwright
- **Performance Tests:** Lighthouse CI
- **Security Tests:** npm audit, Snyk, custom security checks

## 1. Unit Tests

### 1.1 Auth Helpers (`src/lib/auth.ts`)
**File:** `src/lib/auth.test.ts`

**Test Cases:**
- [ ] `getUser()` returns user from cookies
- [ ] `getUser()` returns null when no session
- [ ] `requireAuth()` returns user when authenticated
- [ ] `requireAuth()` throws when not authenticated
- [ ] `requireRole()` returns user when role matches
- [ ] `requireRole()` throws when role doesn't match
- [ ] `requireRole()` accepts multiple roles
- [ ] `getViewAsUser()` returns view-as target when active
- [ ] `getViewAsUser()` returns original user when no view-as

**Coverage Target:** 100%

### 1.2 Supabase Client (`src/lib/supabase.ts`)
**File:** `src/lib/supabase.test.ts`

**Test Cases:**
- [ ] `createClient()` creates client with correct URL
- [ ] `createClient()` creates client with correct anon key
- [ ] `createClient()` handles service role key correctly
- [ ] `createClient()` respects environment variables

**Coverage Target:** 100%

### 1.3 Productivity Logic
**File:** `src/lib/productivity.test.ts`

**Test Cases:**
- [ ] Interval parsing from CSV rows
- [ ] Flag detection logic (window-based case counting)
- [ ] Confidence score calculation
- [ ] Auto-accept threshold logic
- [ ] Productivity percentage calculation
- [ ] Daily layer computation
- [ ] Status normalization
- [ ] Hash function stability (same input = same hash)

**Coverage Target:** 95%+

### 1.4 TPH Logic
**File:** `src/lib/tph.test.ts`

**Test Cases:**
- [ ] Channel-based case counting
- [ ] Cap calculation (minutes per case)
- [ ] Slot calculation (hour-based)
- [ ] Touch counting
- [ ] Call time estimation
- [ ] Cap window enforcement (before :55 only)

**Coverage Target:** 95%+

### 1.5 Configuration Helpers
**File:** `src/lib/config.test.ts`

**Test Cases:**
- [ ] Config value retrieval
- [ ] Config value parsing (JSON, numbers, booleans)
- [ ] Default value fallback
- [ ] Config validation

**Coverage Target:** 100%

### 1.6 Utility Functions
**File:** `src/lib/utils.test.ts`

**Test Cases:**
- [ ] Date parsing with timezone
- [ ] Date formatting
- [ ] String normalization
- [ ] Array helpers
- [ ] Validation helpers

**Coverage Target:** 100%

## 2. Integration Tests

### 2.1 API Routes - Productivity
**File:** `src/app/api/prod/__tests__/integration.test.ts`

**Test Cases:**
- [ ] GET `/api/prod/flags` returns flags for authenticated user
- [ ] GET `/api/prod/flags` respects role-based access
- [ ] GET `/api/prod/flags` filters by date range
- [ ] POST `/api/prod/flags` accepts flag with confidence
- [ ] POST `/api/prod/flags` rejects flag with low confidence
- [ ] POST `/api/prod/flags` logs flag decision
- [ ] GET `/api/prod/intervals` returns intervals for user
- [ ] GET `/api/prod/intervals` respects view-as
- [ ] GET `/api/prod/daily-layers` returns daily layers
- [ ] GET `/api/prod/analytics` returns analytics data

**Setup:** Supabase test database with seeded data

### 2.2 API Routes - TPH
**File:** `src/app/api/tph/__tests__/integration.test.ts`

**Test Cases:**
- [ ] GET `/api/tph/days` returns TPH days for user
- [ ] GET `/api/tph/days` respects role-based access
- [ ] POST `/api/tph/tasks` creates task
- [ ] POST `/api/tph/tasks` validates channel
- [ ] DELETE `/api/tph/tasks` removes task (within edit window)
- [ ] GET `/api/tph/cases` returns cases for date
- [ ] POST `/api/tph/cases` updates manual cases

**Setup:** Supabase test database with seeded TPH data

### 2.3 API Routes - Quality & FCR
**File:** `src/app/api/quality/__tests__/integration.test.ts`

**Test Cases:**
- [ ] GET `/api/quality/audits` returns audits for user
- [ ] POST `/api/quality/audits` creates audit
- [ ] POST `/api/quality/audits` validates score range
- [ ] GET `/api/fcr/daily` returns FCR data
- [ ] GET `/api/fcr/daily` filters by date range

**Setup:** Supabase test database with seeded quality data

### 2.4 API Routes - Roster & Config
**File:** `src/app/api/__tests__/integration.test.ts`

**Test Cases:**
- [ ] GET `/api/roster` returns roster (admin only)
- [ ] GET `/api/roster` returns team (TL only)
- [ ] GET `/api/roster` returns self (agent only)
- [ ] POST `/api/roster` adds user (admin only)
- [ ] PUT `/api/roster` updates user (admin only)
- [ ] GET `/api/config` returns config
- [ ] PUT `/api/config` updates config (admin only)
- [ ] PUT `/api/config` validates config keys

**Setup:** Supabase test database with seeded config and roster

### 2.5 API Routes - View-As
**File:** `src/app/api/view-as/__tests__/integration.test.ts`

**Test Cases:**
- [ ] POST `/api/view-as` starts view-as (TL/admin only)
- [ ] POST `/api/view-as` validates target is in team
- [ ] POST `/api/view-as` logs view-as action
- [ ] POST `/api/view-as` stops view-as
- [ ] GET `/api/view-as` returns current view-as state

**Setup:** Supabase test database with seeded roster and view_as tables

### 2.6 Scheduled Jobs
**File:** `src/app/api/cron/__tests__/integration.test.ts`

**Test Cases:**
- [ ] POST `/api/cron/flag-detection` detects flags from intervals
- [ ] POST `/api/cron/flag-detection` auto-accepts high confidence flags
- [ ] POST `/api/cron/flag-detection` logs detection
- [ ] POST `/api/cron/analytics-aggregation` computes analytics
- [ ] POST `/api/cron/analytics-aggregation` stores aggregated data
- [ ] POST `/api/cron/daily-layers` computes daily layers
- [ ] POST `/api/cron/daily-layers` stores raw and effective layers

**Setup:** Supabase test database with intervals and cases

### 2.7 Authentication Flow
**File:** `src/app/api/auth/__tests__/integration.test.ts`

**Test Cases:**
- [ ] POST `/api/auth/login` authenticates with email/password
- [ ] POST `/api/auth/login` rejects invalid credentials
- [ ] POST `/api/auth/login` creates session
- [ ] POST `/api/auth/logout` destroys session
- [ ] Middleware protects routes
- [ ] Middleware redirects unauthenticated users
- [ ] Middleware respects role-based access

**Setup:** Supabase test database with seeded users

## 3. E2E Tests (Playwright)

### 3.1 Authentication Flow
**File:** `e2e/auth.spec.ts`

**Test Cases:**
- [ ] User can log in with valid credentials
- [ ] User cannot log in with invalid credentials
- [ ] User is redirected to login when accessing protected route
- [ ] User can log out
- [ ] Session persists across page reloads
- [ ] User role is enforced (admin, TL, agent)

### 3.2 Status Validation Page
**File:** `e2e/status-validation.spec.ts`

**Test Cases:**
- [ ] TL can view team flags
- [ ] Agent can view own flags
- [ ] Flag table displays correctly
- [ ] Status badges have correct colors
- [ ] Confidence scores display correctly
- [ ] TL can accept flag
- [ ] TL can reject flag
- [ ] TL can change suggested status
- [ ] Accept action logs correctly
- [ ] View-as works for status validation

### 3.3 My Status Page
**File:** `e2e/my-status.spec.ts`

**Test Cases:**
- [ ] Agent can view own productivity score
- [ ] Productivity score displays correctly
- [ ] Daily layers display correctly
- [ ] Intervals list displays correctly
- [ ] Status colors match original design
- [ ] Date range filter works
- [ ] View-as works for my status

### 3.4 TPH Grid
**File:** `e2e/tph-grid.spec.ts`

**Test Cases:**
- [ ] TPH grid displays hourly slots
- [ ] Channels display correctly
- [ ] Agent can log activity
- [ ] TL can log activity for team
- [ ] Cap indicators display correctly
- [ ] Case counts display correctly
- [ ] Edit window enforced (3 days)
- [ ] Admin can edit older entries

### 3.5 Admin Pages
**File:** `e2e/admin.spec.ts`

**Test Cases:**
- [ ] Admin can access config page
- [ ] Admin can update config values
- [ ] Admin can access roster page
- [ ] Admin can add user to roster
- [ ] Admin can update user in roster
- [ ] Admin can deactivate user
- [ ] TL cannot access admin pages
- [ ] Agent cannot access admin pages

### 3.6 Responsive Design
**File:** `e2e/responsive.spec.ts`

**Test Cases:**
- [ ] Layout works on mobile (375px)
- [ ] Layout works on tablet (768px)
- [ ] Layout works on desktop (1280px)
- [ ] Side rail collapses on mobile
- [ ] Navigation adapts to screen size
- [ ] Tables scroll horizontally on mobile

### 3.7 Dark Mode
**File:** `e2e/dark-mode.spec.ts`

**Test Cases:**
- [ ] Dark mode toggle works
- [ ] Dark mode preference persists
- [ ] Dark mode respects system preference
- [ ] All colors render correctly in dark mode
- [ ] Text contrast is readable in dark mode

### 3.8 RTL/Arabic Support
**File:** `e2e/rtl.spec.ts`

**Test Cases:**
- [ ] Arabic language toggle works
- [ ] Layout mirrors correctly for RTL
- [ ] Arabic font loads correctly
- [ ] Text direction is correct
- [ ] Spacing adjusts for RTL

## 4. Performance Tests

### 4.1 API Performance
**File:** `performance/api.spec.ts`

**Test Cases:**
- [ ] `/api/prod/flags` responds within 500ms (1000 records)
- [ ] `/api/prod/intervals` responds within 500ms (1000 records)
- [ ] `/api/tph/days` responds within 500ms (30 days)
- [ ] `/api/quality/audits` responds within 500ms (1000 records)
- [ ] Scheduled jobs complete within 30s (1000 agents)

**Tools:** Lighthouse CI, custom load tests

### 4.2 Frontend Performance
**File:** `performance/frontend.spec.ts`

**Test Cases:**
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Total Blocking Time < 300ms

**Tools:** Lighthouse CI

### 4.3 Database Performance
**File:** `performance/database.spec.ts`

**Test Cases:**
- [ ] Flag detection query < 5s (1000 intervals)
- [ ] Analytics aggregation < 10s (1000 agents)
- [ ] Daily layer computation < 5s (1000 agents)
- [ ] Roster query < 100ms (1000 users)

**Tools:** Supabase query analysis, EXPLAIN ANALYZE

## 5. Security Tests

### 5.1 Authentication Security
**File:** `security/auth.spec.ts`

**Test Cases:**
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are blocked
- [ ] CSRF protection works
- [ ] Session tokens are secure (httpOnly, secure)
- [ ] Password hashing is correct (bcrypt/supabase auth)
- [ ] Rate limiting works on login

### 5.2 Authorization Security
**File:** `security/authorization.spec.ts`

**Test Cases:**
- [ ] Agent cannot access admin endpoints
- [ ] Agent cannot access other agent's data
- [ ] TL cannot access other TL's team data
- [ ] View-as is restricted to TL/admin
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 403 for unauthorized requests

### 5.3 Data Security
**File:** `security/data.spec.ts`

**Test Cases:**
- [ ] Sensitive data is not logged
- [ ] Secrets are not exposed in client code
- [ ] Environment variables are secure
- [ ] Database connection uses SSL
- [ ] RLS policies are enforced
- [ ] Service role key is never exposed to client

### 5.4 Dependency Security
**File:** `security/dependencies.spec.ts`

**Test Cases:**
- [ ] No high-severity vulnerabilities in dependencies
- [ ] Dependencies are up-to-date
- [ ] License compliance check

**Tools:** npm audit, Snyk, Dependabot

## 6. Test Execution Plan

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    - Run: npm run test:unit
    - Coverage: 90%+
  integration:
    - Run: npm run test:integration
    - Requires: test database
  e2e:
    - Run: npm run test:e2e
    - Requires: test environment
  performance:
    - Run: npm run test:performance
    - Thresholds: defined in Lighthouse CI
  security:
    - Run: npm audit
    - Run: Snyk test
```

### Local Development
```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run security audit
npm run test:security
```

## 7. Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Unit Tests | 90%+ | TBD |
| Integration Tests | 80%+ | TBD |
| E2E Tests | Critical paths | TBD |
| Performance | All thresholds met | TBD |
| Security | 0 high vulnerabilities | TBD |

## 8. Test Data Management

### Fixtures
- `tests/fixtures/users.json` - Test users
- `tests/fixtures/roster.json` - Test roster
- `tests/fixtures/intervals.json` - Test intervals
- `tests/fixtures/flags.json` - Test flags
- `tests/fixtures/tph.json` - Test TPH data

### Database Seeding
- `tests/seed.sql` - SQL seed script
- `tests/seed.ts` - TypeScript seed script

### Cleanup
- Truncate tables after each test
- Rollback transactions for integration tests
- Clean up temporary files

## 9. Test Documentation

### Test Reports
- HTML coverage report: `coverage/index.html`
- Test results: `test-results/`
- Performance report: `performance-report/`
- Security report: `security-report/`

### Living Documentation
- Tests serve as documentation for expected behavior
- Update documentation when tests change
- Keep test descriptions clear and descriptive

## 10. Continuous Improvement

### Metrics to Track
- Test execution time
- Test flakiness rate
- Coverage trends
- Bug detection rate (tests catching bugs in production)

### Regular Reviews
- Monthly: Review test coverage gaps
- Quarterly: Review test strategy
- Annually: Update test tools and frameworks
