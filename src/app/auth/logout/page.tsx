'use client'

import { useEffect } from 'react'
import BootSplash from '@/features/shared/components/shell/BootSplash'

export default function LogoutPage() {
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- API route: needs full navigation to clear session cookies
    window.location.assign('/api/auth/logout')
  }, [])

  return <BootSplash />
}
