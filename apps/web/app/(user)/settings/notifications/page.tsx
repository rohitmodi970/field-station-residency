"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Moon, 
  Clock, 
  Loader2, 
  ChevronLeft,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  TestTube,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import type { NotificationType, UserNotificationSettings } from '@/types/notifications';

// Notification type labels and descriptions
const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    type: 'reminder', 
    label: 'Reminders', 
    description: 'Journal reminders and scheduled prompts',
    icon: <Clock size={18} />
  },
  { 
    type: 'action', 
    label: 'Actions', 
    description: 'Action items and to-do reminders',
    icon: <CheckCircle2 size={18} />
  },
  { 
    type: 'journal', 
    label: 'Journal', 
    description: 'Journal analysis and insights ready',
    icon: <Bell size={18} />
  },
  { 
    type: 'achievement', 
    label: 'Achievements', 
    description: 'Milestones, streaks, and accomplishments',
    icon: <AlertCircle size={18} />
  },
  { 
    type: 'system', 
    label: 'System', 
    description: 'Security alerts and account updates',
    icon: <AlertCircle size={18} />
  },
  { 
    type: 'social', 
    label: 'Social', 
    description: 'Shares, comments, and collaboration',
    icon: <MessageSquare size={18} />
  },
];

// Available timezones (subset of common ones)
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

