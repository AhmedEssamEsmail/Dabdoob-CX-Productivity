-- S01-01: bulk-close historical CTLs that are still open/on_hold.
-- Historical = imported from the pre-tool sheet: ctl_id 'hist-<Call ID>'
-- (ops-tabs.ts 'CTL & Quality' transform) OR audit_id pointing at a
-- qa_audits row marked status='historical' or sample_basis='historical'.
-- Mirrors the done-shape submitQaCtl writes (status/outcome/submitted_*/
-- sla_met/closed_by). Idempotent: the status guard makes re-run a no-op.

update qa_ctls
set
  status = 'confirmed',
  outcome = 'acknowledged',
  submitted_date = coalesce(nullif(reminded_date, ''), nullif(opened_date, ''), due_date),
  -- Sheet dates are unnormalized text (ops-tabs.ts 'ctl date', e.g. 'M/D/YYYY').
  -- Only cast when the coalesced candidate d matches ISO 'YYYY-MM-DD*';
  -- otherwise submitted_at stays NULL so the UPDATE can never fail at apply time.
  submitted_at = case
    when coalesce(nullif(reminded_date, ''), nullif(opened_date, ''), due_date) ~ '^\d{4}-\d{2}-\d{2}'
      then coalesce(nullif(reminded_date, ''), nullif(opened_date, ''), due_date)::timestamptz
    else null
  end,
  sla_met = case
    when coalesce(nullif(reminded_date, ''), nullif(opened_date, ''), due_date) ~ '^\d{4}-\d{2}-\d{2}'
      and due_date ~ '^\d{4}-\d{2}-\d{2}'
      then case
        when coalesce(nullif(reminded_date, ''), nullif(opened_date, ''), due_date)::date <= due_date::date
          then 'true'
        else 'false'
      end
    else 'false'
  end,
  closed_by = tl_email,
  updated_by = 'history closeout',
  updated_at = now(),
  coaching_notes = coalesce(nullif(coaching_notes, ''), 'Coached before the QA tool.')
where status in ('open', 'on_hold')
  and (
    ctl_id like 'hist-%'
    or (
      audit_id <> ''
      and audit_id in (
        select audit_id
        from qa_audits
        where status = 'historical' or sample_basis = 'historical'
      )
    )
  );
