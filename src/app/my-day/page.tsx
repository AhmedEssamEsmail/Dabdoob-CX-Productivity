/* verbatim port of the legacy My day page — thin route entry. */
import '@/app/styles/hub.css'
import { MyDayPage } from '@/features/cx-hub/components/my-day-page'

export default function Page() {
  return <MyDayPage route={{ title: 'My day' }} />
}
