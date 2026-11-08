/* verbatim port of the legacy Queue health page — thin route entry. */
import { QueuePage } from '@/features/cx-queue/components/queue-page'
import '@/app/styles/queue.css'

export default function Page() {
  return <QueuePage route={{ title: 'Queue health' }} />
}
