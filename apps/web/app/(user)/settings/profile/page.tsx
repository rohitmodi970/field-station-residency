"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { Button } from '@/components/ui/button2';
import { User, Calendar, Heart, Globe, Camera, Save, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { createClient } from '@/utils/supabase/client';
import Toast from '@/components/ui/toast';

interface UserProfile {
  bio?: string;
  personality_type?: string;
  dob?: string;
  languages?: string[];
  interests?: string[];
  social_media?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  sleeping_habits?: {
    average_hours?: number;
    preferred_sleep_time?: string;
    preferred_wake_time?: string;
  };
  photo_url?: string;
  profile_visibility?: 'private' | 'public' | 'friends';
}

const personalityTypes = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  'Other'
];

const commonLanguages = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi'
];

const commonInterests = [
  'Reading', 'Writing', 'Music', 'Art', 'Sports', 'Cooking', 'Travel',
  'Photography', 'Gaming', 'Fitness', 'Technology', 'Nature', 'Movies',
  'Fashion', 'Meditation', 'Yoga', 'Dancing', 'Hiking', 'Volunteering'
];

export default function ProfileEditPage() {
  const { currentTheme, isDarkMode, elementColors, pageBackground, currentFont } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    bio: '',
    personality_type: '',
    dob: '',
    languages: [],
    interests: [],
    social_media: {},
    sleeping_habits: {},
    photo_url: '',
    profile_visibility: 'private'
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/user/profile'); // API route remains unchanged
        if (response.ok) {
          const { profile: data } = await response.json();
          if (data) {
            setProfile({
              bio: data.bio || '',
              personality_type: data.personality_type || '',
              dob: data.dob || '',
              languages: data.languages || [],
              interests: data.interests || [],
              social_media: data.social_media || {},
              sleeping_habits: data.sleeping_habits || {},
              photo_url: data.photo_url || '',
              profile_visibility: data.profile_visibility || 'private'
            });
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        setToastMessage('Profile updated successfully!');
        setToastType('success');
      } else {
        setToastMessage('Failed to update profile');
        setToastType('error');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setToastMessage('An error occurred while saving');
      setToastType('error');
    } finally {
      setSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const toggleLanguage = (lang: string) => {
    setProfile(prev => ({
      ...prev,
      languages: prev.languages?.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...(prev.languages || []), lang]
    }));
  };

  const toggleInterest = (interest: string) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests?.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...(prev.interests || []), interest]
    }));
  };

  const containerStyle = {
    backgroundColor: elementColors.background,
    color: elementColors.text
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: currentTheme.primary }} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {showToast && <Toast message={toastMessage} type={toastType} visible={showToast} />}
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${currentTheme.primary}20` }}>
              <User size={28} style={{ color: currentTheme.primary }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Edit Profile</h1>
              <p className="text-sm opacity-70">Personalize your journaling experience</p>
            </div>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
            style={{
              backgroundColor: currentTheme.primary,
              color: '#FFFFFF'
            }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Profile
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User size={20} style={{ color: currentTheme.primary }} />
              Basic Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={profile.dob}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Profile Visibility</label>
                <select
                  value={profile.profile_visibility}
                  onChange={(e) => setProfile({ ...profile, profile_visibility: e.target.value as any })}
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                  <option value="friends">Friends Only</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Personality */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart size={20} style={{ color: currentTheme.primary }} />
              Personality
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-3">Personality Type (MBTI)</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {personalityTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setProfile({ ...profile, personality_type: type })}
                    className="p-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: profile.personality_type === type
                        ? currentTheme.primary
                        : isDarkMode ? '#374151' : '#F3F4F6',
                      color: profile.personality_type === type
                        ? '#FFFFFF'
                        : elementColors.text
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe size={20} style={{ color: currentTheme.primary }} />
              Languages
            </h2>
            
            <div className="flex flex-wrap gap-2">
              {commonLanguages.map(lang => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    backgroundColor: profile.languages?.includes(lang)
                      ? currentTheme.primary
                      : isDarkMode ? '#374151' : '#F3F4F6',
                    color: profile.languages?.includes(lang)
                      ? '#FFFFFF'
                      : elementColors.text
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </Card>

          {/* Interests */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart size={20} style={{ color: currentTheme.primary }} />
              Interests & Hobbies
            </h2>
            
            <div className="flex flex-wrap gap-2">
              {commonInterests.map(interest => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    backgroundColor: profile.interests?.includes(interest)
                      ? currentTheme.primary
                      : isDarkMode ? '#374151' : '#F3F4F6',
                    color: profile.interests?.includes(interest)
                      ? '#FFFFFF'
                      : elementColors.text
                  }}
                >
                  {interest}
                </button>
              ))}
            </div>
          </Card>

          {/* Sleep Habits */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4">Sleep Habits</h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Average Hours</label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={profile.sleeping_habits?.average_hours || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    sleeping_habits: {
                      ...profile.sleeping_habits,
                      average_hours: parseFloat(e.target.value)
                    }
                  })}
                  placeholder="7.5"
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Preferred Sleep Time</label>
                <input
                  type="time"
                  value={profile.sleeping_habits?.preferred_sleep_time || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    sleeping_habits: {
                      ...profile.sleeping_habits,
                      preferred_sleep_time: e.target.value
                    }
                  })}
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Preferred Wake Time</label>
                <input
                  type="time"
                  value={profile.sleeping_habits?.preferred_wake_time || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    sleeping_habits: {
                      ...profile.sleeping_habits,
                      preferred_wake_time: e.target.value
                    }
                  })}
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Social Media */}
          <Card className="p-6" style={containerStyle}>
            <h2 className="text-xl font-semibold mb-4">Social Media (Optional)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Twitter/X</label>
                <input
                  type="text"
                  value={profile.social_media?.twitter || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    social_media: {
                      ...profile.social_media,
                      twitter: e.target.value
                    }
                  })}
                  placeholder="@username"
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Instagram</label>
                <input
                  type="text"
                  value={profile.social_media?.instagram || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    social_media: {
                      ...profile.social_media,
                      instagram: e.target.value
                    }
                  })}
                  placeholder="@username"
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">LinkedIn</label>
                <input
                  type="text"
                  value={profile.social_media?.linkedin || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    social_media: {
                      ...profile.social_media,
                      linkedin: e.target.value
                    }
                  })}
                  placeholder="linkedin.com/in/username"
                  className="w-full p-3 rounded-lg border"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: elementColors.text
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
