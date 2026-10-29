"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { createClient } from '@/utils/supabase/client';
import Question1 from '@/components/onBoarding/Question1';
import Question2 from '@/components/onBoarding/Question2';
import Question3 from '@/components/onBoarding/Question3';
import Question4 from '@/components/onBoarding/Question4';
import Question5 from '@/components/onBoarding/Question5';

export interface FormData {
  // Step 1: Goal Setting
  goal: string;
  preferred_journal_types?: string[]; // daily, gratitude, dream, travel, fitness, work, personal
  
  // Step 2: Audio
  feelingAudio?: File;
  feeling_audio_transcription?: string;
  feeling_audio_sentiment?: number; // -1.00 to 1.00
  
  // Step 3: Photo
  prettyPhoto?: File;
  
  // Step 4: Preferences
  preferred_writing_time?: 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime';
  reminder_enabled?: boolean;
  reminder_time?: string; // HH:MM:SS format
  notification_preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  
  // Step 5: AI Features
  ai_features_accepted?: boolean;
  ai_sentiment_analysis?: boolean;
  ai_topic_detection?: boolean;
  ai_writing_suggestions?: boolean;
  
  // Additional Profile Info
  interests?: string[];
  personality_traits?: string[];
  mood_tracking_enabled?: boolean;
  
  // Tracking
  step_completed?: number;
  time_spent_seconds?: number;
  skipped_steps?: string[];
  device_type?: 'desktop' | 'mobile' | 'tablet';
  platform?: 'web' | 'ios' | 'android';
  referral_source?: string;
}

interface Theme {
  primary: string;
  medium: string;
  light: string;
}

