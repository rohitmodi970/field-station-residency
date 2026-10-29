/**
 * Type-safe PostHog event tracking for FORCE
 * 
 * This file provides a centralized, type-safe interface for tracking analytics events
 * across the FORCE application. It ensures consistent event naming and properties.
 */

import posthog from 'posthog-js'

// ========== USER IDENTIFICATION ==========

export interface UserProperties {
  email?: string
  name?: string
  created_at?: string
  subscription_tier?: 'free' | 'pro' | 'enterprise'
  journal_count?: number
  last_journal_date?: string
  most_common_emotion?: string
  has_audio_analysis?: boolean
  has_mindmap?: boolean
  has_shared_journal?: boolean
  total_audio_minutes?: number
  onboarding_completed?: boolean
}

export function identifyUser(userId: string, properties?: UserProperties) {
  if (!posthog.__loaded) return
  
  posthog.identify(userId, properties)
}

export function updateUserProperties(properties: Partial<UserProperties>) {
  if (!posthog.__loaded) return
  
  posthog.people.set(properties)
}

export function resetUser() {
  if (!posthog.__loaded) return
  
  posthog.reset()
}

// ========== EVENT TRACKING ==========

export const trackEvent = {
  // ========== AUTHENTICATION ==========
  
  userSignedUp: (properties: {
    method: 'email' | 'google' | 'facebook' | 'apple'
    referrer?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('user_signed_up', properties)
  },

  userLoggedIn: (properties: {
    method: 'email' | 'google' | 'facebook' | 'apple'
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('user_logged_in', properties)
  },

  userLoggedOut: () => {
    if (!posthog.__loaded) return
    posthog.capture('user_logged_out', {
      timestamp: new Date().toISOString(),
    })
  },

  // ========== WAITLIST ==========
  
  waitlistJoined: (properties: {
    energy_level?: 'low' | 'medium' | 'high'
    commitment?: boolean
    time_spent_seconds?: number
    utm_source?: string
    referrer?: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('waitlist_joined', properties)
  },

  // ========== JOURNAL ENTRY ==========
  
  journalEntryCreated: (properties: {
    entry_type: 'text' | 'audio' | 'video' | 'mixed'
    has_audio: boolean
    has_video: boolean
    has_images: boolean
    word_count?: number
    audio_duration_seconds?: number
    media_count?: number
    tags_count?: number
    is_first_entry?: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('journal_entry_created', properties)
  },

  journalEntryUpdated: (properties: {
    entry_id: string
    changes_made: string[] // e.g., ['content', 'tags', 'privacy']
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('journal_entry_updated', properties)
  },

  journalEntryDeleted: (properties: {
    entry_id: string
    had_media: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('journal_entry_deleted', properties)
  },

  journalEntryViewed: (properties: {
    entry_id: string
    view_duration_seconds?: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('journal_entry_viewed', properties)
  },

  // ========== AUDIO ANALYSIS ==========
  
  audioAnalysisStarted: (properties: {
    file_size_mb: number
    duration_seconds: number
    file_format: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('audio_analysis_started', properties)
  },

  audioAnalysisCompleted: (properties: {
    duration_seconds: number
    processing_time_seconds: number
    emotions_detected: number
    dominant_emotion?: string
    confidence_score?: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('audio_analysis_completed', properties)
  },

  audioAnalysisFailed: (properties: {
    error_type: string
    file_size_mb: number
    duration_seconds?: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('audio_analysis_failed', properties)
  },

  // ========== MINDMAP ==========
  
  mindmapCreated: (properties: {
    node_count: number
    entry_count: number
    time_range_days: number
    layout_type?: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('mindmap_created', properties)
  },

  mindmapInteraction: (properties: {
    interaction_type: 'zoom' | 'pan' | 'node_click' | 'node_drag' | 'export'
    node_count: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('mindmap_interaction', properties)
  },

  mindmapExported: (properties: {
    export_format: 'png' | 'jpg' | 'svg' | 'pdf'
    node_count: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('mindmap_exported', properties)
  },

  // ========== SHARING ==========
  
  journalShared: (properties: {
    share_method: 'link' | 'email' | 'social'
    privacy_level: 'public' | 'unlisted' | 'password'
    has_expiry: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('journal_shared', properties)
  },

  sharedJournalViewed: (properties: {
    is_owner: boolean
    view_duration_seconds?: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('shared_journal_viewed', properties)
  },

  // ========== SPIRITUAL ANALYSIS ==========
  
  spiritualAnalysisRequested: (properties: {
    entry_word_count: number
    has_emotions: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('spiritual_analysis_requested', properties)
  },

  spiritualAnalysisCompleted: (properties: {
    processing_time_seconds: number
    insights_generated: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('spiritual_analysis_completed', properties)
  },

  // ========== MEDIA UPLOAD ==========
  
  mediaUploadStarted: (properties: {
    media_type: 'image' | 'audio' | 'video'
    file_size_mb: number
    source: 'drag_drop' | 'file_picker' | 'paste'
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('media_upload_started', properties)
  },

  mediaUploadCompleted: (properties: {
    media_type: 'image' | 'audio' | 'video'
    file_size_mb: number
    upload_time_seconds: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('media_upload_completed', properties)
  },

  mediaUploadFailed: (properties: {
    media_type: 'image' | 'audio' | 'video'
    file_size_mb: number
    error_reason: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('media_upload_failed', properties)
  },

  // ========== THEME & CUSTOMIZATION ==========
  
  themeChanged: (properties: {
    theme: 'light' | 'dark' | 'auto'
    custom_background?: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('theme_changed', properties)
  },

  backgroundCustomized: (properties: {
    customization_type: 'color' | 'gradient' | 'image'
    preset_used?: boolean
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('background_customized', properties)
  },

  // ========== ERRORS ==========
  
  errorOccurred: (properties: {
    error_type: string
    error_message?: string
    page?: string
    endpoint?: string
    status_code?: number
    component?: string
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('error_occurred', {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  },

  // ========== ENGAGEMENT ==========
  
  searchPerformed: (properties: {
    results_count: number
    context: 'journals' | 'mindmap' | 'global'
    query_length: number
  }) => {
    if (!posthog.__loaded) return
    // Don't send actual query to PostHog for privacy
    posthog.capture('search_performed', properties)
  },

  settingsChanged: (properties: {
    settings_changed: string[] // e.g., ['theme', 'notifications', 'privacy']
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('settings_changed', properties)
  },

  // ========== SUBSCRIPTIONS (Future) ==========
  
  subscriptionStarted: (properties: {
    plan: 'pro' | 'enterprise'
    billing_cycle: 'monthly' | 'yearly'
    price: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('subscription_started', properties)
  },

  subscriptionCancelled: (properties: {
    plan: 'pro' | 'enterprise'
    reason?: string
    had_subscription_days: number
  }) => {
    if (!posthog.__loaded) return
    posthog.capture('subscription_cancelled', properties)
  },
}

// ========== FEATURE FLAGS ==========

export function isFeatureEnabled(flagKey: string): boolean {
  if (!posthog.__loaded) return false
  return posthog.isFeatureEnabled(flagKey) || false
}

export function getFeatureFlagVariant(flagKey: string): string | boolean | undefined {
  if (!posthog.__loaded) return undefined
  return posthog.getFeatureFlag(flagKey)
}

export async function reloadFeatureFlags(): Promise<void> {
  if (!posthog.__loaded) return
  await posthog.reloadFeatureFlags()
}

// ========== DEBUGGING ==========

export function enableDebugMode() {
  if (!posthog.__loaded) return
  posthog.debug()
}

export function getAllFlags() {
  if (!posthog.__loaded) return {}
  // Feature flags are stored internally, we can check specific flags
  // This returns an empty object as a placeholder
  return {}
}
