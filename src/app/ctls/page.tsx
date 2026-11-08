/* verbatim port of the legacy Quality CTLs page — thin route entry. */
import '@/app/styles/quality.css'
import CtlsPage from '@/features/cx-quality/components/ctls-page'

export default function Page() {
  return <CtlsPage route={{ title: 'CTLs' }} />
}
