import Link from 'next/link'

const AREAS = [
  {
    href: '/status-validation',
    title: 'Status validation',
    purpose:
      'IDLE time with cases in it, flagged for your review: accept the status it counts as, or revert with a reason.',
  },
  {
    href: '/my-status',
    title: 'My status',
    purpose:
      'Your flagged IDLE time, raw, suggested and reviewed, and your productivity before and after; dispute a flag.',
  },
  {
    href: '/tph',
    title: 'TPH and caps',
    purpose:
      'Which channel each agent is on, the cases waiting each hour, and each agent\u2019s touches against their share of them.',
  },
]

/** Landing hub rendered with the legacy page chrome (page/page-head/cx-panel). */
export default function Home() {
  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          CX Helm Productivity
        </h1>
        <p className="page-purpose">
          Review status, track your productivity, and keep hourly workload in view.
        </p>
      </header>
      <div className="cx-grid-2">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="cx-panel cx-panel--pad">
            <h2 className="cx-section__title">{a.title}</h2>
            <p className="cx-muted">{a.purpose}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
