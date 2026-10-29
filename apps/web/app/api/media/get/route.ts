// app/api/media/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import connectDB from '@/db/connectDB';
import Journal from '@/models/JournalModel';
import User from '@/models/User';
import { getFileMetadata } from '@/utilities/googleDrive';

export async function GET(req: NextRequest) {
  try {
    // 1. Database and authentication setup
    await connectDB();
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    // Get session for access token
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check for access token
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Google Drive access token not available. Please reconnect your Google account.' }, 
        { status: 401 }
      );
    }

    // 2. Parse URL params
    const { searchParams } = new URL(req.url);
    const journalId = searchParams.get('journalId');
    const mediaType = searchParams.get('mediaType');
    const fileId = searchParams.get('fileId');
    
    // 3. Input validation
    if (!journalId) {
      return NextResponse.json(
        { error: 'Missing required journalId parameter' }, 
        { status: 400 }
      );
    }

    // 4. Find the journal
    const journal = await Journal.findOne({ journalId });
    
    if (!journal) {
      return NextResponse.json(
        { error: 'Journal not found' }, 
        { status: 404 }
      );
    }
    
    // Get MongoDB user for userId comparison
    const dbUser = await (User as any).findOne({ email: user.email });
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User account not found' }, 
        { status: 404 }
      );
    }

    // 5. Verify user owns the journal
    if (journal.userId !== dbUser.userId) {
      return NextResponse.json(
        { error: 'Access denied to this journal' }, 
        { status: 403 }
      );
    }

    // 6. Handle different request types
    
    // Case 1: Get a specific file by ID
    if (fileId) {
      try {
        // Find the file in the journal's media arrays
        let mediaItem;
        
        // Define valid media types as a type to help TypeScript
        type MediaType = 'image' | 'audio' | 'video' | 'document';
        
        for (const type of ['image', 'audio', 'video', 'document'] as MediaType[]) {
          if (journal.media?.[type]) {
            mediaItem = journal.media[type].find((item: { driveFileId: string }) => item.driveFileId === fileId);
            if (mediaItem) break;
          }
        }
        
        if (!mediaItem) {
          return NextResponse.json(
            { error: 'Media not found in journal' }, 
            { status: 404 }
          );
        }
        
        // Get fresh metadata from Google Drive
        const fileMetadata = await getFileMetadata(session.access_token, fileId);
        
        return NextResponse.json({
          success: true,
          media: {
            ...mediaItem,
            updatedMetadata: fileMetadata
          }
        });
      } catch (error: any) {
        console.error('Error fetching file metadata:', error);
        return NextResponse.json(
          { error: 'Failed to fetch file metadata from Google Drive' }, 
          { status: 500 }
        );
      }
    }
    
    // Case 2: Get all files of a specific type
    else if (mediaType) {
      // Validate mediaType
      if (!['image', 'audio', 'video', 'document', 'all'].includes(mediaType)) {
        return NextResponse.json(
          { error: 'Invalid media type' }, 
          { status: 400 }
        );
      }
      
      // Return all media of the specified type
      if (mediaType === 'all') {
        return NextResponse.json({
          success: true,
          media: journal.media || { image: [], audio: [], video: [], document: [] }
        });
      } else {
        return NextResponse.json({
          success: true,
          media: journal.media?.[(mediaType as 'image' | 'audio' | 'video' | 'document')] || []
        });
      }
    }
    
    // Case 3: Get all media for the journal
    else {
      return NextResponse.json({
        success: true,
        media: journal.media || { image: [], audio: [], video: [], document: [] }
      });
    }
    
  } catch (error: any) {
    console.error('Media retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' }, 
      { status: 500 }
    );
  }
}