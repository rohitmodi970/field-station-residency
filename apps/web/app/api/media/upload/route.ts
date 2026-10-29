// app/api/media/upload/route.ts - Enhanced version with video-specific fixes

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import User from '@/models/User';
import Journal from '@/models/JournalModel';
import connectDB from '@/db/connectDB';
import { 
  uploadFileToDrive, 
  createUserFolder, 
  getMimeType,
  getOrCreateMediaTypeFolder,
  getDriveClient
} from '@/utilities/googleDrive';

// Media type configuration with enhanced video support
const MEDIA_LIMITS = {
  image: { count: 6, size: 25 * 1024 * 1024 }, // 25MB
  audio: { count: 11, size: 5 * 1024 * 1024 }, // 5MB
  video: { count: 2, size: 200 * 1024 * 1024 }, // 200MB
  document: { count: 5, size: 5 * 1024 * 1024 }, // 5MB
};

// Enhanced MIME type validation for videos
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov files
  'video/x-msvideo', // .avi files
  'video/x-ms-wmv',  // .wmv files
];

const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'wmv'];

// Helper function to validate video files specifically
function validateVideoFile(file: File, fileName: string): { isValid: boolean; error?: string } {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  // Check file extension
  if (!extension || !ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: `Unsupported video format. Allowed formats: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`
    };
  }
  
  // Check MIME type
  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && file.type !== 'application/octet-stream') {
    console.log('⚠️ Video MIME type warning:', {
      reportedType: file.type,
      expectedTypes: ALLOWED_VIDEO_TYPES
    });
    // Don't fail here as some browsers report incorrect MIME types
  }
  
  return { isValid: true };
}

// Helper function to ensure folder exists and is accessible
async function ensureFolderExists(accessToken: string, folderId: string): Promise<string | null> {
  try {
    const drive = getDriveClient(accessToken);
    await drive.files.get({
      fileId: folderId,
      fields: 'id,name'
    });
    console.log('✅ Folder verified:', folderId);
    return folderId;
  } catch (error: any) {
    if (error.code === 404 || error.status === 404) {
      console.log('⚠️ Folder not found:', folderId);
      return null;
    }
    throw error;
  }
}

