'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (process.env.NODE_ENV !== 'production') {
        return
      }

      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
      const enableSessionRecording = process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING === 'true'

      // Only initialize if API key is provided
      if (!posthogKey) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('PostHog API key not configured')
        }
        return
      }

      posthog.init(posthogKey, {
        api_host: posthogHost || 'https://app.posthog.com',
        capture_pageview: true, // We'll handle this manually
        capture_pageleave: true,
        autocapture: {
          dom_event_allowlist: ['click', 'submit'], // Only capture clicks and form submissions
          element_allowlist: ['button', 'a'], // Only track buttons and links
        },
        disable_session_recording: !enableSessionRecording,
        session_recording: enableSessionRecording
          ? {
              maskAllInputs: true, // Mask all input fields (CRITICAL for journaling app)
              maskTextSelector: '.journal-content, .sensitive-data, .user-reflection', // Mask journal content
              blockSelector: '.no-record, .private-journal', // Don't record journal entries
              recordCrossOriginIframes: false,
              // Additional text masking for sensitive content.
              maskTextFn: (text) => {
                return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***')
              },
              recordHeaders: false, // Don't record request headers
              collectFonts: true, // Collect fonts for better replay
            }
          : undefined,
        persistence: 'localStorage', // Use localStorage for persistence
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            posthog.debug() // Enable debug mode in development
          }

          // Enforce replay off by default to avoid visual data capture in journal/share flows.
          if (!enableSessionRecording && posthog.sessionRecording) {
            const sr = posthog.sessionRecording as { stopRecording?: () => void }
            if (typeof sr.stopRecording === 'function') {
              sr.stopRecording()
            }

            if (process.env.NODE_ENV !== 'production') {
              console.info('[PostHog] Session recording disabled by NEXT_PUBLIC_POSTHOG_SESSION_RECORDING')
            }
          }
        },
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
