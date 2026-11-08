# Spec index: S01 auth chain
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01-01 | mini | S01/01-proxy-getclaims.md | dev | none | #1 proxy.ts getUser->getClaims | 1/2/40/5 |
| S01-02 | mini | S01/02-identity-getclaims-cache.md | dev | none | #1 auth/identity getClaims + React cache + roster filter | 4/6/250/10 |

No shared files between the two leaves; both are dispatchable now.
