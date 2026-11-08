/* verbatim port of the legacy Analytics page — thin route entry. */
import { AnalyticsPage } from '@/features/cx-queue/components/analytics-page'
import '@/app/styles/queue.css'

export default function Page() {
  return <AnalyticsPage route={{ title: 'Analytics' }} />
}
