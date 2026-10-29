"use client"
import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, RefreshCw, X, Loader } from 'lucide-react';

interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

interface OcrResult {
  fileName: string;
  text: string;
  success: boolean;
  error?: string;
}

const OcrComponent = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [results, setResults] = useState<OcrResult[]>([]);
  const [combinedText, setCombinedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Check total count
    if (uploadedFiles.length + newFiles.length > 10) {
      alert('Maximum 10 files allowed. Please remove some files before adding more.');
      return;
    }

    // Create preview URLs for new files
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFiles(prev => [...prev, {
          file,
          preview: event.target?.result as string,
          id: `${Date.now()}-${Math.random()}`
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const recognizeText = async () => {
    if (uploadedFiles.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setCombinedText('');
    setProgress('Preparing files...');

    try {
      // Step 1: Get presigned URLs for all files
      const fileMetadata = uploadedFiles.map(({ file }) => ({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      }));

      setProgress('Getting upload URLs...');
      const presignedResponse = await fetch('/api/ocr/presigned-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileMetadata })
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URLs');
      }

      const { uploads } = await presignedResponse.json();

      // Step 2: Upload files directly to Supabase Storage using presigned URLs
      setProgress('Uploading files...');
      const uploadPromises = uploads.map(async (upload: any, index: number) => {
        const file = uploadedFiles[index]?.file;
        if (!file) {
          throw new Error(`File at index ${index} is missing or was removed before upload.`);
        }
        
        const uploadResponse = await fetch(upload.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return {
          filePath: upload.filePath,
          fileName: upload.fileName,
          mimeType: file.type
        };
      });

      const uploadedFileData = await Promise.all(uploadPromises);

      // Step 3: Process OCR from uploaded files
      setProgress(`Processing ${uploadedFiles.length} file(s)...`);
      const processResponse = await fetch('/api/ocr/process-from-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadedFileData })
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'OCR processing failed');
      }

      const data = await processResponse.json();
      
      setProgress('Complete!');
      
      // Set results
      const ocrResults: OcrResult[] = data.individualResults.map((r: any) => ({
        fileName: r.fileName,
        text: r.text || 'No text extracted',
        success: r.success,
        error: r.error
      }));

      setResults(ocrResults);
      setCombinedText(data.combinedText || '');

      // Show summary
      if (data.failedFiles > 0) {
        alert(`OCR Complete!\nSuccessful: ${data.successfulFiles}\nFailed: ${data.failedFiles}`);
      }
    } catch (error) {
      console.error('OCR Error:', error);
      alert(error instanceof Error ? error.message : 'Error processing images. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const resetComponent = () => {
    setUploadedFiles([]);
    setResults([]);
    setCombinedText('');
    setProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-indigo-600 px-6 py-4">
        <h2 className="text-2xl font-bold text-white">Multi-Image OCR Converter</h2>
        <p className="text-indigo-100">Extract text from multiple images using Mistral OCR (max 10 files)</p>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*,application/pdf"
            multiple
            className="hidden"
          />
          
          <div 
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              uploadedFiles.length > 0 ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
            }`}
          >
            {uploadedFiles.length > 0 ? (
              <div className="flex flex-col items-center">
                <Check className="h-12 w-12 text-green-500 mb-2" />
                <p className="text-green-600 font-medium">{uploadedFiles.length} file(s) uploaded</p>
                <p className="text-sm text-gray-500 mt-1">Click to add more images (max 10 total)</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium">Click to upload images</p>
                <p className="text-sm text-gray-500 mt-1">Supports JPG, PNG, GIF, PDF • Multiple files allowed</p>
              </div>
            )}
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <>
            <div className="mb-6">
              <div className="flex justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Uploaded Files ({uploadedFiles.length}/10)</span>
                <button
                  onClick={resetComponent}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  Remove All
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {uploadedFiles.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="w-full h-32 object-cover rounded"
                      />
                      <p className="text-xs text-gray-600 mt-1 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(item.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={recognizeText}
                disabled={isProcessing}
                className={`flex items-center justify-center px-6 py-3 rounded-md text-white font-medium flex-1 ${
                  isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader className="h-5 w-5 mr-2 animate-spin" />
                    {progress}
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-2" />
                    Extract Text from All Images
                  </>
                )}
              </button>
            </div>

            {results.length > 0 && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Combined Text (All Files)</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700">{combinedText || 'No text extracted'}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Individual Results</h3>
                  <div className="space-y-4">
                    {results.map((result, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-800">{result.fileName}</h4>
                          {result.success ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <X className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        {result.success ? (
                          <div className="bg-white border border-gray-200 rounded p-3">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">{result.text || 'No text found'}</pre>
                          </div>
                        ) : (
                          <p className="text-red-600 text-sm">{result.error || 'Processing failed'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OcrComponent;