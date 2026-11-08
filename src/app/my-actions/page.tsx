/* verbatim port of the legacy My actions page - thin route entry. */
import '@/app/styles/people.css'
import { MyActionsPage } from '@/features/cx-people/components/my-actions-page'

export default function Page() {
  return <MyActionsPage route={{ title: 'My actions' }} />
}
