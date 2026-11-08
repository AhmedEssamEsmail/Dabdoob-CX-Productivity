/* verbatim port of the legacy Agents page - thin route entry. */
import '@/app/styles/people.css'
import { AgentsPage } from '@/features/cx-people/components/agents-page'

export default function Page() {
  return <AgentsPage route={{ title: 'Agents' }} />
}
