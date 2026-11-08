/* verbatim port of the legacy Quality Calibration page — thin route entry. */
import '@/app/styles/quality.css'
import { CalibrationPage } from '@/features/cx-quality/components/calibration-page'

export default function Page() {
  return <CalibrationPage route={{ title: 'Calibration' }} />
}
