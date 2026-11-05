import { NAV_ICONS } from '@/features/shared/components/shell/registry'

/** et — nav icon: an svg whose inner markup comes from the gs map. */
export default function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{
        __html: NAV_ICONS[path] ?? '<circle cx="12" cy="12" r="3"/>',
      }}
    />
  )
}
