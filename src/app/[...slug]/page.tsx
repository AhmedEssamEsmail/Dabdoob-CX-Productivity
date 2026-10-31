import { notFound } from 'next/navigation'
import { PAGES } from '@/components/shell/registry'
import { UnbuiltPage } from '@/components/shell/StateScreen'

/**
 * Registry paths whose pages are not ported yet render the legacy hs()
 * placeholder ("Not built yet.") instead of a 404, matching the bundle.
 */
export default async function RegistryCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const route = PAGES.find((page) => page.path === slug.join('/'))
  if (!route) notFound()
  return <UnbuiltPage route={route} />
}
