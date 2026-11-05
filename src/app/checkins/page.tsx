/* verbatim port of the legacy Check-ins page — thin route entry. */
import { CheckinsPage } from '@/features/cx-queue/components/checkins-page'

export default function Page() {
  return <CheckinsPage route={{ title: 'Check-ins' }} />
}
