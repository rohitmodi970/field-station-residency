import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { BUCKETS, getMimeType } from '@/utils/supabase/storage';

function normalizeMimeType(fileName: string, mimeType?: string): string {
  const raw = (mimeType || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream') {
    return raw;
  }
  return getMimeType(fileName).toLowerCase();
}

/**
 * POST /api/ocr/process-from-storage
 * 
 * Process OCR for files already uploaded to Supabase Storage
 * This is the second step after client-side upload via presigned URLs
 * 
 * Request body:
 * {
 *   files: Array<{
 *     filePath: string,
 *     fileName: string,
 *     mimeType: string
 *   }>
 * }
 * 
 * Returns:
 * {
 *   combinedText: string,
 *   individualResults: Array<{
 *     fileName: string,
 *     text: string,
 *     success: boolean,
 *     error?: string
 *   }>
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { files } = body;

    // Validate inputs
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'files array is required' },
        { status: 400 }
      );
    }

    // Check if Mistral API key is available
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      return NextResponse.json(
        { error: 'Mistral API key not configured' },
        { status: 503 }
      );
    }

    // Use admin client to access storage
    const adminClient = createAdminClient();

    // Process all files in parallel
    const results = await Promise.all(
      files.map(async (file, index) => {
        try {
          console.log(`Processing OCR for file ${index + 1}/${files.length}: ${file.fileName}`);
          
          // Get signed URL to download the file using admin client
          const { data: urlData, error: urlError } = await adminClient.storage
            .from(BUCKETS.USERS_CLOUD)
            .createSignedUrl(file.filePath, 600); // 10 minutes

          if (urlError || !urlData) {
            console.error(`Error getting signed URL for ${file.fileName}:`, urlError);
            throw new Error(`Failed to get file URL: ${urlError?.message}`);
          }

          // Download file from storage
          const fileResponse = await fetch(urlData.signedUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.statusText}`);
          }

          // Convert to base64
          const arrayBuffer = await fileResponse.arrayBuffer();
          const base64Content = Buffer.from(arrayBuffer).toString('base64');
          const normalizedMimeType = normalizeMimeType(file.fileName, file.mimeType);
          const dataUri = `data:${normalizedMimeType};base64,${base64Content}`;

          // Create document structure based on file type
          let document;
          if (normalizedMimeType.startsWith('image/')) {
            document = {
              type: "image_url",
              image_url: dataUri
            };
          } else if (normalizedMimeType === 'application/pdf') {
            document = {
              type: "document_url",
              document_url: dataUri
            };
          } else {
            document = {
              type: "document_url",
              document_url: dataUri
            };
          }

          // Call Mistral OCR API
          const requestBody = {
            model: "mistral-ocr-latest",
            document: document
          };
          
          // Create AbortController for timeout (90 seconds per file)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000);
          
          const mistralResponse = await fetch('https://api.mistral.ai/v1/ocr', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mistralApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!mistralResponse.ok) {
            const errorData = await mistralResponse.json().catch(() => ({}));
            console.error(`Mistral API error for ${file.fileName}:`, errorData);
            throw new Error(`Mistral API error: ${mistralResponse.status}`);
          }

          const ocrResult = await mistralResponse.json();
          console.log(`OCR completed for ${file.fileName}`);
          
          // Extract text from OCR result
          const extractedText = extractText(ocrResult);
          
          return {
            fileName: file.fileName,
            fileIndex: index,
            success: true,
            text: extractedText,
            error: null
          };
        } catch (error) {
          console.error(`Error processing OCR for ${file.fileName}:`, error);
          return {
            fileName: file.fileName,
            fileIndex: index,
            success: false,
            text: '',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Combine all successful texts in original file selection order
    const successfulResults = results
      .filter(r => r.success)
      .sort((a, b) => a.fileIndex - b.fileIndex);
    const combinedText = successfulResults
      .map(r => `=== ${r.fileName} ===\n${r.text}`)
      .join('\n\n');

    return NextResponse.json({
      success: true,
      combinedText,
      individualResults: results,
      totalFiles: files.length,
      successfulFiles: successfulResults.length,
      failedFiles: results.length - successfulResults.length
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process OCR'
      },
      { status: 500 }
    );
  }
}

// Helper function to extract text from various OCR response formats
function extractText(data: any): string {
  // Try different possible response structures
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data?.pages && Array.isArray(data.pages)) {
    return data.pages.map((p: any) => p.markdown || p.text || '').join('\n\n');
  }
  if (data?.text) {
    return data.text;
  }
  if (data?.content) {
    return data.content;
  }
  
  // Fallback: stringify the entire response
  return JSON.stringify(data, null, 2);
}
