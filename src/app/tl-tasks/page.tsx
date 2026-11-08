/* verbatim port of the legacy TL tasks page - thin route entry. */
import '@/app/styles/people.css'
import { TlTasksPage } from '@/features/cx-people/components/tl-tasks-page'

export default function Page() {
  return <TlTasksPage route={{ title: 'TL tasks' }} />
}
