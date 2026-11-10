-- WP-32 / WP-F4 — seed tracker_fields for the 5 built-in trackers.
--
-- 009_operations.sql seeded the `trackers` registry rows only; the field rows
-- that legacy `seedTrackerRegistry_()` (Operations_deprecated/Trackers.js:134-160)
-- writes on first access were never ported, so fresh environments showed
-- fieldless built-ins until the TrackerFields tab migrated (WP-51, needs Google
-- access). These 61 rows are that function's exact output for BUILTIN_TRACKERS
-- (Trackers.js:53-88): field_id = slugId_(label, 20), position = index + 1,
-- column_header = label, list_key = tracker.<id>.<field_id> for dropdown fields,
-- parent_field_id = '', auto from the definition (blocked_by -> 'actor_name'),
-- active = true.
--
-- Verified verbatim against the live `TrackerFields` tab (CC2 Core, 2026-11-06)
-- — every built-in field_id/label/type/required/list_key matches. The later
-- additions in that tab (customer_strikes `order_id`/`order_amount`,
-- damaged_items_5917) are NOT built-ins: they migrate via the TrackerFields ->
-- tracker_fields mapping, not this seed. Upsert-on-(tracker_id,field_id) in the
-- migration run then overlays the real sheet rows on these seeds idempotently.
--
-- Dropdown CHOICES are not here: legacy stores them in Options under
-- `tracker.<tracker_id>.<field_id>` (setupTrackers seeds them from sheet data;
-- the Options tab migration carries them — WP-31).

