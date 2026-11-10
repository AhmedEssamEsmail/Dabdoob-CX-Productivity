/**
 * The registry path for the TPH grid is `tph`; /tph-grid redirects here.
 * Thin route entry rendering the cx-productivity TPH grid page.
 */
import { TphGridPage } from '@/features/cx-productivity/components/tph-grid-page'
import '@/app/styles/productivity.css'

export default function Page() {
  return <TphGridPage />
}
