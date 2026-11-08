/* verbatim port of the legacy Notes page - thin route entry. */
import '@/app/styles/people.css'
import { NotesPage } from '@/features/cx-people/components/notes-page'

export default function Page() {
  return <NotesPage route={{ title: 'Notes' }} />
}
