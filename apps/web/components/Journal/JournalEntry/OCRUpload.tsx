"use client"
import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, RefreshCw, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
// ReactMarkdown removed; displaying plain text instead

interface OCRUploadProps {
  onTextExtracted: (text: string) => void;
  onClose: () => void;
}

interface OCRImage {
  content_type: string;
  content: string;
}

interface OCRPage {
  markdown: string;
  images?: OCRImage[];
}

interface OCRResponse {
  pages?: OCRPage[];
  text?: string;
  content?: string;
}

const OCRUpload: React.FC<OCRUploadProps> = ({ onTextExtracted, onClose }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [showFullText, setShowFullText] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process API response to combine markdown text with base64 images
  const processApiResponse = (data: OCRResponse) => {
    let combinedMarkdown = "";
    if (data.pages && Array.isArray(data.pages)) {
      data.pages.forEach((page: OCRPage, pageIndex: number) => {
        let pageMarkdown = page.markdown;

        if (page.images && Array.isArray(page.images) && page.images.length > 0) {
          // Replace image placeholders with actual base64 data URIs
          pageMarkdown = pageMarkdown.replace(/!\[(img-\d+\.\w+)\]\(\1\)/g, (match: string, imageName: string) => {
            const imageIndexMatch = imageName.match(/img-(\d+)/);
            if (!imageIndexMatch || !imageIndexMatch[1]) return match;

            const imageIndex = parseInt(imageIndexMatch[1], 10);

            if (page.images && page.images[imageIndex]) {
              const imageData = page.images[imageIndex];
              if (imageData.content_type && imageData.content) {
                const imageSrc = `data:${imageData.content_type};base64,${imageData.content}`;
                return `![${imageName}](${imageSrc})`;
              }
            }
            return match;
          });
        }

        combinedMarkdown += pageMarkdown;

        if (data.pages && pageIndex < data.pages.length - 1) {
          combinedMarkdown += "\n\n---\n\n"; // Page separator
        }
      });
    } else {
      // If no pages array, try to extract text directly
      if (data.text) {
        combinedMarkdown = data.text;
      } else if (data.content) {
        combinedMarkdown = data.content;
      } else {
        combinedMarkdown = "No content found in the response";
      }
    }
    return combinedMarkdown;
  };

  // Convert markdown text to plain text
  const markdownToPlainText = (markdown: string): string => {
    if (!markdown) return '';
    let text = markdown;
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Inline code
    text = text.replace(/`([^`]*)`/g, '$1');
    // Images ![alt](url) -> alt
    text = text.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // Links [text](url) -> text
    text = text.replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1');
    // Headings #### Title -> Title
    text = text.replace(/^#{1,6}\s*/gm, '');
    // Bold/italic markers **text**, __text__, *text*, _text_
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    // Blockquotes
    text = text.replace(/^>\s?/gm, '');
    // HR
    text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '');
    // Lists markers
    text = text.replace(/^\s*([\*\-\+]\s+)/gm, '• ');
    text = text.replace(/^\s*(\d+)\.\s+/gm, '$1. ');
    // Tables pipes
    text = text.replace(/^\|?\s*(.*?)\s*\|?$/gm, '$1');
    // Collapse multiple blank lines
    text = text.replace(/\n{3,}/g, '\n\n');
    // Trim
    return text.trim();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check total count
    if (files.length + selectedFiles.length > 10) {
      setError('Maximum 10 files allowed. Please remove some files before adding more.');
      return;
    }

    setFiles(prev => [...prev, ...selectedFiles]);
    setExtractedText('');
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processDocument = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setExtractedText('');
    setError('');
    setProcessingProgress('Preparing files...');

    try {
      // Step 1: Get presigned URLs for all files
      const fileMetadata = files.map(file => ({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      }));

      setProcessingProgress('Getting upload URLs...');
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

      // Step 2: Upload files directly to Supabase Storage
      setProcessingProgress('Uploading files...');
      const uploadPromises = uploads.map(async (upload: any, index: number) => {
        const file = files[index];

        // Guard against unexpected missing file (prevents "possibly undefined" errors)
        if (!file) {
          throw new Error(`No file found for upload index ${index}`);
        }
        
        const uploadResponse = await fetch(upload.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            // Provide a safe fallback for Content-Type
            'Content-Type': file.type || 'application/octet-stream',
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return {
          filePath: upload.filePath,
          fileName: upload.fileName,
          mimeType: file.type || 'application/octet-stream'
        };
      });

      const uploadedFileData = await Promise.all(uploadPromises);

      // Step 3: Process OCR from uploaded files
      setProcessingProgress(`Processing ${files.length} file(s)...`);
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
      
      // Use combined text from batch processing
      const combinedText = data.combinedText || '';
      const plainText = markdownToPlainText(combinedText);
      setExtractedText(plainText);
      setProcessingProgress('Complete!');

      // Show summary if some files failed
      if (data.failedFiles > 0) {
        setError(`Note: ${data.failedFiles} of ${data.totalFiles} file(s) failed to process.`);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      
      let errorMessage = 'Error processing document. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('fetch failed')) {
          errorMessage = 'Network error: Unable to connect to OCR service. Please check your internet connection and try again.';
        } else if (err.message.includes('Network error')) {
          errorMessage = err.message;
        } else if (err.message.includes('OCR processing failed')) {
          errorMessage = err.message;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseText = () => {
    if (extractedText) {
      onTextExtracted(extractedText);
      onClose();
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setExtractedText('');
    setError('');
    setProcessingProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const buttonStyle = {
    backgroundColor: currentTheme.primary,
    color: 'white',
    border: 'none',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto`}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={`w-full max-w-2xl h-[85vh] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl flex flex-col`}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex-shrink-0`}>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Extract Text from Document
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-gray-100 ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* File Upload Area */}
            <div className="mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                handleFileUpload(e);
                e.target.value = ''; // Reset to allow selecting the same file again
              }}
              accept=".pdf,.png,.jpg,.jpeg,.avif,.heic,.heif"
              multiple
              className="hidden"
            />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                files.length > 0 
                  ? `${isDarkMode ? 'border-green-600 bg-green-900 bg-opacity-20' : 'border-green-400 bg-green-50'}`
                  : `${isDarkMode 
                      ? 'border-gray-600 hover:border-gray-400 hover:bg-gray-700' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`
              }`}
            >
              {files.length > 0 ? (
                <div className="flex flex-col items-center">
                  <Check className={`h-12 w-12 ${isDarkMode ? 'text-green-400' : 'text-green-500'} mb-2`} />
                  <p className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} font-medium`}>{files.length} document(s) uploaded</p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Click to add more (max 10 total)</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className={`h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'} mb-2`} />
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} font-medium`}>Click to upload documents</p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Supports PDF, JPG, PNG, JPEG, AVIF, HEIC, HEIF • Multiple files allowed</p>
                </div>
              )}
            </div>
          </div>

          {/* File Info */}
          {files.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Uploaded Files ({files.length}/10)
                </span>
                <button
                  onClick={resetUpload}
                  className={`text-sm font-medium ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
                >
                  Remove All
                </button>
              </div>
              <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto`}>
                {files.map((file, index) => (
                  <div key={index} className={`flex justify-between items-center ${isDarkMode ? 'bg-gray-600' : 'bg-white'} rounded p-2`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} truncate`}>
                        {file.name}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className={`ml-2 px-2 py-1 text-xs rounded ${isDarkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {files.length > 0 && (
            <div className="mb-6">
              <button
                onClick={processDocument}
                disabled={isProcessing}
                className={`flex items-center justify-center px-4 py-2 rounded-md text-white font-medium w-full ${
                  isProcessing ? 'bg-gray-400 cursor-not-allowed' : ''
                }`}
                style={isProcessing ? undefined : buttonStyle}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {processingProgress || 'Processing Documents...'}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Text from {files.length} Document{files.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6">
              <div className={`${isDarkMode ? 'bg-red-900 bg-opacity-50 border-red-700' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
                <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Extracted Text Display */}
          {extractedText && (
            <div className="mb-6">
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} mb-2`}>Extracted Text</h3>
              <div className={`${
                isDarkMode 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
              } border rounded-lg p-4 max-h-64 overflow-y-auto`}>
                <div className={`max-w-none text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  <pre className="whitespace-pre-wrap break-words">
                    {showFullText ? extractedText : extractedText.split('\n').slice(0, 20).join('\n') + (extractedText.split('\n').length > 20 ? '\n\n...' : '')}
                  </pre>
                </div>
              </div>
              {extractedText.split('\n').length > 20 && (
                <button
                  onClick={() => setShowFullText(!showFullText)}
                  className={`mt-2 text-sm px-3 py-1 rounded ${
                    isDarkMode 
                      ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {showFullText ? 'Show Less' : 'Show More'}
                </button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Sticky Footer for Action Buttons */}
        {extractedText && (
          <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} flex-shrink-0`}>
            <div className="flex gap-4">
              <button
                onClick={handleUseText}
                className="px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                style={buttonStyle}
              >
                Use This Text
              </button>
              <button
                onClick={resetUpload}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default OCRUpload;
