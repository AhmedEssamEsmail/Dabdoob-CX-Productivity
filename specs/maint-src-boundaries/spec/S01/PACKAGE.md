# S01: fetchJson moves to one framework-independent shared module
Kind: package
ID: S01
Dispatch: NEVER

## Goal and contract
`fetchJson(url, init?: RequestInit)` (the `cache: 'no-store'` + `{error}`-envelope
variant, currently `pv-shared.tsx:60-65`) lives at
`src/features/shared/lib/fetch-json.ts` — unmarked, client-safe, byte-identical
behavior. All 9 consumers import it from there; `pv-shared.tsx` no longer exports it.
Do NOT unify with the other three variants (`hub-shared.tsx:69`,
`cx-queue/components/shared.tsx:87`, `qa-shared.tsx:50`) — intentional.
End state: no re-export shim in pv-shared; every intermediate state compiles.

## Children
Index: `S01/00-index.md`
- #1 -> S01-01 (new module), S01-02..04 (repoint 9 consumers), S01-05 (drop export)

## Completion
`tsc` clean; pv-shared has no `fetchJson`; all consumers import the shared module.
