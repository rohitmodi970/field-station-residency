// apps/web/utils/supabase/storage.ts
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from './admin';

export const BUCKETS = {
  USERS_CLOUD: 'users_cloud',    // Private: journal, vault, documents
  PUBLIC_CLOUD: 'public_cloud',  // Public: profile images, public posts
} as const;

// Path prefixes for users_cloud
export const USERS_CLOUD_PATHS = {
  JOURNAL: 'journal',
  VAULT: 'vault',
  DOCUMENTS: 'documents',
  ONBOARDING: 'onboarding',
} as const;

// Path prefixes for public_cloud
export const PUBLIC_CLOUD_PATHS = {
  PROFILE: 'profile',
  POSTS: 'posts',
  APP: 'app',
} as const;

export type MediaType = 'image' | 'audio' | 'video' | 'document';

export interface UploadResult {
  id: string;
  path: string;
  fullPath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  bucket: string;
}

/**
 * Sanitize filename for storage (remove spaces and special characters)
 */
export function sanitizeFileName(fileName: string): string {
  // Get file extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  
  // Replace spaces with underscores and remove/replace special characters
  const sanitizedName = name
    .replace(/\s+/g, '_')                    // Replace spaces with underscores
    .replace(/[^\w\-_.]/g, '')               // Remove special characters except - _ .
    .replace(/_+/g, '_')                     // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '');                // Remove leading/trailing underscores
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  
  return `${sanitizedName}_${timestamp}${extension}`;
}

/**
 * Initialize storage buckets (run this once during setup)
 */
export async function initializeStorageBuckets() {
  const supabase = createAdminClient();

  const buckets = [
    { 
      name: BUCKETS.USERS_CLOUD, 
      public: false,
      description: 'Private storage: journal, vault, documents'
    },
    { 
      name: BUCKETS.PUBLIC_CLOUD, 
      public: true,
      description: 'Public storage: profile images, public posts'
    },
  ];

  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket.name);
    
    if (!existing) {
      const { error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 200 * 1024 * 1024, // 200MB
      });
      
      if (error) {
        console.error(`Error creating bucket ${bucket.name}:`, error);
      } else {
        console.log(`✅ Bucket created: ${bucket.name} (${bucket.description})`);
      }
    }
  }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadToSupabaseStorage(
  userId: string,
  file: File | Buffer,
  fileName: string,
  mediaType: MediaType,
  options?: {
    journalId?: string;
    bucket?: string;
    makePublic?: boolean;
    pathPrefix?: string; // e.g., 'journal', 'vault', 'documents', 'profile', 'posts'
  }
): Promise<UploadResult> {
  const supabase = createAdminClient();
  const bucket = options?.bucket || BUCKETS.USERS_CLOUD;
  const pathPrefix = options?.pathPrefix || USERS_CLOUD_PATHS.JOURNAL;
  
  // Sanitize filename to remove spaces and special characters
  const sanitizedFileName = sanitizeFileName(fileName);
  
  // Create organized path based on bucket and purpose
  // users_cloud: journal/<userId>/<journalId>/<sanitizedFileName>
  // users_cloud: vault/<userId>/<sanitizedFileName>
  // public_cloud: profile/<userId>/<sanitizedFileName>
  // public_cloud: posts/<userId>/<postId>/<sanitizedFileName>
  const path = options?.journalId
    ? `${pathPrefix}/${userId}/${options.journalId}/${sanitizedFileName}`
    : `${pathPrefix}/${userId}/${sanitizedFileName}`;

  // Convert File to Buffer if needed
  let fileBuffer: Buffer;
  let fileSize: number;
  let mimeType: string;

  if (file instanceof Buffer) {
    fileBuffer = file;
    fileSize = file.length;
    mimeType = getMimeType(fileName);
  } else {
    // file is File type here
    const arrayBuffer = await (file as File).arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    fileSize = (file as File).size;
    mimeType = (file as File).type || getMimeType(fileName);
  }

  console.log('📤 Uploading to Supabase Storage:', {
    bucket,
    path,
    size: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
    mimeType,
  });

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    console.error('❌ Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL (even for private buckets, we can generate signed URLs later)
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    id: data.path,
    path: data.path,
    fullPath: data.fullPath,
    publicUrl: urlData.publicUrl,
    fileName: sanitizedFileName, // Use sanitized name for consistency
    fileSize,
    mimeType,
    bucket,
  };
}

/**
 * Get signed URL for private file (expires in 1 hour by default)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFromSupabaseStorage(
  bucket: string,
  path: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error('❌ Delete error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }

  console.log('✅ File deleted:', path);
  return true;
}

/**
 * Move file between folders
 */
export async function moveFile(
  bucket: string,
  fromPath: string,
  toPath: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .move(fromPath, toPath);

  if (error) {
    throw new Error(`Move failed: ${error.message}`);
  }

  return true;
}

/**
 * List files in a folder
 */
export async function listFiles(
  bucket: string,
  folderPath: string
): Promise<any[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folderPath);

  if (error) {
    throw new Error(`List failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Get storage usage for a user
 */
export async function getUserStorageUsage(userId: string): Promise<{
  totalSize: number;
  fileCount: number;
  byType: Record<MediaType, { size: number; count: number }>;
}> {
  const supabase = createAdminClient();
  
  const { data: mediaFiles } = await supabase
    .from('journal_media')
    .select('file_size, media_type')
    .eq('user_id', userId);

  if (!mediaFiles) {
    return {
      totalSize: 0,
      fileCount: 0,
      byType: {
        image: { size: 0, count: 0 },
        audio: { size: 0, count: 0 },
        video: { size: 0, count: 0 },
        document: { size: 0, count: 0 },
      },
    };
  }

  const byType: Record<MediaType, { size: number; count: number }> = {
    image: { size: 0, count: 0 },
    audio: { size: 0, count: 0 },
    video: { size: 0, count: 0 },
    document: { size: 0, count: 0 },
  };

  let totalSize = 0;

  mediaFiles.forEach((file) => {
    const type = file.media_type as MediaType;
    byType[type].size += file.file_size || 0;
    byType[type].count += 1;
    totalSize += file.file_size || 0;
  });

  return {
    totalSize,
    fileCount: mediaFiles.length,
    byType,
  };
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File | Buffer,
  mediaType: MediaType,
  maxSize: number
): { isValid: boolean; error?: string } {
  const fileSize = file instanceof Buffer ? file.length : (file as File).size;
  const fileName = file instanceof Buffer ? '' : (file as File).name;

  if (fileSize > maxSize) {
    return {
      isValid: false,
      error: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${(maxSize / 1024 / 1024).toFixed(0)}MB)`,
    };
  }

  if (fileSize === 0) {
    return {
      isValid: false,
      error: 'File is empty',
    };
  }

  if (fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) {
      return {
        isValid: false,
        error: 'File must have a valid extension',
      };
    }

    const allowedExtensions: Record<MediaType, string[]> = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'],
      audio: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'webm'],
      video: ['mp4', 'webm', 'mov', 'avi', 'wmv', 'mkv'],
      document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
    };

    if (!allowedExtensions[mediaType].includes(extension)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed: ${allowedExtensions[mediaType].join(', ')}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Get MIME type from filename
 */
export function getMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    // Video
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    mkv: 'video/x-matroska',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
  };

  return extension && mimeTypes[extension]
    ? mimeTypes[extension]
    : 'application/octet-stream';
}