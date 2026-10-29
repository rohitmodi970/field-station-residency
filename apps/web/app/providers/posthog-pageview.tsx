'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import posthog from 'posthog-js'

export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog.__loaded) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      
      posthog.capture('$pageview', {
        $current_url: url,
        page_type: getPageType(pathname),
      })
    }
  }, [pathname, searchParams])

  return null
}

// Helper to categorize pages
function getPageType(pathname: string) {
  if (pathname === '/') return 'landing'
  if (pathname === '/waitlist') return 'waitlist'
  if (pathname.startsWith('/auth')) return 'authentication'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/journal')) return 'journal'
  if (pathname.startsWith('/mindmap')) return 'mindmap'
  if (pathname === '/settings') return 'settings'
  if (pathname === '/about') return 'about'
  if (pathname === '/contact') return 'contact'
  return 'other'
}
