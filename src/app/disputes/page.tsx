/* verbatim port of the legacy Quality Disputes page — thin route entry. */
import '@/app/styles/quality.css'
import DisputesPage from '@/features/cx-quality/components/disputes-page'

export default function Page() {
  return <DisputesPage route={{ title: 'Disputes' }} />
}