// Helper function to get or create journal folder with proper error handling
async function getOrCreateJournalFolder(
  accessToken: string,
  journalId: string,
  userFolderId: string | null
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const folderName = `Journal_${journalId}`;
  
  try {
    const searchQuery = userFolderId 
      ? `'${userFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    console.log('🔍 Searching for existing journal folder with query:', searchQuery);
    
    const searchResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id,name)'
    });
    
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const existingFolder = searchResponse.data.files[0];
      if (existingFolder?.id) {
        console.log('✅ Existing journal folder found:', existingFolder.id);
        return existingFolder.id;
      }
    }
    
    console.log('📁 Creating new journal folder:', folderName);
    const newFolderId = await createUserFolder(accessToken, folderName, userFolderId || undefined);
    
    if (!newFolderId) {
      throw new Error('Failed to create journal folder');
    }
    
    console.log('✅ New journal folder created:', newFolderId);
    return newFolderId;
    
  } catch (error: any) {
    if (error.code === 404 && userFolderId) {
      console.log('⚠️ User folder not accessible, creating journal folder in root');
      const rootFolderId = await createUserFolder(accessToken, folderName);
      if (!rootFolderId) {
        throw new Error('Failed to create journal folder in root');
      }
      return rootFolderId;
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting media upload process');
    
    // 1. Database and authentication setup
    await connectDB();
    console.log('✅ Database connected successfully');
    
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    console.log('🔐 User retrieved:', { 
      hasUser: !!authUser, 
      email: authUser?.email
    });
    
    if (authError || !authUser?.email) {
      console.error('❌ Authentication failed: No user email');
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Get session for access token
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('🔐 Session retrieved:', { 
      hasAccessToken: !!session?.access_token 
    });

    if (!session?.access_token) {
      console.error('❌ Authentication failed: No Google Drive access token');
      return NextResponse.json(
        { error: 'Google Drive access token not available. Please reconnect your Google account.' }, 
        { status: 401 }
      );
    }

    // 2. User verification
    console.log('🔍 Looking up user in database:', authUser.email);
    const user = await (User as any).findOne({ email: authUser.email });
    if (!user) {
      console.error('❌ User not found in database:', session.user.email);
      return NextResponse.json(
        { error: 'User account not found' }, 
        { status: 404 }
      );
    }
    console.log('✅ User found:', { userId: user.userId, hasDriveFolder: !!user.googleDriveFolderId });

    // 3. Form data processing
    console.log('📝 Processing form data...');
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const journalId = formData.get('journalId') as string;
    const mediaType = formData.get('mediaType') as keyof typeof MEDIA_LIMITS;
    const fileName = formData.get('fileName') as string || file.name;
    const fileSize = file.size;

    console.log('📋 Form data extracted:', { 
      hasFile: !!file, 
      journalId, 
      mediaType, 
      fileName, 
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      mimeType: file.type
    });

    // 4. Input validation
    if (!file || !journalId || !mediaType) {
      console.error('❌ Validation failed: Missing required fields', { 
        hasFile: !!file, 
        hasJournalId: !!journalId, 
        hasMediaType: !!mediaType 
      });
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    if (!Object.keys(MEDIA_LIMITS).includes(mediaType)) {
      console.error('❌ Validation failed: Invalid media type:', mediaType);
      return NextResponse.json(
        { error: 'Invalid media type' }, 
        { status: 400 }
      );
    }

    // Enhanced video validation
    if (mediaType === 'video') {
      const videoValidation = validateVideoFile(file, fileName);
      if (!videoValidation.isValid) {
        console.error('❌ Video validation failed:', videoValidation.error);
        return NextResponse.json(
          { error: videoValidation.error }, 
          { status: 400 }
        );
      }
      console.log('✅ Video file validation passed');
    }

    // 5. Journal verification
    console.log('🔍 Looking up journal:', journalId);
    const journal = await Journal.findOne({ journalId });
    if (!journal) {
      console.error('❌ Journal not found:', journalId);
      return NextResponse.json(
        { error: 'Journal not found' }, 
        { status: 404 }
      );
    }
    console.log('✅ Journal found:', { 
      journalId: journal.journalId, 
      userId: journal.userId, 
      hasDriveFolder: !!journal.googleDriveFolderId 
    });
    
    if (journal.userId !== user.userId) {
      console.error('❌ Access denied: User does not own journal', { 
        journalUserId: journal.userId, 
        requestUserId: user.userId 
      });
      return NextResponse.json(
        { error: 'Access denied to this journal' }, 
        { status: 403 }
      );
    }

    // 6. Media limits validation
    const mediaCount = journal.media?.[mediaType]?.length || 0;
    console.log('📊 Media limits check:', { 
      currentCount: mediaCount, 
      maxCount: MEDIA_LIMITS[mediaType].count,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      maxSize: `${(MEDIA_LIMITS[mediaType].size / 1024 / 1024).toFixed(0)}MB`
    });
    
    if (mediaCount >= MEDIA_LIMITS[mediaType].count) {
      console.error('❌ Media limit exceeded:', { mediaType, currentCount: mediaCount, maxCount: MEDIA_LIMITS[mediaType].count });
      return NextResponse.json(
        { error: `Maximum ${mediaType} limit reached (${MEDIA_LIMITS[mediaType].count} files)` }, 
        { status: 400 }
      );
    }

    if (fileSize > MEDIA_LIMITS[mediaType].size) {
      console.error('❌ File size limit exceeded:', { 
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`, 
        maxSize: `${(MEDIA_LIMITS[mediaType].size / 1024 / 1024).toFixed(0)}MB` 
      });
      return NextResponse.json(
        { error: `File exceeds ${MEDIA_LIMITS[mediaType].size / (1024 * 1024)}MB size limit` }, 
        { status: 400 }
      );
    }
    
    // 7. Prepare file for upload
    console.log('🔄 Preparing file for upload...');
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(fileName);
    
    // For videos, log additional debug info
    if (mediaType === 'video') {
      console.log('🎥 Video file details:', {
        originalMimeType: file.type,
        detectedMimeType: mimeType,
        fileName,
        bufferSize: buffer.length,
        fileSizeMB: (fileSize / 1024 / 1024).toFixed(2)
      });
    }
    
    console.log('✅ File prepared:', { bufferSize: buffer.length, mimeType });
    
    // 8. Drive folder management
    try {
      console.log('📁 Starting Google Drive folder management...');
      
      // Verify and handle user folder
      let validUserFolderId: string | null = null;
      
      if (user.googleDriveFolderId) {
        console.log('🔍 Verifying existing user folder:', user.googleDriveFolderId);
        validUserFolderId = await ensureFolderExists(session.access_token, user.googleDriveFolderId);
        
        if (!validUserFolderId) {
          console.log('⚠️ User folder not accessible, will create new one');
          user.googleDriveFolderId = null;
        }
      }
      
      if (!validUserFolderId) {
        console.log('📁 Creating new user folder in Google Drive...');
        const userFolderId = await createUserFolder(
          session.access_token,
          `JournalApp_${user.userId}`
        );
        
        if (!userFolderId) {
          console.error('❌ Failed to create user folder in Google Drive');
          throw new Error('Failed to create user folder in Google Drive');
        }
        
        console.log('✅ User folder created:', userFolderId);
        user.googleDriveFolderId = userFolderId;
        await user.save();
        console.log('✅ User folder ID saved to database');
        validUserFolderId = userFolderId;
      } else {
        console.log('✅ User folder verified:', validUserFolderId);
      }

      // Handle journal folder
      let journalFolderId: string;
      
      if (journal.googleDriveFolderId) {
        console.log('🔍 Verifying existing journal folder:', journal.googleDriveFolderId);
        const validJournalFolderId = await ensureFolderExists(session.access_token, journal.googleDriveFolderId);
        
        if (validJournalFolderId) {
          journalFolderId = validJournalFolderId;
          console.log('✅ Journal folder verified:', journalFolderId);
        } else {
          console.log('⚠️ Journal folder not accessible, creating new one');
          journalFolderId = await getOrCreateJournalFolder(session.access_token, journalId, validUserFolderId);
          journal.googleDriveFolderId = journalFolderId;
          await journal.save();
          console.log('✅ New journal folder ID saved to database');
        }
      } else {
        console.log('📁 Creating journal folder...');
        journalFolderId = await getOrCreateJournalFolder(session.access_token, journalId, validUserFolderId);
        journal.googleDriveFolderId = journalFolderId;
        await journal.save();
        console.log('✅ Journal folder ID saved to database');
      }

      // Get or create media type subfolder
      console.log('📁 Creating/retrieving media type folder:', mediaType);
      const mediaTypeFolder = await getOrCreateMediaTypeFolder(
        session.access_token,
        mediaType,
        journalFolderId
      );

      if (!mediaTypeFolder) {
        console.error('❌ Failed to create or retrieve media type folder:', mediaType);
        throw new Error(`Failed to create or retrieve ${mediaType} folder`);
      }
      console.log('✅ Media type folder ready:', mediaTypeFolder);

      // 9. Upload to Google Drive with enhanced error handling for videos
      console.log('☁️ Starting file upload to Google Drive...');
      
      if (mediaType === 'video') {
        console.log('🎥 Starting video upload (this may take longer due to file size)...');
      }
      
      const uploadResult = await uploadFileToDrive(
        session.access_token,
        buffer,
        fileName,
        mimeType,
        mediaTypeFolder
      );
      
      console.log('✅ File uploaded successfully:', { 
        fileId: uploadResult.id, 
        fileName: uploadResult.name,
        size: uploadResult.size 
      });

      // 10. Update journal entry
      console.log('💾 Updating journal entry in database...');
      const newMedia = {
        url: uploadResult.webViewLink || uploadResult.webContentLink,
        driveFileId: uploadResult.id as string,
        driveMimeType: uploadResult.mimeType as string,
        fileName,
        fileSize,
        uploadedAt: new Date()
      };

      if (!journal.media) {
        journal.media = { image: [], audio: [], video: [], document: [] };
        console.log('📝 Initialized media object in journal');
      }

      await Journal.findOneAndUpdate(
        { journalId },
        { $push: { [`media.${mediaType}`]: newMedia } },
        { new: true }
      );
      console.log('✅ Journal updated with new media');

      // 11. Return success response
      console.log('🎉 Media upload completed successfully');
      return NextResponse.json({
        success: true,
        fileId: uploadResult.id,
        url: uploadResult.webViewLink,
        mimeType: uploadResult.mimeType,
        fileName: uploadResult.name,
        size: uploadResult.size
      });

    } catch (uploadError: any) {
      console.error('❌ Google Drive upload error:', {
        error: uploadError.message,
        stack: uploadError.stack,
        name: uploadError.name,
        code: uploadError.code,
        status: uploadError.status,
        mediaType,
        fileName,
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`
      });
      
      // Enhanced error messages for videos
      let errorMessage = 'Google Drive upload failed';
      if (mediaType === 'video') {
        if (uploadError.message?.includes('timeout') || uploadError.code === 'ETIMEDOUT') {
          errorMessage = 'Video upload timed out. Please try with a smaller file or check your connection.';
        } else if (uploadError.message?.includes('quota') || uploadError.status === 403) {
          errorMessage = 'Google Drive storage quota exceeded. Please free up space and try again.';
        } else if (uploadError.message?.includes('size') || uploadError.status === 413) {
          errorMessage = 'Video file is too large. Please compress the video and try again.';
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: uploadError.message 
        }, 
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Media upload error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { error: error.message || 'Failed to process media upload' }, 
      { status: 500 }
    );
  }
}