import { config } from 'dotenv'
config({ path: '.env.local' })
import { buildJobEnv } from '@/lib/jobs/env'
import { prodFlagsStep_ } from '@/lib/jobs/productivity'

async function main() {
  const t0 = Date.now()
  const env = await buildJobEnv({ intervalSince: '2026-09-01' })
  console.log('env ms', Date.now() - t0)
  env.activityRows = async () => []
  const t = Date.now()
  const r = await prodFlagsStep_(env, ['2026-09-07'])
  console.log('flags ms', Date.now() - t, JSON.stringify(r).slice(0, 400))
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e); process.exit(1) })