INSERT INTO tracker_fields (field_id, tracker_id, position, label, column_header, type, required, list_key, parent_field_id, auto, active, submitted_by)
VALUES
  -- blocked_customers (8)
  ('customer_id', 'blocked_customers', 1, 'Customer ID', 'Customer ID', 'text', true, '', '', '', true, 'system:seed'),
  ('name', 'blocked_customers', 2, 'Name', 'Name', 'text', false, '', '', '', true, 'system:seed'),
  ('mail', 'blocked_customers', 3, 'Mail', 'Mail', 'text', false, '', '', '', true, 'system:seed'),
  ('phone', 'blocked_customers', 4, 'Phone', 'Phone', 'text', false, '', '', '', true, 'system:seed'),
  ('reason', 'blocked_customers', 5, 'Reason', 'Reason', 'dropdown', true, 'tracker.blocked_customers.reason', '', '', true, 'system:seed'),
  ('block_date', 'blocked_customers', 6, 'Block Date', 'Block Date', 'date', true, '', '', '', true, 'system:seed'),
  ('profile_link', 'blocked_customers', 7, 'Profile Link', 'Profile Link', 'text', false, '', '', '', true, 'system:seed'),
  ('blocked_by', 'blocked_customers', 8, 'Blocked by', 'Blocked by', 'text', false, '', '', 'actor_name', true, 'system:seed'),
  -- promocodes (5)
  ('promo_code', 'promocodes', 1, 'Promo Code', 'Promo Code', 'text', true, '', '', '', true, 'system:seed'),
  ('percentage_or_fixed', 'promocodes', 2, 'Percentage or Fixed Value?', 'Percentage or Fixed Value?', 'dropdown', true, 'tracker.promocodes.percentage_or_fixed', '', '', true, 'system:seed'),
  ('value_fixed_or_perce', 'promocodes', 3, 'Value (Fixed or Percentage)', 'Value (Fixed or Percentage)', 'text', true, '', '', '', true, 'system:seed'),
  ('cap', 'promocodes', 4, 'Cap', 'Cap', 'text', false, '', '', '', true, 'system:seed'),
  ('select_countries_all', 'promocodes', 5, 'Select Countries Allowed to Use the Code', 'Select Countries Allowed to Use the Code', 'dropdown', true, 'tracker.promocodes.select_countries_all', '', '', true, 'system:seed'),
  -- operational_loss (21)
  ('date_of_loss', 'operational_loss', 1, 'Date of Loss', 'Date of Loss', 'date', true, '', '', '', true, 'system:seed'),
  ('reported_date', 'operational_loss', 2, 'Reported Date', 'Reported Date', 'date', false, '', '', '', true, 'system:seed'),
  ('team_liability', 'operational_loss', 3, 'Team Liability', 'Team Liability', 'dropdown', false, 'tracker.operational_loss.team_liability', '', '', true, 'system:seed'),
  ('liability_reason', 'operational_loss', 4, 'Liability Reason', 'Liability Reason', 'dropdown', false, 'tracker.operational_loss.liability_reason', '', '', true, 'system:seed'),
  ('loss_description', 'operational_loss', 5, 'Loss Description', 'Loss Description', 'text', true, '', '', '', true, 'system:seed'),
  ('root_cause', 'operational_loss', 6, 'Root Cause', 'Root Cause', 'text', false, '', '', '', true, 'system:seed'),
  ('country', 'operational_loss', 7, 'Country', 'Country', 'dropdown', true, 'tracker.operational_loss.country', '', '', true, 'system:seed'),
  ('order_id', 'operational_loss', 8, 'Order ID', 'Order ID', 'text', false, '', '', '', true, 'system:seed'),
  ('item_id', 'operational_loss', 9, 'Item ID', 'Item ID', 'text', false, '', '', '', true, 'system:seed'),
  ('ticket_id_if_applica', 'operational_loss', 10, 'Ticket ID (If Applicable)', 'Ticket ID (If Applicable)', 'text', false, '', '', '', true, 'system:seed'),
  ('loss_amount', 'operational_loss', 11, 'Loss Amount', 'Loss Amount', 'text', true, '', '', '', true, 'system:seed'),
  ('currancy', 'operational_loss', 12, 'Currancy', 'Currancy', 'dropdown', false, 'tracker.operational_loss.currancy', '', '', true, 'system:seed'),
  ('actions_taken', 'operational_loss', 13, 'Actions Taken', 'Actions Taken', 'text', false, '', '', '', true, 'system:seed'),
  ('responsible_person', 'operational_loss', 14, 'Responsible Person', 'Responsible Person', 'text', false, '', '', '', true, 'system:seed'),
  ('status', 'operational_loss', 15, 'Status', 'Status', 'dropdown', false, 'tracker.operational_loss.status', '', '', true, 'system:seed'),
  ('approval_date', 'operational_loss', 16, 'Approval Date', 'Approval Date', 'date', false, '', '', '', true, 'system:seed'),
  ('approver', 'operational_loss', 17, 'Approver', 'Approver', 'text', false, '', '', '', true, 'system:seed'),
  ('loss_trigger_type', 'operational_loss', 18, 'Loss Trigger Type', 'Loss Trigger Type', 'dropdown', false, 'tracker.operational_loss.loss_trigger_type', '', '', true, 'system:seed'),
  ('detected_by', 'operational_loss', 19, 'Detected By', 'Detected By', 'dropdown', false, 'tracker.operational_loss.detected_by', '', '', true, 'system:seed'),
  ('loss_in_kd', 'operational_loss', 20, 'Loss In KD', 'Loss In KD', 'computed', false, '', '', '', true, 'system:seed'),
  ('final_liability', 'operational_loss', 21, 'Final Liability', 'Final Liability', 'text', false, '', '', '', true, 'system:seed'),
  -- customer_strikes (3 built-in fields; order_id/order_amount were added later
  -- via the builder and arrive through the TrackerFields tab migration)
  ('customer_profile', 'customer_strikes', 1, 'Customer Profile', 'Customer Profile', 'text', true, '', '', '', true, 'system:seed'),
  ('strike_reason', 'customer_strikes', 2, 'Strike Reason', 'Strike Reason', 'dropdown', true, 'tracker.customer_strikes.strike_reason', '', '', true, 'system:seed'),
  ('reference_ticket', 'customer_strikes', 3, 'Reference Ticket', 'Reference Ticket', 'text', true, '', '', '', true, 'system:seed'),
  -- refund_ledger (24, all type 'text', view-only tracker)
  ('status', 'refund_ledger', 1, 'Status', 'Status', 'text', false, '', '', '', true, 'system:seed'),
  ('order_number', 'refund_ledger', 2, 'Order number', 'Order number', 'text', false, '', '', '', true, 'system:seed'),
  ('reference_number', 'refund_ledger', 3, 'Reference number', 'Reference number', 'text', false, '', '', '', true, 'system:seed'),
  ('confirmed_at', 'refund_ledger', 4, 'Confirmed at', 'Confirmed at', 'text', false, '', '', '', true, 'system:seed'),
  ('reason', 'refund_ledger', 5, 'Reason', 'Reason', 'text', false, '', '', '', true, 'system:seed'),
  ('shipping_policy', 'refund_ledger', 6, 'Shipping policy', 'Shipping policy', 'text', false, '', '', '', true, 'system:seed'),
  ('policy_overridden', 'refund_ledger', 7, 'Policy overridden', 'Policy overridden', 'text', false, '', '', '', true, 'system:seed'),
  ('market', 'refund_ledger', 8, 'Market', 'Market', 'text', false, '', '', '', true, 'system:seed'),
  ('currency', 'refund_ledger', 9, 'Currency', 'Currency', 'text', false, '', '', '', true, 'system:seed'),
  ('items_subtotal', 'refund_ledger', 10, 'Items subtotal', 'Items subtotal', 'text', false, '', '', '', true, 'system:seed'),
  ('shipping_net', 'refund_ledger', 11, 'Shipping net', 'Shipping net', 'text', false, '', '', '', true, 'system:seed'),
  ('vat_on_shipping', 'refund_ledger', 12, 'VAT on shipping', 'VAT on shipping', 'text', false, '', '', '', true, 'system:seed'),
  ('shipping_vat', 'refund_ledger', 13, 'Shipping VAT', 'Shipping VAT', 'text', false, '', '', '', true, 'system:seed'),
  ('shipping_charged', 'refund_ledger', 14, 'Shipping charged', 'Shipping charged', 'text', false, '', '', '', true, 'system:seed'),
  ('discount', 'refund_ledger', 15, 'Discount', 'Discount', 'text', false, '', '', '', true, 'system:seed'),
  ('discount_total', 'refund_ledger', 16, 'Discount total', 'Discount total', 'text', false, '', '', '', true, 'system:seed'),
  ('order_total_computed', 'refund_ledger', 17, 'Order total (computed)', 'Order total (computed)', 'text', false, '', '', '', true, 'system:seed'),
  ('order_total_on_recor', 'refund_ledger', 18, 'Order total (on record)', 'Order total (on record)', 'text', false, '', '', '', true, 'system:seed'),
  ('refund_type', 'refund_ledger', 19, 'Refund type', 'Refund type', 'text', false, '', '', '', true, 'system:seed'),
  ('items_refunded', 'refund_ledger', 20, 'Items refunded', 'Items refunded', 'text', false, '', '', '', true, 'system:seed'),
  ('shipping_refunded', 'refund_ledger', 21, 'Shipping refunded', 'Shipping refunded', 'text', false, '', '', '', true, 'system:seed'),
  ('adjustment', 'refund_ledger', 22, 'Adjustment', 'Adjustment', 'text', false, '', '', '', true, 'system:seed'),
  ('refund_total', 'refund_ledger', 23, 'REFUND TOTAL', 'REFUND TOTAL', 'text', false, '', '', '', true, 'system:seed'),
  ('breakdown', 'refund_ledger', 24, 'Breakdown', 'Breakdown', 'text', false, '', '', '', true, 'system:seed')
ON CONFLICT (tracker_id, field_id) DO NOTHING;
