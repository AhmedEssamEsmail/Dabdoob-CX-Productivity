'use client'

/* Legacy root behaviour: an empty hash/path renders the app's fallback page in
   place — the first visible page, preferring My day then Hub home — instead of
   a landing screen, exactly like the legacy shell's n1 root branch. The shell
   computes the same fallback for the rail's aria-current, so this mirrors it. */
import { PAGES } from '@/features/shared/components/shell/registry'
import {
  appForGroup,
  inApp,
  pageAllowed,
} from '@/features/shared/shell/gates'
import { useBoot } from '@/features/shared/shell/context'
import { MyDayPage } from '@/features/cx-hub/components/my-day-page'
import { OverviewPage } from '@/features/cx-hub/components/overview-page'
import { PeopleHolidaysPage } from '@/features/cx-hub/components/people-holidays-page'
import { AdminPage } from '@/features/cx-hub/components/admin-page'

export default function Home() {
  const boot = useBoot()
  if (!boot) return null
  /* The shell resolves '/' to PAGES[0] (my-day) for the app context — hub. */
  const ctxApp = appForGroup(PAGES[0].group)
  const visible = PAGES.filter((page) => pageAllowed(page, boot)).filter(
    (page) => inApp(page, ctxApp)
  )
  const fallback =
    visible.find((page) => page.path === 'my-day') ??
    visible.find((page) => page.path === 'overview') ??
    visible[0]
  if (!fallback) return null
  if (fallback.path === 'my-day') return <MyDayPage route={{ title: fallback.title }} />
  if (fallback.path === 'people-holidays')
    return <PeopleHolidaysPage route={{ title: fallback.title }} />
  if (fallback.path === 'admin') return <AdminPage route={{ title: fallback.title }} />
  return <OverviewPage route={{ title: fallback.title }} />
}
