# Google Sign-in Setup Runbook

Manual prerequisites for Google OAuth sign-in on top of Supabase Auth. Do these
in order; steps 1-2 are required, step 3 is optional hardening.

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com) and select the
   project for your `dabdoob.com` Google Workspace.
2. **APIs & Services → OAuth consent screen**: configure the consent screen as
   an **Internal** app (dabdoob.com is a Google Workspace domain, so Internal
   restricts sign-in to Workspace accounts and Google itself rejects outside
   accounts). Fill in app name, support email and authorized domains
   (`dabdoob.com`).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   choose application type **Web application**. Add an authorized redirect URI:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Replace `<project-ref>` with your Supabase project reference (from
   `https://<project-ref>.supabase.co`).
4. Save the generated **Client ID** and **Client Secret** — you will paste
   them into Supabase in step 2. Never commit them anywhere.

## 2. Supabase Dashboard

1. Open your Supabase project dashboard:
   **Authentication → Sign In / Providers**.
2. Enable the **Google** provider.
3. Paste the **Client ID** and **Client Secret** from step 1 into the Google
   provider fields.
4. Under the project's **URL Configuration / Redirect URLs** allow-list, add
   the app callback for **production**:

   ```
   <site-url>/auth/callback
   ```

   `<site-url>` is your production origin (e.g.
   `https://kpis.dabdoob.com/auth/callback` — use your real site URL).
5. Add a **development** entry so local sign-in works:

   ```
   http://localhost:3000/auth/callback
   ```

6. Save. Supabase exchanges the Google code at
   `https://<project-ref>.supabase.co/auth/v1/callback`, then redirects to
   your site's `/auth/callback` route.

## 3. Optional hardening: `before_user_created` auth hook

A Supabase Auth hook can reject non-`@dabdoob.com` sign-ups at the identity
layer, before the app sees them.

1. Apply the migration file
   `supabase/migrations/20261109123839_before_user_created_domain_gate.sql`
   (requires user approval — see
   `specs/google-signin/results/S05.md`). This creates
   `public.reject_non_workspace_user(jsonb)`.
2. In the dashboard: **Authentication → Hooks → before user created**,
   enable the hook and select type **Supabase function**, pointing at
   `public.reject_non_workspace_user`.
3. Note: the app-side gate in `/auth/callback` already enforces the
   domain + roster rule and signs out denied users, so the hook is defense in
   depth, not required for correctness.

## 4. Smoke check and denial UX

Flow locations:

- Trigger: the login page (`/auth/login`) "Continue with Google" button POSTs
  to `POST /api/auth/google`, which starts the Supabase OAuth flow.
- Callback: `/auth/callback` exchanges the code, verifies the Google email is
  `@dabdoob.com` and matches an active roster row or `admin_emails`, then
  redirects to `/` on success.

Smoke check:

1. Sign out, open `/auth/login`, click "Continue with Google".
2. Choose a `@dabdoob.com` Google account that is on the roster (or in
   `admin_emails`). Expect: landing on `/` with your existing role.
3. Expect a `@dabdoob.com` Google account that is **not** on the roster to end
   back on `/auth/login` with a denial message.

Denial / error meaning — the callback redirects to `/auth/login?error=...`:

| Param        | Meaning                                                            |
|--------------|--------------------------------------------------------------------|
| `?error=denied` | Email is not `@dabdoob.com`, or not an active roster member / `admin_emails`. Session is revoked; no usable session remains. |
| `?error=auth`    | Code exchange or provider error — OAuth failed upstream (bad client creds, redirect URL not allow-listed, etc.). Sign out and retry. |

First Google sign-in auto-provisions an `auth.users` row; the roster is the
access gate, so an admin must add the email to the roster before a new user
can sign in successfully.
