/* verbatim port of the legacy Admin page — thin route entry. */
import '@/app/styles/hub.css'
import { AdminPage } from '@/features/cx-hub/components/admin-page'

export default function Page() {
  return (
    <AdminPage
      route={{ title: 'Admin', purpose: 'Roster, settings, dropdown choices, email log and scheduled jobs.' }}
    />
  )
}
