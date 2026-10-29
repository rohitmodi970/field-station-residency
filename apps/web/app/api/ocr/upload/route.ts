import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate file count (max 10 files)
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed per request' },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of files) {
      // Validate file size (50MB limit per file)
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 50 MB limit` },
          { status: 413 }
        );
      }

      // Validate file type (support images and PDFs)
      if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
        return NextResponse.json(
          { error: `Unsupported file type for "${file.name}". Please upload an image (JPEG, PNG, etc.) or PDF file.` },
          { status: 400 }
        );
      }
    }

    // Check if Mistral API key is available
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      return NextResponse.json(
        { error: 'Mistral API key not configured' },
        { status: 503 }
      );
    }

    try {
      // Process all files in parallel
      const results = await Promise.all(
        files.map(async (file, index) => {
          try {
            console.log(`Processing file ${index + 1}/${files.length}: ${file.name}`);
            
            // Convert file to base64
            const arrayBuffer = await file.arrayBuffer();
            const base64Content = Buffer.from(arrayBuffer).toString('base64');
            const dataUri = `data:${file.type};base64,${base64Content}`;

            // Create document structure based on file type
            let document;
            if (file.type.startsWith('image/')) {
              document = {
                type: "image_url",
                image_url: dataUri
              };
            } else if (file.type === 'application/pdf') {
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
              console.error(`Mistral API error for ${file.name}:`, errorData);
              throw new Error(`Mistral API error: ${mistralResponse.status}`);
            }

            const ocrResult = await mistralResponse.json();
            console.log(`OCR completed for ${file.name}. Response structure:`, JSON.stringify(ocrResult, null, 2));
            
            return {
              fileName: file.name,
              fileIndex: index,
              success: true,
              data: ocrResult,
              error: null
            };
          } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            return {
              fileName: file.name,
              fileIndex: index,
              success: false,
              data: null,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      // Aggregate results
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Extract text from OCR results - try multiple possible response formats
      const extractText = (data: any) => {
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
        if (typeof data === 'string') {
          return data;
        }
        // If we can't find text, log the structure
        console.warn('Unknown OCR response structure:', JSON.stringify(data, null, 2));
        return '';
      };

      // Combine all extracted text in original file selection order
      const combinedText = successful
        .sort((a, b) => a.fileIndex - b.fileIndex)
        .map(r => {
          const text = extractText(r.data);
          return text ? `=== ${r.fileName} ===\n${text}` : '';
        })
        .filter(t => t)
        .join('\n\n');

      console.log(`OCR batch complete: ${successful.length} succeeded, ${failed.length} failed`);
      console.log(`Combined text length: ${combinedText.length} characters`);

      return NextResponse.json({
        success: true,
        totalFiles: files.length,
        successCount: successful.length,
        failedCount: failed.length,
        results: results,
        combinedText: combinedText,
        individualResults: successful.map(r => ({
          fileName: r.fileName,
          text: extractText(r.data)
        }))
      });

    } catch (error) {
      console.error('OCR processing error:', error);
      
      // Handle different types of errors
      let errorMessage = 'Unknown error';
      let statusCode = 500;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout: OCR processing took too long. Please try with a smaller file or try again later.';
          statusCode = 408;
        } else if (error.message.includes('fetch failed')) {
          errorMessage = 'Network error: Unable to connect to OCR service. Please check your internet connection and try again.';
          statusCode = 503;
        } else if (error.message.includes('Mistral API error')) {
          errorMessage = error.message;
          statusCode = 502;
        } else {
          errorMessage = `OCR processing failed: ${error.message}`;
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
