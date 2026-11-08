/* verbatim port of the legacy Quality Team scores page — thin route entry. */
import '@/app/styles/quality.css'
import QualityScoresPage from '@/features/cx-quality/components/quality-scores-page'

export default function Page() {
  return <QualityScoresPage route={{ title: 'Team scores' }} />
}
