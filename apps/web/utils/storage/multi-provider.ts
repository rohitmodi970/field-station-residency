// apps/web/utils/storage/multi-provider.ts
import {
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  getSignedUrl,
  MediaType,
  BUCKETS,
  USERS_CLOUD_PATHS,
  PUBLIC_CLOUD_PATHS,
} from '../supabase/storage';
import {
  uploadToGoogleDrive,
  deleteFromGoogleDrive,
  getFileMetadata,
  getDefaultConfig,
  GoogleDriveAuth,
  isAuthorized,
} from '../google-drive/client';
import { StorageProvider } from '@/types/database';

export interface UploadOptions {
  file: File;
  userId: string;
  mediaType: MediaType;
  storageProvider: StorageProvider;
  journalId?: string;
  googleAuth?: GoogleDriveAuth | null;
  folderId?: string;
  bucket?: string;        // Override default bucket
  pathPrefix?: string;    // e.g., 'journal', 'vault', 'profile', 'posts'
}

export interface UploadResult {
  storage_provider: StorageProvider;
  // Supabase fields
  bucket?: string;
  path?: string;
  public_url?: string;
  // Google Drive fields
  drive_file_id?: string;
  drive_mime_type?: string;
  drive_view_url?: string;
  drive_download_url?: string;
  // Common fields
  file_name: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface DeleteOptions {
  storageProvider: StorageProvider;
  // Supabase
  bucket?: string;
  path?: string;
  // Google Drive
  driveFileId?: string;
  googleAuth?: GoogleDriveAuth | null;
}

/**
 * Upload file to selected storage provider
 */
export async function uploadToStorage(
  options: UploadOptions
): Promise<UploadResult> {
  const { file, userId, mediaType, storageProvider, journalId, googleAuth, folderId } = options;
  
  const result: UploadResult = {
    storage_provider: storageProvider,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
  };
  
  // Handle dual storage (both Supabase and Google Drive)
  if (storageProvider === 'both') {
    // Upload to Supabase first
    const supabaseResult = await uploadToSupabase({
      file,
      userId,
      mediaType,
      journalId,
      bucket: options.bucket,
      pathPrefix: options.pathPrefix,
    });
    
    Object.assign(result, supabaseResult);
    
    // Then upload to Google Drive if authorized
    if (googleAuth && isAuthorized(googleAuth)) {
      try {
        const driveResult = await uploadToGoogleDriveStorage({
          file,
          googleAuth,
          folderId,
        });
        
        Object.assign(result, driveResult);
      } catch (error) {
        console.error('Failed to upload to Google Drive (backup):', error);
        // Continue with Supabase only
      }
    }
    
    return result;
  }
  
  // Upload to Supabase only
  if (storageProvider === 'supabase') {
    const supabaseResult = await uploadToSupabase({
      file,
      userId,
      mediaType,
      journalId,
      bucket: options.bucket,
      pathPrefix: options.pathPrefix,
    });
    
    return { ...result, ...supabaseResult };
  }
  
  // Upload to Google Drive only
  if (storageProvider === 'google_drive') {
    if (!googleAuth || !isAuthorized(googleAuth)) {
      throw new Error('Google Drive not authorized. Please connect your Google account.');
    }
    
    const driveResult = await uploadToGoogleDriveStorage({
      file,
      googleAuth,
      folderId,
    });
    
    return { ...result, ...driveResult };
  }
  
  throw new Error(`Unsupported storage provider: ${storageProvider}`);
}

/**
 * Upload to Supabase Storage
 */
async function uploadToSupabase(options: {
  file: File;
  userId: string;
  mediaType: MediaType;
  journalId?: string;
  bucket?: string;
  pathPrefix?: string;
}): Promise<Partial<UploadResult>> {
  const { file, userId, mediaType, journalId, bucket, pathPrefix } = options;
  
  const fileName = `${Date.now()}-${file.name}`;
  // Default to users_cloud for private content
  const selectedBucket = bucket || BUCKETS.USERS_CLOUD;
  // Default path prefix based on use case
  const selectedPathPrefix = pathPrefix || USERS_CLOUD_PATHS.JOURNAL;
  
  // Upload to Supabase
  const uploadResult = await uploadToSupabaseStorage(
    userId,
    file,
    fileName,
    mediaType,
    { journalId, bucket: selectedBucket, pathPrefix: selectedPathPrefix }
  );
  
  // Get image dimensions if it's an image
  let width: number | undefined;
  let height: number | undefined;
  
  if (mediaType === 'image') {
    try {
      const dimensions = await getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
    } catch (error) {
      console.error('Failed to get image dimensions:', error);
    }
  }
  
  // Get audio/video duration if applicable
  let duration: number | undefined;
  
  if (mediaType === 'audio' || mediaType === 'video') {
    try {
      duration = await getMediaDuration(file);
    } catch (error) {
      console.error('Failed to get media duration:', error);
    }
  }
  
  return {
    bucket: uploadResult.bucket,
    path: uploadResult.path,
    public_url: uploadResult.publicUrl,
    width,
    height,
    duration,
  };
}

/**
 * Upload to Google Drive Storage
 */
async function uploadToGoogleDriveStorage(options: {
  file: File;
  googleAuth: GoogleDriveAuth;
  folderId?: string;
}): Promise<Partial<UploadResult>> {
  const { file, googleAuth, folderId } = options;
  
  const config = getDefaultConfig();
  const buffer = Buffer.from(await file.arrayBuffer());
  
  const driveFile = await uploadToGoogleDrive(
    googleAuth,
    config,
    {
      name: file.name,
      mimeType: file.type,
      buffer,
    },
    folderId
  );
  
  return {
    drive_file_id: driveFile.fileId,
    drive_mime_type: file.type,
    drive_view_url: driveFile.webViewLink,
    drive_download_url: driveFile.webContentLink,
  };
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(options: DeleteOptions): Promise<void> {
  const { storageProvider, bucket, path, driveFileId, googleAuth } = options;
  
  if (storageProvider === 'both') {
    // Delete from both
    const promises: Promise<any>[] = [];
    
    if (bucket && path) {
      promises.push(deleteFromSupabaseStorage(bucket, path));
    }
    
    if (driveFileId && googleAuth && isAuthorized(googleAuth)) {
      const config = getDefaultConfig();
      promises.push(deleteFromGoogleDrive(googleAuth, config, driveFileId));
    }
    
    await Promise.allSettled(promises);
    return;
  }
  
  if (storageProvider === 'supabase') {
    if (!bucket || !path) {
      throw new Error('Bucket and path required for Supabase deletion');
    }
    await deleteFromSupabaseStorage(bucket, path);
    return;
  }
  
  if (storageProvider === 'google_drive') {
    if (!driveFileId) {
      throw new Error('Drive file ID required for Google Drive deletion');
    }
    
    if (!googleAuth || !isAuthorized(googleAuth)) {
      throw new Error('Google Drive not authorized');
    }
    
    const config = getDefaultConfig();
    await deleteFromGoogleDrive(googleAuth, config, driveFileId);
    return;
  }
}

/**
 * Get public URL for file
 */
export async function getPublicUrl(options: {
  storageProvider: StorageProvider;
  bucket?: string;
  path?: string;
  driveFileId?: string;
  googleAuth?: GoogleDriveAuth | null;
}): Promise<string | null> {
  const { storageProvider, bucket, path, driveFileId, googleAuth } = options;
  
  // For 'both', prefer Supabase URL
  if (storageProvider === 'both' || storageProvider === 'supabase') {
    if (bucket && path) {
      return await getSignedUrl(bucket, path);
    }
  }
  
  if (storageProvider === 'google_drive') {
    if (!driveFileId || !googleAuth || !isAuthorized(googleAuth)) {
      return null;
    }
    
    const config = getDefaultConfig();
    const metadata = await getFileMetadata(googleAuth, config, driveFileId);
    return metadata.webViewLink || metadata.webContentLink || null;
  }
  
  return null;
}

/**
 * Helper: Get image dimensions
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Helper: Get media duration
 */
function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(media.duration));
    };
    
    media.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load media'));
    };
    
    media.src = url;
  });
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, mediaType: MediaType): { valid: boolean; error?: string } {
  const MAX_SIZES: Record<MediaType, number> = {
    image: 25 * 1024 * 1024, // 25MB
    audio: 5 * 1024 * 1024, // 5MB
    video: 200 * 1024 * 1024, // 200MB
    document: 5 * 1024 * 1024, // 5MB
  };
  
  const ALLOWED_TYPES: Record<MediaType, string[]> = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3'],
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  };
  
  const maxSize = MAX_SIZES[mediaType];
  const allowedTypes = ALLOWED_TYPES[mediaType];
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`,
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed for ${mediaType}`,
    };
  }
  
  return { valid: true };
}
