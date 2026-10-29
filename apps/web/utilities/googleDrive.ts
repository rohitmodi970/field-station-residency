// utilities/googleDrive.ts - Enhanced version with video upload optimizations

import { google } from 'googleapis';
import { Readable } from 'stream';

// Initialize the Google Drive API client
export function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

// Create a folder in Google Drive for a specific user
export async function createUserFolder(
    accessToken: string, 
    folderName: string,
    parentFolderId?: string
  ) {
    const drive = getDriveClient(accessToken);
  
    try {
      const requestBody: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };
  
      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }
  
      const response = await drive.files.create({
        requestBody,
        fields: 'id',
      });
  
      return response.data.id;
    } catch (error: any) {
      console.error('❌ Error creating folder in Google Drive:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.status,
        folderName,
        parentFolderId
      });
      throw error;
    }
}

// Enhanced file upload with video-specific optimizations
export async function uploadFileToDrive(
  accessToken: string, 
  file: Buffer, 
  fileName: string, 
  mimeType: string, 
  folderId: string
) {
  const drive = getDriveClient(accessToken);
  
  try {
    console.log('🔄 Preparing file upload to Google Drive:', {
      fileName,
      mimeType,
      fileSize: `${(file.length / 1024 / 1024).toFixed(2)}MB`,
      folderId
    });

    const requestBody = {
      name: fileName,
      parents: [folderId],
    };
    
    const media = {
      mimeType,
      body: Readable.from(file),
    };
    
    // For large video files, we need to handle potential timeouts
    const isLargeFile = file.length > 50 * 1024 * 1024; // 50MB threshold
    const isVideo = mimeType.startsWith('video/');
    
    if (isLargeFile || isVideo) {
      console.log('📹 Uploading large file/video with extended timeout...');
      
      // Use resumable upload for large files
      const response = await drive.files.create({
        requestBody,
        media,
        fields: 'id,name,mimeType,webViewLink,webContentLink,size',
        // Enable resumable uploads for large files
        uploadType: 'resumable',
      });
      
      console.log('✅ Large file upload successful:', {
        fileId: response.data.id,
        fileName: response.data.name,
        size: response.data.size
      });
      
      return response.data;
    } else {
      // Standard upload for smaller files
      const response = await drive.files.create({
        requestBody,
        media,
        fields: 'id,name,mimeType,webViewLink,webContentLink,size',
      });
      
      console.log('✅ File upload successful:', {
        fileId: response.data.id,
        fileName: response.data.name,
        size: response.data.size
      });
      
      return response.data;
    }
    
  } catch (error: any) {
    console.error('❌ Error uploading file to Google Drive:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      fileName,
      mimeType,
      fileSize: `${(file.length / 1024 / 1024).toFixed(2)}MB`,
      folderId
    });
    
    // Enhanced error handling for common video upload issues
    if (mimeType.startsWith('video/')) {
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        console.error('🎥 Video upload timeout - file may be too large or connection too slow');
        error.message = 'Video upload timed out. Please try with a smaller file or check your internet connection.';
      } else if (error.status === 403) {
        console.error('🎥 Video upload forbidden - likely quota issue');
        error.message = 'Upload failed due to Google Drive quota limits. Please free up storage space.';
      } else if (error.status === 413) {
        console.error('🎥 Video file too large');
        error.message = 'Video file is too large for upload. Please compress the video file.';
      }
    }
    
    throw error;
  }
}

// Delete a file from Google Drive
export async function deleteFileFromDrive(accessToken: string, fileId: string) {
  const drive = getDriveClient(accessToken);
  
  try {
    await drive.files.delete({
      fileId,
    });
    
    return true;
  } catch (error: any) {
    console.error('❌ Error deleting file from Google Drive:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      fileId
    });
    throw error;
  }
}

// Get file metadata from Google Drive
export async function getFileMetadata(accessToken: string, fileId: string) {
  const drive = getDriveClient(accessToken);
  
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,webViewLink,webContentLink,size',
    });
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error getting file metadata from Google Drive:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      fileId
    });
    throw error;
  }
}

// Get a list of files in a folder
export async function listFilesInFolder(accessToken: string, folderId: string) {
  const drive = getDriveClient(accessToken);
  
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,webViewLink,webContentLink,size)',
    });
    
    return response.data.files;
  } catch (error: any) {
    console.error('❌ Error listing files in Google Drive folder:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      folderId
    });
    throw error;
  }
}

// Update file in Google Drive with video support
export async function updateFileInDrive(
  accessToken: string,
  fileId: string,
  file: Buffer,
  mimeType: string
) {
  const drive = getDriveClient(accessToken);
  
  try {
    console.log('🔄 Updating file in Google Drive:', {
      fileId,
      mimeType,
      fileSize: `${(file.length / 1024 / 1024).toFixed(2)}MB`
    });

    const media = {
      mimeType,
      body: Readable.from(file),
    };
    
    // Use resumable upload for large files
    const isLargeFile = file.length > 50 * 1024 * 1024; // 50MB threshold
    const uploadOptions: any = {
      fileId,
      media,
      fields: 'id,name,mimeType,webViewLink,webContentLink,size',
    };
    
    if (isLargeFile) {
      uploadOptions.uploadType = 'resumable';
    }
    
    const response = await drive.files.update(uploadOptions);
    
    console.log('✅ File update successful:', {
      fileId: response.data.id,
      fileName: response.data.name,
      size: response.data.size
    });
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error updating file in Google Drive:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      fileId,
      mimeType,
      fileSize: `${(file.length / 1024 / 1024).toFixed(2)}MB`
    });
    throw error;
  }
}

