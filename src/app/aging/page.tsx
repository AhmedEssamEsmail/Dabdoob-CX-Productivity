/* verbatim port of the legacy Aging cases page — thin route entry. */
import { AgingPage } from '@/features/cx-queue/components/aging-page'
import '@/app/styles/queue.css'

export default function Page() {
  return <AgingPage route={{ title: 'Aging cases' }} />
}
