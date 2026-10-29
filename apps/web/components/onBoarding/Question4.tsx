// apps/web/components/onBoarding/Question4.tsx
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bell, Mail, Smartphone, MessageSquare } from 'lucide-react';

interface Question4Props {
  formData: {
    preferred_writing_time?: 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime';
    reminder_enabled?: boolean;
    reminder_time?: string;
    notification_preferences?: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  onUpdate: (field: string, value: any) => void;
  currentTheme: { primary: string; medium: string; light: string };
  isDarkMode: boolean;
}

const Question4: React.FC<Question4Props> = ({
  formData,
  onUpdate,
  currentTheme,
  isDarkMode,
}) => {
  const writingTimes = [
    { value: 'morning', label: 'Morning (6AM - 12PM)', icon: '🌅' },
    { value: 'afternoon', label: 'Afternoon (12PM - 6PM)', icon: '☀️' },
    { value: 'evening', label: 'Evening (6PM - 10PM)', icon: '🌆' },
    { value: 'night', label: 'Night (10PM - 6AM)', icon: '🌙' },
    { value: 'anytime', label: 'Anytime', icon: '⏰' },
  ];

  const handleWritingTimeSelect = (time: string) => {
    onUpdate('preferred_writing_time', time);
  };

  const handleReminderToggle = () => {
    onUpdate('reminder_enabled', !formData.reminder_enabled);
  };

  const handleReminderTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    // Convert HH:MM to HH:MM:SS
    onUpdate('reminder_time', `${time}:00`);
  };

  const handleNotificationToggle = (type: 'email' | 'push' | 'sms') => {
    const currentPrefs = formData.notification_preferences || { email: false, push: false, sms: false };
    onUpdate('notification_preferences', {
      ...currentPrefs,
      [type]: !currentPrefs[type]
    });
  };

  return (
    <div className="space-y-8">
      {/* Writing Time Preference */}
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
          <Clock size={24} />
          When do you prefer to write?
        </h3>
        <p className="text-sm mb-4" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          Choose your ideal journaling time
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {writingTimes.map((time) => (
            <motion.button
              key={time.value}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleWritingTimeSelect(time.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.preferred_writing_time === time.value
                  ? 'border-opacity-100 shadow-lg'
                  : 'border-opacity-20 hover:border-opacity-40'
              }`}
              style={{
                borderColor: formData.preferred_writing_time === time.value ? currentTheme.primary : isDarkMode ? '#374151' : '#D1D5DB',
                backgroundColor: formData.preferred_writing_time === time.value 
                  ? `${currentTheme.primary}15` 
                  : isDarkMode ? '#1F2937' : '#FFFFFF'
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{time.icon}</span>
                <div>
                  <div className="font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
                    {time.label.split(' (')[0]}
                  </div>
                  <div className="text-xs" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    {time.label.includes('(') ? (time.label.split('(')[1]?.replace(')', '') || '') : ''}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Daily Reminders */}
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
          <Bell size={24} />
          Daily Reminders
        </h3>
        <p className="text-sm mb-4" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          Get reminded to write in your journal
        </p>

        <div className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }}>
            <span className="font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
              Enable daily reminders
            </span>
            <button
              type="button"
              onClick={handleReminderToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.reminder_enabled ? 'bg-opacity-100' : 'bg-opacity-30'
              }`}
              style={{ backgroundColor: formData.reminder_enabled ? currentTheme.primary : '#9CA3AF' }}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.reminder_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Time Picker */}
          {formData.reminder_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 rounded-lg" 
              style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }}
            >
              <label className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
                Reminder time
              </label>
              <input
                type="time"
                value={formData.reminder_time?.slice(0, 5) || '09:00'}
                onChange={handleReminderTimeChange}
                className="w-full px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  color: isDarkMode ? '#FFFFFF' : '#111827'
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      <div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
          Notification Channels
        </h3>
        <p className="text-sm mb-4" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
          Choose how you'd like to receive notifications
        </p>

        <div className="space-y-3">
          {/* Email */}
          <div 
            className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }}
            onClick={() => handleNotificationToggle('email')}
          >
            <div className="flex items-center gap-3">
              <Mail size={20} style={{ color: currentTheme.primary }} />
              <span className="font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>Email</span>
            </div>
            <input
              type="checkbox"
              checked={formData.notification_preferences?.email || false}
              onChange={() => {}}
              className="h-5 w-5 rounded"
              style={{ accentColor: currentTheme.primary }}
            />
          </div>

          {/* Push Notifications */}
          <div 
            className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }}
            onClick={() => handleNotificationToggle('push')}
          >
            <div className="flex items-center gap-3">
              <Smartphone size={20} style={{ color: currentTheme.primary }} />
              <span className="font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>Push Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={formData.notification_preferences?.push || false}
              onChange={() => {}}
              className="h-5 w-5 rounded"
              style={{ accentColor: currentTheme.primary }}
            />
          </div>

          {/* SMS */}
          <div 
            className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            style={{ backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }}
            onClick={() => handleNotificationToggle('sms')}
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} style={{ color: currentTheme.primary }} />
              <span className="font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>SMS</span>
            </div>
            <input
              type="checkbox"
              checked={formData.notification_preferences?.sms || false}
              onChange={() => {}}
              className="h-5 w-5 rounded"
              style={{ accentColor: currentTheme.primary }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Question4;
