/* verbatim port of the legacy Coaching page - thin route entry. */
import '@/app/styles/people.css'
import { CoachingPage } from '@/features/cx-people/components/coaching-page'

export default function Page() {
  return <CoachingPage route={{ title: 'Coaching' }} />
}
