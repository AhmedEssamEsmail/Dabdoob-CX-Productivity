/* verbatim port of the legacy TL scheduler page — thin route entry. */
import { SchedulerPage } from '@/features/cx-queue/components/scheduler-page'
import '@/app/styles/queue.css'

export default function Page() {
  return <SchedulerPage route={{ title: 'TL scheduler' }} />
}
