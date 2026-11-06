/* verbatim port of the legacy Hub home page — thin route entry. */
import { OverviewPage } from '@/features/cx-hub/components/overview-page'

export default function Page() {
  return <OverviewPage route={{ title: 'Home' }} />
}
