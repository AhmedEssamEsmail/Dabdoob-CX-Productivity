import Link from 'next/link'

export default function Home() {
  return (
    <div className="workspace-home">
      <section className="workspace-home__intro">
        <p className="workspace-home__eyebrow">CX HELM / PRODUCTIVITY</p>
        <h1>Make the work visible.</h1>
        <p>
          Review status, track your productivity, and keep hourly workload in
          view.
        </p>
      </section>

      <section className="workspace-home__section" aria-labelledby="workspace-title">
        <div className="workspace-home__section-heading">
          <div>
            <p className="workspace-home__eyebrow">YOUR WORKSPACE</p>
            <h2 id="workspace-title">Choose where to start</h2>
          </div>
          <span className="workspace-home__date">3 WORK AREAS</span>
        </div>

        <div className="workspace-home__grid">
          <Link href="/status-validation" className="workspace-card workspace-card--lead">
            <span className="workspace-card__index">01 / REVIEW</span>
            <span className="workspace-card__icon" aria-hidden="true">↗</span>
            <h3>Status validation</h3>
            <p>Review flagged idle time and decide how it should count.</p>
            <span className="workspace-card__link">Open review <span aria-hidden="true">→</span></span>
          </Link>
          <Link href="/my-status" className="workspace-card">
            <span className="workspace-card__index">02 / PERSONAL</span>
            <span className="workspace-card__icon" aria-hidden="true">◷</span>
            <h3>My status</h3>
            <p>See your productivity score and recent status intervals.</p>
            <span className="workspace-card__link">View my status <span aria-hidden="true">→</span></span>
          </Link>
          <Link href="/tph-grid" className="workspace-card">
            <span className="workspace-card__index">03 / TEAM</span>
            <span className="workspace-card__icon" aria-hidden="true">▦</span>
            <h3>TPH grid</h3>
            <p>Compare hourly case volume, channel assignment, and touches.</p>
            <span className="workspace-card__link">Open TPH grid <span aria-hidden="true">→</span></span>
          </Link>
        </div>
      </section>
    </div>
  )
}
