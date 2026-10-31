'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * sa() + the hash router, adapted: legacy deep links arrive either as
 * `#/<path>[?query]` or `?page=<path>&…`. Both rewrite to `/<path>?query`
 * (other params — e.g. ?tab= — are preserved; mock/role are dropped).
 */
export default function HashShim() {
  const router = useRouter()

  useEffect(() => {
    const apply = () => {
      const { hash, search } = window.location

      const params = new URLSearchParams(search)
      const page = params.get('page')
      if (page && /^[a-z0-9-]+$/.test(page) && !hash.replace(/^#\/?/, '')) {
        const rest = new URLSearchParams()
        params.forEach((value, key) => {
          if (key !== 'page' && key !== 'mock' && key !== 'role') rest.set(key, value)
        })
        const query = rest.toString()
        router.replace(`/${page}${query ? `?${query}` : ''}`)
        return
      }

      const match = /^#\/?([^?]+)(?:\?(.*))?$/.exec(hash)
      if (match) {
        const path = match[1]
        if (/^[a-z0-9-]+$/.test(path))
          router.replace(`/${path}${match[2] ? `?${match[2]}` : ''}`)
      }
    }

    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [router])

  return null
}