export default function NotificationSettingsPage() {
  const { currentTheme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [testingSending, setTestingSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch notification settings
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        throw new Error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      showToast('Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Update settings
  const updateSettings = async (updates: Partial<UserNotificationSettings>) => {
    if (!settings) return;

    // Optimistic update
    setSettings(prev => prev ? { ...prev, ...updates } : null);
    setUpdating(true);

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Error updating settings:', error);
      // Revert on error
      fetchSettings();
      showToast('Failed to update settings', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Toggle notification channel
  const toggleChannel = (channel: 'in_app_enabled' | 'email_enabled' | 'push_enabled' | 'sms_enabled') => {
    if (!settings) return;
    updateSettings({ [channel]: !settings[channel] });
  };

  // Toggle notification type mute
  const toggleMuteType = (type: NotificationType) => {
    if (!settings) return;
    const currentMuted = settings.muted_types || [];
    const newMuted = currentMuted.includes(type)
      ? currentMuted.filter(t => t !== type)
      : [...currentMuted, type];
    updateSettings({ muted_types: newMuted });
  };

  // Update quiet hours
  const updateQuietHours = (field: 'quiet_start' | 'quiet_end', value: string | null) => {
    updateSettings({ [field]: value || null });
  };

  // Update timezone
  const updateTimezone = (timezone: string) => {
    updateSettings({ time_zone: timezone || null });
  };

  // Send test notification
  const sendTestNotification = async () => {
    setTestingSending(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });

      if (response.ok) {
        showToast('Test notification sent!', 'success');
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      showToast('Failed to send test notification', 'error');
    } finally {
      setTestingSending(false);
    }
  };

  // Toggle switch component
  const ToggleSwitch = ({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-pressed={enabled}
      className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ backgroundColor: enabled ? currentTheme.primary : isDarkMode ? '#4B5563' : '#D1D5DB' }}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );

  const enabledChannels = ['in_app_enabled', 'email_enabled', 'push_enabled', 'sms_enabled'].filter(
    key => settings?.[key as keyof UserNotificationSettings] === true
  ).length;
  const mutedCount = settings?.muted_types?.length ?? 0;
  const quietHoursActive = Boolean(settings?.quiet_start || settings?.quiet_end);

  const CHANNELS: Array<{
    key: 'in_app_enabled' | 'email_enabled' | 'push_enabled' | 'sms_enabled';
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'in_app_enabled',
      label: 'In-App Notifications',
      description: 'Show notifications inside the app interface',
      icon: <Bell size={18} />,
    },
    {
      key: 'email_enabled',
      label: 'Email Notifications',
      description: 'Send important task reminders and due-date alerts to Gmail',
      icon: <Mail size={18} />,
    },
    {
      key: 'push_enabled',
      label: 'Push Notifications',
      description: 'Get device alerts in real time',
      icon: <Smartphone size={18} />,
    },
    {
      key: 'sms_enabled',
      label: 'SMS Notifications',
      description: 'Text alerts for urgent updates',
      icon: <MessageSquare size={18} />,
    },
  ];

  const reveal = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: currentTheme.primary }}></div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden pb-12 pt-28 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[rgba(173,109,90,0.1)] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-[rgba(122,143,102,0.1)] blur-3xl" />

      <div className="container relative mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border px-4 py-4 shadow-[0_10px_28px_rgba(93,70,52,0.08)] sm:px-5"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/settings"
                className="mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5"
                style={{ color: currentTheme.primary }}
              >
                <ChevronLeft size={14} />
                Back to settings
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                  <Bell size={18} />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">Notification Preferences</h1>
                  <p className="mt-1 text-sm opacity-70">Control channels, quiet hours, and what kinds of updates you receive.</p>
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium" style={{
              backgroundColor: updating ? 'rgba(245, 158, 11, 0.16)' : 'rgba(34, 197, 94, 0.16)',
              color: updating ? '#b45309' : '#15803d',
            }}>
              {updating ? 'Saving…' : 'Saved'}
            </span>
          </div>
        </div>

        {toast && (
          <div
            className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-lg"
            style={{ backgroundColor: toast.type === 'success' ? '#10B981' : '#EF4444' }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </div>
        )}

        <motion.section
          initial={reveal.initial}
          animate={reveal.animate}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="mb-6 rounded-2xl border p-4 shadow-sm sm:p-5"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB', backgroundColor: isDarkMode ? '#1F2937' : '#fffaf4', boxShadow: '0 4px 14px rgba(93,70,52,0.05)' }}>
              <p className="text-xs uppercase tracking-[0.08em] opacity-60">Enabled channels</p>
              <p className="mt-1 text-xl font-semibold">{enabledChannels}/4</p>
            </div>
            <div className="rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB', backgroundColor: isDarkMode ? '#1F2937' : '#fffaf4', boxShadow: '0 4px 14px rgba(93,70,52,0.05)' }}>
              <p className="text-xs uppercase tracking-[0.08em] opacity-60">Muted types</p>
              <p className="mt-1 text-xl font-semibold">{mutedCount}</p>
            </div>
            <div className="rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB', backgroundColor: isDarkMode ? '#1F2937' : '#fffaf4', boxShadow: '0 4px 14px rgba(93,70,52,0.05)' }}>
              <p className="text-xs uppercase tracking-[0.08em] opacity-60">Quiet hours</p>
              <p className="mt-1 text-xl font-semibold">{quietHoursActive ? 'On' : 'Off'}</p>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <motion.section
              initial={reveal.initial}
              animate={reveal.animate}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
              className="rounded-2xl border p-4 shadow-sm sm:p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Volume2 size={20} style={{ color: currentTheme.primary }} />
                Delivery Channels
              </h2>
              <p className="mb-5 text-sm opacity-70">Choose where notifications should be delivered.</p>

              <div className="space-y-3">
                {CHANNELS.map((channel) => (
                  <div
                    key={channel.key}
                    className="group flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 sm:p-4"
                    style={{ backgroundColor: isDarkMode ? '#1F2937' : '#fffaf4', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}>
                        {channel.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium">{channel.label}</h3>
                        <p className="text-sm opacity-70">{channel.description}</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={Boolean(settings?.[channel.key])}
                      onChange={() => toggleChannel(channel.key)}
                    />
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={reveal.initial}
              animate={reveal.animate}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
              className="rounded-2xl border p-4 shadow-sm sm:p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <VolumeX size={20} style={{ color: currentTheme.primary }} />
                Notification Types
              </h2>
              <p className="mb-5 text-sm opacity-70">Turn off categories you do not want to receive.</p>

              <div className="space-y-3">
                {NOTIFICATION_TYPES.map(({ type, label, description, icon }) => {
                  const isMuted = settings?.muted_types?.includes(type) ?? false;
                  return (
                    <div
                      key={type}
                      className="group flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 sm:p-4"
                      style={{ backgroundColor: isDarkMode ? '#1F2937' : '#fffaf4', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isMuted ? (isDarkMode ? '#374151' : '#E5E7EB') : currentTheme.light,
                            color: isMuted ? (isDarkMode ? '#9CA3AF' : '#6B7280') : currentTheme.primary,
                          }}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-medium ${isMuted ? 'opacity-60' : ''}`}>{label}</h3>
                          <p className="text-sm opacity-70">{description}</p>
                        </div>
                      </div>
                      <ToggleSwitch enabled={!isMuted} onChange={() => toggleMuteType(type)} />
                    </div>
                  );
                })}
              </div>
            </motion.section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <motion.section
              initial={reveal.initial}
              animate={reveal.animate}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
              className="rounded-2xl border p-4 shadow-sm sm:p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Moon size={20} style={{ color: currentTheme.primary }} />
                Quiet Hours
              </h2>
              <p className="mb-4 text-sm opacity-70">Pause non-urgent notifications during specific hours.</p>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Start Time</label>
                  <input
                    type="time"
                    value={settings?.quiet_start || ''}
                    onChange={(e) => updateQuietHours('quiet_start', e.target.value)}
                    className="w-full rounded-xl border p-3 transition-colors focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                      borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                      color: isDarkMode ? '#F9FAFB' : '#1F2937'
                    }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">End Time</label>
                  <input
                    type="time"
                    value={settings?.quiet_end || ''}
                    onChange={(e) => updateQuietHours('quiet_end', e.target.value)}
                    className="w-full rounded-xl border p-3 transition-colors focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                      borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                      color: isDarkMode ? '#F9FAFB' : '#1F2937'
                    }}
                  />
                </div>
              </div>

              {(settings?.quiet_start || settings?.quiet_end) && (
                <button
                  onClick={() => updateSettings({ quiet_start: null, quiet_end: null })}
                  className="mt-4 text-sm font-medium hover:underline"
                  style={{ color: currentTheme.primary }}
                >
                  Clear quiet hours
                </button>
              )}
            </motion.section>

            <motion.section
              initial={reveal.initial}
              animate={reveal.animate}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="rounded-2xl border p-4 shadow-sm sm:p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Globe size={20} style={{ color: currentTheme.primary }} />
                Timezone
              </h2>
              <p className="mb-4 text-sm opacity-70">Used for accurate scheduling of reminders and alerts.</p>

              <select
                value={settings?.time_zone || ''}
                onChange={(e) => updateTimezone(e.target.value)}
                className="w-full rounded-xl border p-3 transition-colors focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                  color: isDarkMode ? '#F9FAFB' : '#1F2937'
                }}
              >
                <option value="">Auto-detect timezone</option>
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </motion.section>

            <motion.section
              initial={reveal.initial}
              animate={reveal.animate}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.36 }}
              className="rounded-2xl border p-4 shadow-sm sm:p-6"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <TestTube size={20} style={{ color: currentTheme.primary }} />
                Test Notifications
              </h2>
              <p className="mb-4 text-sm opacity-70">Send a quick test to verify that your settings are active.</p>

              <button
                onClick={sendTestNotification}
                disabled={testingSending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: currentTheme.primary }}
              >
                {testingSending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell size={18} />
                    Send Test Notification
                  </>
                )}
              </button>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
