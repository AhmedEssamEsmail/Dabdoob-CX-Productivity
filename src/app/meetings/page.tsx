/* verbatim port of the legacy Meetings page - thin route entry. */
import '@/app/styles/people.css'
import { MeetingsPage } from '@/features/cx-people/components/meetings-page'

export default function Page() {
  return <MeetingsPage route={{ title: 'Meetings' }} />
}
