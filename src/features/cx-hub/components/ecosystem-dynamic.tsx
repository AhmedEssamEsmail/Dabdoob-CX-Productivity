'use client'
/* `ssr:false` is only valid in client components — see
 * node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md */
import dynamic from 'next/dynamic'

const EcosystemPage = dynamic(
  () => import('./ecosystem-page').then(m => m.EcosystemPage),
  {
    ssr: false,
    loading: () => (
      <div className="eco3-page">
        <div className="eco3-page-msg" role="status">
          <p>Loading the ecosystem…</p>
        </div>
        <header className="eco3-head">
          <h1>Ecosystem</h1>
        </header>
      </div>
    ),
  }
)

export function EcosystemDynamic() {
  return <EcosystemPage />
}