// Enhanced MIME type detection with better video support
export function getMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    
    // Video - Enhanced support
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'm4v': 'video/x-m4v',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
  };
  
  if (extension && mimeTypes[extension]) {
    console.log('✅ MIME type detected:', { extension, mimeType: mimeTypes[extension] });
    return mimeTypes[extension];
  }
  
  console.log('⚠️ Unknown file extension, using default MIME type:', extension);
  return 'application/octet-stream';
}

export async function getOrCreateMediaTypeFolder(
  accessToken: string,
  mediaType: string,
  journalFolderId: string
) {
  const drive = getDriveClient(accessToken);
  
  try {
    console.log('🔍 Checking for existing media type folder:', {
      mediaType,
      journalFolderId
    });

    // First check if folder already exists
    const response = await drive.files.list({
      q: `'${journalFolderId}' in parents and name='${mediaType}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
    });
    
    // If folder exists, return its ID
    if (response.data.files && response.data.files.length > 0 && response.data.files[0]) {
      console.log('✅ Media type folder found:', {
        mediaType,
        folderId: response.data.files[0].id
      });
      return response.data.files[0].id;
    }
    
    console.log('📁 Creating new media type folder:', { mediaType });
    
    // If folder doesn't exist, create it
    const requestBody = {
      name: mediaType,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [journalFolderId],
    };
    
    const createResponse = await drive.files.create({
      requestBody,
      fields: 'id',
    });
    
    console.log('✅ Media type folder created successfully:', {
      mediaType,
      folderId: createResponse.data.id
    });
    
    return createResponse.data.id;
  } catch (error: any) {
    console.error('❌ Error creating or getting media type folder:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      mediaType,
      journalFolderId
    });
    throw error;
  }
}

// New function: Check Google Drive quota and storage
export async function checkDriveQuota(accessToken: string) {
  const drive = getDriveClient(accessToken);
  
  try {
    const response = await drive.about.get({
      fields: 'storageQuota'
    });
    
    const quota = response.data.storageQuota;
    if (quota) {
      const used = parseInt(quota.usage || '0');
      const limit = parseInt(quota.limit || '0');
      const available = limit - used;
      
      console.log('📊 Google Drive storage info:', {
        used: `${(used / 1024 / 1024 / 1024).toFixed(2)}GB`,
        limit: `${(limit / 1024 / 1024 / 1024).toFixed(2)}GB`,
        available: `${(available / 1024 / 1024 / 1024).toFixed(2)}GB`,
        percentUsed: `${((used / limit) * 100).toFixed(1)}%`
      });
      
      return {
        used,
        limit,
        available,
        percentUsed: (used / limit) * 100
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('❌ Error checking Google Drive quota:', {
      error: error.message,
      code: error.code,
      status: error.status
    });
    throw error;
  }
}

// New function: Validate file before upload
export function validateFileForUpload(
  file: Buffer,
  fileName: string,
  mediaType: string,
  maxSize: number
): { isValid: boolean; error?: string } {
  
  // Check file size
  if (file.length > maxSize) {
    return {
      isValid: false,
      error: `File size (${(file.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(0)}MB)`
    };
  }
  
  // Check if file is empty
  if (file.length === 0) {
    return {
      isValid: false,
      error: 'File appears to be empty'
    };
  }
  
  // Validate file extension
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) {
    return {
      isValid: false,
      error: 'File must have a valid extension'
    };
  }
  
  // Media type specific validations
  const allowedExtensions: Record<string, string[]> = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    audio: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
    video: ['mp4', 'webm', 'mov', 'avi', 'wmv', 'flv', 'mkv', '3gp', 'm4v'],
    document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt']
  };
  
  if (allowedExtensions[mediaType] && !allowedExtensions[mediaType].includes(extension)) {
    return {
      isValid: false,
      error: `Invalid file type for ${mediaType}. Allowed: ${allowedExtensions[mediaType].join(', ')}`
    };
  }
  
  // Additional video-specific checks
  if (mediaType === 'video') {
    // Check for common video file signatures (magic numbers)
    const isValidVideoFile = checkVideoFileSignature(file, extension);
    if (!isValidVideoFile) {
      return {
        isValid: false,
        error: 'File does not appear to be a valid video file'
      };
    }
  }
  
  return { isValid: true };
}

// Helper function to check video file signatures
function checkVideoFileSignature(file: Buffer, extension: string): boolean {
  if (file.length < 12) return false;
  
  const first12Bytes = file.slice(0, 12);
  
  // Common video file signatures
  const videoSignatures: Record<string, Buffer[]> = {
    mp4: [
      Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // ftyp
      Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
    ],
    webm: [
      Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), // EBML header
    ],
    avi: [
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
    ],
    mov: [
      Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74]), // QuickTime
    ]
  };
  
  if (videoSignatures[extension]) {
    return videoSignatures[extension].some(signature => {
      if (first12Bytes.length < signature.length) return false;
      return first12Bytes.slice(0, signature.length).equals(signature);
    });
  }
  
  // If we don't have a specific signature, assume it's valid
  // (some formats are harder to detect)
  return true;
}