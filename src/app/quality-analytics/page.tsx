/* verbatim port of the legacy Quality analytics page — thin route entry. */
import '@/app/styles/quality.css'
import { QualityAnalyticsPage } from '@/features/cx-quality/components/quality-analytics-page'

export default function Page() {
  return <QualityAnalyticsPage route={{ title: 'Quality analytics' }} />
}
