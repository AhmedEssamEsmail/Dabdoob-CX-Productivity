-- before_user_created auth hook target: reject signups whose email is not in
-- the dabdoob.com Google Workspace domain. Defense-in-depth only — the
-- app-side callback gate remains the primary enforcement. Enable the hook in
-- the dashboard (runbook step, not part of this migration).

create or replace function public.reject_non_workspace_user(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(trim(coalesce(event->'user'->>'email', '')));
begin
  -- No email (e.g. phone signup): allow; the app-side gate still applies.
  if email like '%@dabdoob.com' then
    return event;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sign-in is restricted to @dabdoob.com accounts.'
    )
  );
end;
$$;

revoke execute on function public.reject_non_workspace_user(jsonb)
  from public, anon, authenticated;
grant execute on function public.reject_non_workspace_user(jsonb)
  to supabase_auth_admin;
