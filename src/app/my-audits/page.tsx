/* verbatim port of the legacy Quality My audits page — thin route entry. */
import '@/app/styles/quality.css'
import MyAuditsPage from '@/features/cx-quality/components/my-audits-page'

export default function Page() {
  return <MyAuditsPage route={{ title: 'My audits' }} />
}
