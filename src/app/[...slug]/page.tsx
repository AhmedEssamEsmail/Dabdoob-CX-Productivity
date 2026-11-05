import { redirect } from 'next/navigation'
import { PAGES } from '@/features/shared/components/shell/registry'
import { UnbuiltPage } from '@/features/shared/components/shell/StateScreen'

/**
 * Registry paths whose pages are not ported yet render the legacy hs()
 * placeholder ("Not built yet.") instead of a 404, matching the bundle.
 * Unknown paths fall back to / like the legacy hash router's default page.
 */
export default async function RegistryCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const route = PAGES.find((page) => page.path === slug.join('/'))
  if (!route) redirect('/')
  return <UnbuiltPage route={route} />
}
