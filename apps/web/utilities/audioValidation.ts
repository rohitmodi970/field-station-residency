/**
 * Audio file validation utilities
 * Handles MIME type normalization and validation for audio analysis endpoints
 */

/**
 * Supported audio MIME types for Hume API
 * Includes common variations (e.g., audio/x-m4a, audio/x-wav)
 */
export const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/m4a',
  'audio/flac',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/opus',
] as const;

/**
 * Normalize audio MIME type by removing vendor prefixes
 * Examples:
 * - audio/x-m4a -> audio/m4a
 * - audio/x-wav -> audio/wav
 * - audio/x-flac -> audio/flac
 */
export function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.replace(/^audio\/x-/, 'audio/');
}

/**
 * Validate if the given MIME type is a supported audio format
 * Automatically normalizes the type before checking
 */
export function isValidAudioType(mimeType: string): boolean {
  const normalized = normalizeAudioMimeType(mimeType);
  return SUPPORTED_AUDIO_TYPES.includes(normalized as any);
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const normalized = normalizeAudioMimeType(mimeType);
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/m4a': 'm4a',
    'audio/flac': 'flac',
    'audio/mp4': 'mp4',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/opus': 'opus',
  };
  return map[normalized] || 'audio';
}

/**
 * Validate audio file with detailed error messages
 * Returns null if valid, or an error message string if invalid
 */
export function validateAudioFile(file: File | null): string | null {
  if (!file) {
    return 'No audio file provided';
  }

  if (!isValidAudioType(file.type)) {
    return `Invalid file type: ${file.type}. Supported: ${SUPPORTED_AUDIO_TYPES.join(', ')}`;
  }

  // Validate file size (max 500MB for audio files)
  const maxSizeBytes = 500 * 1024 * 1024;
  if (file.size === 0) {
    return 'File is empty';
  }
  if (file.size > maxSizeBytes) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max size: 500MB`;
  }

  return null;
}
