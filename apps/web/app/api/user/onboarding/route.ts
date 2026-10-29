// app/api/user/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { 
  uploadToSupabaseStorage, 
  BUCKETS, 
  USERS_CLOUD_PATHS 
} from '@/utils/supabase/storage';

// Helper function to convert audio to ASCII representation
const convertAudioToAscii = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    // This is a simple implementation - for a real app, you'd want a more sophisticated
    // audio processing solution that creates a meaningful ASCII representation
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Sample the audio data to create a simplified waveform
    const samplingRate = Math.ceil(uint8Array.length / 100); // Sample to get ~100 data points
    let asciiWaveform = '';
    
    const chars = ' ▁▂▃▄▅▆▇█'; // ASCII characters to represent waveform amplitude
    
    for (let i = 0; i < uint8Array.length; i += samplingRate) {
      // Calculate average value for this sample
      let sum = 0;
      let count = 0;
      
      for (let j = 0; j < samplingRate && i + j < uint8Array.length; j++) {
        const value = uint8Array[i + j];
        if (value !== undefined) {
          sum += value;
          count++;
        }
      }
      
      const avgValue = count > 0 ? sum / count : 0;
      // Map to an ASCII character (0-255 range mapped to our characters array)
      const charIndex = Math.floor((avgValue / 255) * (chars.length - 1));
      asciiWaveform += chars[charIndex];
      
      // Add line breaks to keep it readable
      if ((i / samplingRate) % 50 === 49) {
        asciiWaveform += '\n';
      }
    }
    
    return asciiWaveform;
  } catch (error) {
    console.error('Error converting audio to ASCII:', error);
    return ''; // Return empty string on error
  }
};

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse form data
    const formData = await req.formData();
    
    // Step 1: Goal Setting
    const goal = formData.get('goal') as string;
    const preferredJournalTypesStr = formData.get('preferred_journal_types') as string | null;
    const preferredJournalTypes = preferredJournalTypesStr ? JSON.parse(preferredJournalTypesStr) : null;
    
    // Step 2: Audio
    const feelingAudio = formData.get('feelingAudio') as File | null;
    const feelingAudioTranscription = formData.get('feeling_audio_transcription') as string | null;
    const feelingAudioSentiment = formData.get('feeling_audio_sentiment') as string | null;
    
    // Step 3: Photo
    const prettyPhoto = formData.get('prettyPhoto') as File | null;
    
    // Step 4: Preferences
    const preferredWritingTime = formData.get('preferred_writing_time') as string | null;
    const reminderEnabled = formData.get('reminder_enabled') === 'true';
    const reminderTime = formData.get('reminder_time') as string | null;
    const notificationPreferencesStr = formData.get('notification_preferences') as string | null;
    const notificationPreferences = notificationPreferencesStr ? JSON.parse(notificationPreferencesStr) : null;
    
    // Step 5: AI Features
    const aiFeaturesAccepted = formData.get('ai_features_accepted') === 'true';
    const aiSentimentAnalysis = formData.get('ai_sentiment_analysis') === 'true';
    const aiTopicDetection = formData.get('ai_topic_detection') === 'true';
    const aiWritingSuggestions = formData.get('ai_writing_suggestions') === 'true';
    
    // Additional Profile Info
    const interestsStr = formData.get('interests') as string | null;
    const interests = interestsStr ? JSON.parse(interestsStr) : null;
    const personalityTraitsStr = formData.get('personality_traits') as string | null;
    const personalityTraits = personalityTraitsStr ? JSON.parse(personalityTraitsStr) : null;
    const moodTrackingEnabled = formData.get('mood_tracking_enabled') === 'true';
    
    // Tracking Fields
    const stepCompleted = formData.get('step_completed') as string | null;
    const timeSpentSeconds = formData.get('time_spent_seconds') as string | null;
    const skippedStepsStr = formData.get('skipped_steps') as string | null;
    const skippedSteps = skippedStepsStr ? JSON.parse(skippedStepsStr) : null;
    const deviceType = formData.get('device_type') as string | null;
    const platform = formData.get('platform') as string | null;
    const referralSource = formData.get('referral_source') as string | null;
    
    // Validate required fields
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      );
    }
    
    // Prepare onboarding data
    const onboardingData: any = {
      user_id: user.id,
      step_completed: stepCompleted ? parseInt(stepCompleted) : 5,
      total_steps: 5,
      goal,
      completed: true,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    
    // Add optional fields if provided
    if (preferredJournalTypes) onboardingData.preferred_journal_types = preferredJournalTypes;
    if (feelingAudioTranscription) onboardingData.feeling_audio_transcription = feelingAudioTranscription;
    if (feelingAudioSentiment) onboardingData.feeling_audio_sentiment = parseFloat(feelingAudioSentiment);
    if (preferredWritingTime) onboardingData.preferred_writing_time = preferredWritingTime;
    if (reminderEnabled !== undefined) onboardingData.reminder_enabled = reminderEnabled;
    if (reminderTime) onboardingData.reminder_time = reminderTime;
    if (notificationPreferences) onboardingData.notification_preferences = notificationPreferences;
    if (aiFeaturesAccepted !== undefined) onboardingData.ai_features_accepted = aiFeaturesAccepted;
    if (aiSentimentAnalysis !== undefined) onboardingData.ai_sentiment_analysis = aiSentimentAnalysis;
    if (aiTopicDetection !== undefined) onboardingData.ai_topic_detection = aiTopicDetection;
    if (aiWritingSuggestions !== undefined) onboardingData.ai_writing_suggestions = aiWritingSuggestions;
    if (interests) onboardingData.interests = interests;
    if (personalityTraits) onboardingData.personality_traits = personalityTraits;
    if (moodTrackingEnabled !== undefined) onboardingData.mood_tracking_enabled = moodTrackingEnabled;
    if (timeSpentSeconds) onboardingData.time_spent_seconds = parseInt(timeSpentSeconds);
    if (skippedSteps) onboardingData.skipped_steps = skippedSteps;
    if (deviceType) onboardingData.device_type = deviceType;
    if (platform) onboardingData.platform = platform;
    if (referralSource) onboardingData.referral_source = referralSource;
    
    // Handle audio file upload
    if (feelingAudio) {
      try {
        const userId = user.id;
        // Optimize: Get extension first, avoid long filename processing
        const ext = feelingAudio.name.split('.').pop() || 'mp3';
        const audioFilename = `audio_${Date.now()}.${ext}`;
        
        // Convert File to ArrayBuffer
        const audioArrayBuffer = await feelingAudio.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        
        // Upload to Supabase Storage: users_cloud/documents/<userId>/
        const audioUploadResult = await uploadToSupabaseStorage(
          userId,
          audioBuffer,
          audioFilename,
          'audio',
          { 
            bucket: BUCKETS.USERS_CLOUD, 
            pathPrefix: USERS_CLOUD_PATHS.DOCUMENTS 
          }
        );
        
        // Generate ASCII representation
        const asciiData = await convertAudioToAscii(audioArrayBuffer);
        
        // Add to onboarding data
        onboardingData.feeling_audio = {
          bucket: audioUploadResult.bucket,
          path: audioUploadResult.path,
          public_url: audioUploadResult.publicUrl,
          file_name: audioUploadResult.fileName,
          file_size: audioUploadResult.fileSize,
          mime_type: audioUploadResult.mimeType,
          ascii_data: asciiData,
        };
      } catch (audioError) {
        console.error('Error processing audio:', audioError);
        return NextResponse.json(
          { error: 'Failed to process audio file', details: (audioError as Error).message },
          { status: 500 }
        );
      }
    }
    
    // Handle photo file upload
    if (prettyPhoto) {
      try {
        const userId = user.id;
        // Optimize: Get extension first, avoid long filename processing
        const ext = prettyPhoto.name.split('.').pop() || 'jpg';
        const photoFilename = `photo_${Date.now()}.${ext}`;
        
        // Convert File to Buffer
        const photoArrayBuffer = await prettyPhoto.arrayBuffer();
        const photoBuffer = Buffer.from(photoArrayBuffer);
        
        // Upload to Supabase Storage: users_cloud/onboarding/<userId>/
        const photoUploadResult = await uploadToSupabaseStorage(
          userId,
          photoBuffer,
          photoFilename,
          'image',
          { 
            bucket: BUCKETS.USERS_CLOUD, 
            pathPrefix: USERS_CLOUD_PATHS.ONBOARDING 
          }
        );
        
        // Add to onboarding data
        onboardingData.pretty_photo = {
          bucket: photoUploadResult.bucket,
          path: photoUploadResult.path,
          public_url: photoUploadResult.publicUrl,
          file_name: photoUploadResult.fileName,
          file_size: photoUploadResult.fileSize,
          mime_type: photoUploadResult.mimeType,
        };
      } catch (photoError) {
        console.error('Error processing photo:', photoError);
        return NextResponse.json(
          { error: 'Failed to process photo file', details: (photoError as Error).message },
          { status: 500 }
        );
      }
    }
    
    // Create onboarding record in Supabase
    const { data: onboarding, error: onboardingError } = await supabase
      .from('user_onboarding')
      .insert(onboardingData)
      .select()
      .single();
    
    if (onboardingError) {
      console.error('Error creating onboarding record:', onboardingError);
      return NextResponse.json(
        { error: 'Failed to create onboarding record', details: onboardingError.message },
        { status: 500 }
      );
    }
    
    // Update user to mark onboarding as complete
    const { error: updateError } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Error updating user:', updateError);
      // Don't return error here, as the onboarding record was created
    }
    
    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { 
        onboardingId: onboarding.id
      }
    });
    
  } catch (error) {
    console.error('Error in onboarding submission:', error);
    // Always return a properly formatted JSON response
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}