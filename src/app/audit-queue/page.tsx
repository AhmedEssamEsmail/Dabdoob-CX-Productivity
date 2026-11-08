/* verbatim port of the legacy Quality Audit Desk page — thin route entry. */
import '@/app/styles/quality.css'
import AuditQueuePage from '@/features/cx-quality/components/audit-queue-page'

export default function Page() {
  return <AuditQueuePage route={{ title: 'Audit Desk' }} />
}
