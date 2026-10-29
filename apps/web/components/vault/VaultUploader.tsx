
'use client';

import { useState, useEffect } from 'react';
import { Upload, X, File, Image, Music, Video, FileText, AlertCircle } from 'lucide-react';
import StorageQuotaBar from './StorageQuotaBar';

interface VaultUploaderProps {
  onUploadSuccess?: (media: any) => void;
}

export default function VaultUploader({ onUploadSuccess }: VaultUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const folder = 'mydrive'; // Only mydrive uploads allowed
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size exceeds 50MB limit');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setQuotaError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setQuotaError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', 'mydrive'); // Only mydrive uploads allowed

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/vault', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const result = await response.json();

      if (!response.ok) {
        // Handle quota exceeded error specifically
        if (response.status === 413) {
          setQuotaError(result.details || {});
          throw new Error('Storage quota exceeded. Please delete some files to free up space.');
        }
        throw new Error(result.error || 'Upload failed');
      }

      console.log('✅ Upload successful:', result.data);
      
      if (onUploadSuccess) {
        onUploadSuccess(result.data);
      }

      // Reset form
      setSelectedFile(null);
      setProgress(0);
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('❌ Upload error:', err);
      setError(err.message || 'Upload failed');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="w-6 h-6" />;
    
    const type = selectedFile.type;
    if (type.startsWith('image/')) return <Image className="w-6 h-6" />;
    if (type.startsWith('audio/')) return <Music className="w-6 h-6" />;
    if (type.startsWith('video/')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Storage Quota Bar */}
      <StorageQuotaBar />

      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Upload to My Drive</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload files to your personal vault. Journal and onboarding files are automatically organized.
        </p>

        {/* File Input */}
        <div className="mb-6">
          <label
            htmlFor="file-input"
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {getFileIcon()}
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                Images, Videos, Audio, Documents (Max 50MB per file)
              </p>
            </div>
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />
          </label>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getFileIcon()}
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {uploading && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Uploading... {progress}%
            </p>
          </div>
        )}

        {/* Quota Error Message */}
        {quotaError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 mb-1">Storage Quota Exceeded</p>
                <p className="text-red-700 text-sm mb-2">{error}</p>
                {quotaError.used_mb && (
                  <div className="text-xs text-red-600 space-y-1">
                    <p>• Current usage: {quotaError.used_mb} MB</p>
                    <p>• Storage limit: {quotaError.limit_mb} MB</p>
                    <p>• File size: {quotaError.file_size_mb} MB</p>
                    <p>• Would be: {quotaError.would_be_mb} MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* General Error Message */}
        {error && !quotaError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={`w-full py-3 px-6 rounded-lg font-medium transition ${
            !selectedFile || uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {uploading ? 'Uploading...' : 'Upload to Vault'}
        </button>
      </div>
    </div>
  );
}
