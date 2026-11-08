/* verbatim port of the legacy One-on-ones page - thin route entry. */
import '@/app/styles/people.css'
import { OneOnOnesPage } from '@/features/cx-people/components/one-on-ones-page'

export default function Page() {
  return <OneOnOnesPage route={{ title: 'One-to-ones' }} />
}
