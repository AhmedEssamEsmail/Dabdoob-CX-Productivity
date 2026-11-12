# ux report - headcount-access-split - round 2 (DELTA)

Verdict: PASS
Open: 0/0/0/3

States checked: loading, empty, error, success, disabled, long text, mobile, dark, keyboard, focus — unchanged from round 1 (delta is a one-line payload change; no markup/state added or removed). Unchecked items under "Not verified".

## Delta scope

Changed UI file (tl-6): `src/features/cx-hub/components/people-holidays-page.tsx` — line 126 only.

## Prior-findings verification

| ID | Sev | Status | file:line | Evidence | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | **FIXED** | people-holidays-page.tsx:126 | `employmentStatus: emp || undefined` — "Leave unchanged" (`emp === ''`) now serializes to `undefined`; `postJson` (fetch-json.ts:23) `JSON.stringify` drops the key; server `setPersonV2Fields` (roster.ts:605 `f.employmentStatus !== undefined`) skips both `employment_status` and `active` writes. 'Current'/'Left' still write and still sync `active` (roster.ts:607-608). The stored-'Current' → choose-'' path also no longer clears, matching tl-6's claim. Label is now truthful; destructive-as-no-op defect closed. Gates: tsc/eslint/vitest 18/18 PASS (tl-6 logs). | dev |
| ux-2 | LOW | OPEN (deferred per tl-6) | people-holidays-page.tsx:246-248 | `.cx-hint` still auto-places beside the Status field; fix unchanged: `grid-column: 1 / -1`. | dev |
| ux-3 | LOW | OPEN (deferred per tl-6) | people-holidays-page.tsx:213-218 | Mobile `Input` still default `type="text"`; fix unchanged: `type="tel"` + `inputMode="tel"`. | dev |
| ux-4 | LOW | OPEN (deferred, pre-existing) | admin-page.tsx:341 + cx-kit.css:389,461 | `.cx-switch` label still `cursor:pointer` over disabled track; fix unchanged: `:has(input:disabled) { cursor: not-allowed }`. | dev |

## New-change review (line 126)

- No markup, label, state, or styling added/removed — no new consistency, states, a11y, or interaction surface. Controlled select (`value={emp}`, empty option `value=""`) unchanged and still coherent.
- Behaviour edge cases checked: first-edit save with untouched Status → key dropped, no write (was: cleared). Stored 'Current' → re-pick '' → no write, 'Current' retained. 'Left'/'Current' → write + `active` sync intact.

## Not verified / assumptions

- No live render — verdicts computed from code; manual 375/1024px spot-check of the 12-col table + editor still recommended before ship (unchanged from round 1; e2e page-contract red pre-existing, gate-e2e-2).
- Round-1 product-confirmation assumptions remain open (not defects): specialist dropped to title axis in meeting picklists; Status select offers only Current/Left.
