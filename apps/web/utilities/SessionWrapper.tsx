"use client"

import { ReactNode, useEffect, useState } from "react"

interface SessionWrapperProps {
  children: ReactNode
}

export default function SessionWrapper({ children }: SessionWrapperProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // No longer need SessionProvider - Supabase auth is handled differently
  return <>{children}</>
}