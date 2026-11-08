/* verbatim port of the legacy Check-ins page — thin route entry. */
import { CheckinsPage } from '@/features/cx-queue/components/checkins-page'
import '@/app/styles/queue.css'

export default function Page() {
  return <CheckinsPage route={{ title: 'Check-ins' }} />
}