const OnboardingForm: React.FC = () => {
  const router = useRouter();
  const { currentTheme, isDarkMode, elementColors } = useTheme() as {
    currentTheme: Theme;
    isDarkMode: boolean;
    elementColors: any;
  };

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState<number>(Date.now());

  const [formData, setFormData] = useState<FormData>({
    goal: '',
    preferred_journal_types: [],
    notification_preferences: {
      email: false,
      push: false,
      sms: false
    },
    ai_sentiment_analysis: true,
    ai_topic_detection: true,
    ai_writing_suggestions: false,
    mood_tracking_enabled: true,
    reminder_enabled: false,
    interests: [],
    personality_traits: [],
    skipped_steps: [],
    platform: 'web',
    device_type: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 
                 typeof window !== 'undefined' && window.innerWidth < 1024 ? 'tablet' : 'desktop'
  });

  const [currentSection, setCurrentSection] = useState<number>(1);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionInProgress, setSubmissionInProgress] = useState<boolean>(false);

  // File size limits
  const MAX_AUDIO_SIZE: number = 10 * 1024 * 1024; // 10MB
  const MAX_PHOTO_SIZE: number = 10 * 1024 * 1024; // 10MB

  // Check if user is authenticated
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
      setLoading(false);
    }
    getUser();
  }, [router]);

  // Image compression function
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target && event.target.result) {
          const img = new Image();
          img.src = event.target.result as string;
          img.onload = () => {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;

            // Calculate new dimensions
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to Blob with reduced quality
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob from canvas'));
                return;
              }
              // Create a new File from the compressed blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }, 'image/jpeg', 0.3); // Adjust quality (0.3 = 30%)
          };
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
    });
  };

  // Handle text input changes
  const handleInputChange = (field: keyof FormData, value: any): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle audio recording
  const handleAudioRecording = (file: File, url: string): void => {
    // Validate audio file size
    if (file.size > MAX_AUDIO_SIZE) {
      setError(`Audio file is too large. Maximum size is ${MAX_AUDIO_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    setAudioURL(url);
    setFormData(prev => ({ ...prev, feelingAudio: file }));
  };

  // Handle photo upload with compression
  const handlePhotoUpload = async (file: File, url: string): Promise<void> => {
    try {
      // Validate original file size first
      if (file.size > MAX_PHOTO_SIZE * 2) { // Allow for files up to 2x the limit before compression
        setError(`Photo file is too large. Maximum size is ${MAX_PHOTO_SIZE / (1024 * 1024) * 2}MB before compression.`);
        return;
      }

      // Compress the image
      const compressedFile = await compressImage(file);

      // Check if compression was effective enough
      if (compressedFile.size > MAX_PHOTO_SIZE) {
        setError(`Photo is still too large after compression. Please choose a smaller image.`);
        return;
      }

      // Use the compressed file
      const compressedURL = URL.createObjectURL(compressedFile);
      setPhotoURL(compressedURL);
      setFormData(prev => ({ ...prev, prettyPhoto: compressedFile }));
    } catch (error) {
      console.error('Error compressing image:', error);
      // Show error to user
      setError('Failed to process the image. Please try again with a different photo.');
    }
  };

  const goToNextSection = (): void => {
    // Clear any previous errors
    setError(null);

    if (currentSection < 5) {
      setCurrentSection(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const goToPrevSection = (): void => {
    setError(null);
    if (currentSection > 1) {
      setCurrentSection(prev => prev - 1);
    }
  };

  const skipCurrentSection = (): void => {
    const skippedStepNames: { [key: number]: string } = {
      2: 'audio',
      3: 'photo',
      4: 'preferences',
    };

    const stepName = skippedStepNames[currentSection];
    if (stepName) {
      setFormData(prev => ({
        ...prev,
        skipped_steps: [...(prev.skipped_steps || []), stepName]
      }));
    }

    goToNextSection();
  };

  // Function to handle navigation after onboarding complete
  const handleOnboardingComplete = async (): Promise<void> => {
    try {
      console.log('Onboarding complete, redirecting to dashboard...');

      const supabase = createClient();
      
      // Update user's onboarding status
      const { error } = await supabase
        .from('users')
        .update({ onboarding_complete: true })
        .eq('id', user?.id);

      if (error) {
        console.error('Error updating onboarding status:', error);
      }

      // Wait briefly then redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use window.location for a hard redirect
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError('Failed to complete onboarding. Please try refreshing the page.');
      setSubmissionInProgress(false);
      setIsSubmitting(false);
    }
  };

  // Form submission with debounce protection
  const handleSubmit = useCallback(async (): Promise<void> => {
    // Prevent multiple submissions
    if (submissionInProgress) {
      console.log('Submission already in progress, ignoring additional submit attempt');
      return;
    }

    // Validate form data before submission
    if (!formData.goal || formData.goal.trim() === '') {
      setError('Please enter your goal before continuing.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSubmissionInProgress(true);

    try {
      // Make sure user is authenticated
      if (!user) {
        throw new Error('You must be signed in to complete onboarding');
      }

      const formDataToSubmit = new FormData();
      
      // Calculate time spent
      const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      // Step 1: Goal Setting
      formDataToSubmit.append('goal', formData.goal);
      if (formData.preferred_journal_types && formData.preferred_journal_types.length > 0) {
        formDataToSubmit.append('preferred_journal_types', JSON.stringify(formData.preferred_journal_types));
      }

      // Step 2: Audio
      if (formData.feelingAudio) {
        formDataToSubmit.append('feelingAudio', formData.feelingAudio);
      }
      if (formData.feeling_audio_transcription) {
        formDataToSubmit.append('feeling_audio_transcription', formData.feeling_audio_transcription);
      }
      if (formData.feeling_audio_sentiment !== undefined) {
        formDataToSubmit.append('feeling_audio_sentiment', formData.feeling_audio_sentiment.toString());
      }

      // Step 3: Photo
      if (formData.prettyPhoto) {
        formDataToSubmit.append('prettyPhoto', formData.prettyPhoto);
      }

      // Step 4: Preferences
      if (formData.preferred_writing_time) {
        formDataToSubmit.append('preferred_writing_time', formData.preferred_writing_time);
      }
      if (formData.reminder_enabled !== undefined) {
        formDataToSubmit.append('reminder_enabled', formData.reminder_enabled.toString());
      }
      if (formData.reminder_time) {
        formDataToSubmit.append('reminder_time', formData.reminder_time);
      }
      if (formData.notification_preferences) {
        formDataToSubmit.append('notification_preferences', JSON.stringify(formData.notification_preferences));
      }

      // Step 5: AI Features
      if (formData.ai_features_accepted !== undefined) {
        formDataToSubmit.append('ai_features_accepted', formData.ai_features_accepted.toString());
      }
      if (formData.ai_sentiment_analysis !== undefined) {
        formDataToSubmit.append('ai_sentiment_analysis', formData.ai_sentiment_analysis.toString());
      }
      if (formData.ai_topic_detection !== undefined) {
        formDataToSubmit.append('ai_topic_detection', formData.ai_topic_detection.toString());
      }
      if (formData.ai_writing_suggestions !== undefined) {
        formDataToSubmit.append('ai_writing_suggestions', formData.ai_writing_suggestions.toString());
      }

      // Additional Profile Info
      if (formData.interests && formData.interests.length > 0) {
        formDataToSubmit.append('interests', JSON.stringify(formData.interests));
      }
      if (formData.personality_traits && formData.personality_traits.length > 0) {
        formDataToSubmit.append('personality_traits', JSON.stringify(formData.personality_traits));
      }
      if (formData.mood_tracking_enabled !== undefined) {
        formDataToSubmit.append('mood_tracking_enabled', formData.mood_tracking_enabled.toString());
      }

      // Tracking Fields
      formDataToSubmit.append('step_completed', '5');
      formDataToSubmit.append('time_spent_seconds', timeSpentSeconds.toString());
      if (formData.skipped_steps && formData.skipped_steps.length > 0) {
        formDataToSubmit.append('skipped_steps', JSON.stringify(formData.skipped_steps));
      }
      if (formData.device_type) {
        formDataToSubmit.append('device_type', formData.device_type);
      }
      if (formData.platform) {
        formDataToSubmit.append('platform', formData.platform);
      }
      if (formData.referral_source) {
        formDataToSubmit.append('referral_source', formData.referral_source);
      }

      console.log('Submitting form data...');

      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        body: formDataToSubmit,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
          const errorMessage = data.error || data.message || 'Failed to submit onboarding data';
          throw new Error(errorMessage);
        }

        // Complete onboarding and redirect
        await handleOnboardingComplete();

      } else {
        // For non-JSON responses
        const textResponse = await response.text();
        console.log('Received non-JSON response:', textResponse);

        if (response.ok) {
          // Complete onboarding and redirect
          await handleOnboardingComplete();
        } else {
          throw new Error('Server returned an unexpected response format');
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setError((error as Error).message || 'There was an error submitting your information.');
      setSubmissionInProgress(false); // Reset submission lock on error
      setIsSubmitting(false);
    }
  }, [formData, user, submissionInProgress]);

  // Loading state while checking auth
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: currentTheme.primary }} />
      </div>
    );
  }

  // Theme-dependent styles
  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const cardBgColor = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const headingTextColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 ${bgColor} transition-colors duration-300`}>
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className={`text-3xl font-bold ${headingTextColor} transition-colors duration-300`}>
            Welcome to Force
          </h1>
          <p className={`mt-2 ${subTextColor} transition-colors duration-300`}>
            Let's personalize your experience with a few quick questions
          </p>

          {/* Progress indicator */}
          <div className="flex justify-center mt-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className="h-2 w-12 mx-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: step === currentSection
                    ? currentTheme.primary
                    : step < currentSection
                      ? currentTheme.medium
                      : isDarkMode ? '#374151' : '#E5E7EB'
                }}
              />
            ))}
          </div>
        </div>

        <motion.div
          className={`shadow-xl rounded-2xl p-6 md:p-8 ${cardBgColor} transition-colors duration-300 relative`}
          style={{
            boxShadow: `0 10px 25px -5px ${currentTheme.light}, 0 8px 10px -6px ${currentTheme.light}`
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Error message if any */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-100 border border-red-300 text-red-800">
              {error}
            </div>
          )}

          {isSubmitting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-2xl z-10">
              <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-5 rounded-lg flex flex-col items-center transition-colors duration-300`}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: currentTheme.primary }} />
                <p className="mt-3 font-medium">Submitting your responses...</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentSection === 1 && (
              <Question1
                value={formData.goal}
                preferredJournalTypes={formData.preferred_journal_types}
                handleInputChange={(value) => handleInputChange('goal', value)}
                onUpdateJournalTypes={(types) => handleInputChange('preferred_journal_types', types)}
                goToNextSection={goToNextSection}
              />
            )}

            {currentSection === 2 && (
              <Question2
                audioFile={formData.feelingAudio}
                audioURL={audioURL}
                handleAudioRecording={handleAudioRecording}
                goToNextSection={goToNextSection}
                goToPrevSection={goToPrevSection}
              />
            )}

            {currentSection === 3 && (
              <Question3
                photoFile={formData.prettyPhoto}
                photoURL={photoURL}
                handlePhotoUpload={handlePhotoUpload}
                goToNextSection={goToNextSection}
                goToPrevSection={goToPrevSection}
                currentSection={currentSection}
                totalSections={5}
              />
            )}

            {currentSection === 4 && (
              <Question4
                formData={{
                  preferred_writing_time: formData.preferred_writing_time,
                  reminder_enabled: formData.reminder_enabled,
                  reminder_time: formData.reminder_time,
                  notification_preferences: formData.notification_preferences
                }}
                onUpdate={(field: string, value: any) => handleInputChange(field as keyof FormData, value)}
                currentTheme={currentTheme}
                isDarkMode={isDarkMode}
              />
            )}

            {currentSection === 5 && (
              <Question5
                formData={{
                  ai_features_accepted: formData.ai_features_accepted,
                  ai_sentiment_analysis: formData.ai_sentiment_analysis,
                  ai_topic_detection: formData.ai_topic_detection,
                  ai_writing_suggestions: formData.ai_writing_suggestions
                }}
                onUpdate={(field: string, value: any) => handleInputChange(field as keyof FormData, value)}
                currentTheme={currentTheme}
                isDarkMode={isDarkMode}
              />
            )}
          </AnimatePresence>

          {/* Navigation Buttons for Steps 4 & 5 */}
          {(currentSection === 4 || currentSection === 5) && (
            <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
              <button
                onClick={goToPrevSection}
                className="px-6 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  color: isDarkMode ? '#FFFFFF' : '#111827'
                }}
              >
                Back
              </button>
              <div className="flex gap-3">
                {currentSection === 4 && (
                  <button
                    onClick={skipCurrentSection}
                    className="px-6 py-2 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      color: isDarkMode ? '#9CA3AF' : '#6B7280'
                    }}
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={goToNextSection}
                  className="px-6 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: currentTheme.primary,
                    color: '#FFFFFF'
                  }}
                >
                  {currentSection === 5 ? 'Complete' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingForm;