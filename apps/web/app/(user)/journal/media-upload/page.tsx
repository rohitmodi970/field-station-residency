"use client";

import React, { useState, useEffect } from 'react';
import { encryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { useRouter } from 'next/navigation';
import Layout from "@/components/layout/Layout";
import { createClient } from '@/utils/supabase/client';
import { Upload, Image, Music, Video, FileText, X, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'audio' | 'video' | 'document';
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  url?: string;
}

const MEDIA_LIMITS = {
  image: { count: 6, size: 25 * 1024 * 1024 }, // 25MB
  audio: { count: 11, size: 5 * 1024 * 1024 }, // 5MB
  video: { count: 2, size: 200 * 1024 * 1024 }, // 200MB
  document: { count: 5, size: 5 * 1024 * 1024 }, // 5MB
};

const MediaUploadPage = () => {
  const router = useRouter();
  const { elementColors, isDarkMode } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [journalId, setJournalId] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, [router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'video' | 'document') => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: MediaFile[] = Array.from(files).map(file => ({
      id: uuidv4(),
      file,
      type,
      progress: 0,
      status: 'idle' as const,
    }));

    setMediaFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setMediaFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0 || isUploading) return;

    setIsUploading(true);

    try {
      // Create a new journal entry for media-only upload
      const newJournalId = uuidv4();
      // Encrypt empty title/content for compliance
      if (!user || !user.id) throw new Error('User not authenticated');
      const encrypted = await encryptJournalEntry({
        title: 'Media Only',
        content: 'Media Only',
        journal_type: 'media_only',
        mood: null,
        tags: [],
        location: null,
        weather: null,
        date: new Date().toISOString().split('T')[0] ?? '',
        is_favorite: false,
        is_archived: false,
      }, user.id);

      const journalResponse = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journal_id: newJournalId,
          journal_type: 'media_only',
          tags: [],
          mood: null,
          date: encrypted.date,
          is_favorite: encrypted.is_favorite,
          is_archived: encrypted.is_archived,
          is_encrypted: true,
          title_encrypted: encrypted.title_encrypted,
          title_iv: encrypted.title_iv,
          content_encrypted: encrypted.content_encrypted,
          content_iv: encrypted.content_iv,
          word_count: 0,
        }),
      });

      if (!journalResponse.ok) {
        const error = await journalResponse.json();
        throw new Error(error.error || 'Failed to create journal');
      }

      const journalResult = await journalResponse.json();
      const backendJournalId = journalResult.journal.journal_id;
      setJournalId(backendJournalId);

      // Upload files
      const uploadPromises = mediaFiles
        .filter((media) => media.status === 'idle')
        .map(async (media) => {
          try {
            // Update status to uploading
            setMediaFiles((prev) =>
              prev.map((m) =>
                m.id === media.id ? { ...m, status: 'uploading' as const } : m
              )
            );

            const formData = new FormData();
            formData.append('file', media.file);
            formData.append('journal_id', backendJournalId);
            formData.append('media_type', media.type);

            const uploadResponse = await axios.post<{
              message: string;
              media: {
                id: string;
                bucket?: string;
                path?: string;
                public_url?: string;
                signed_url?: string;
              };
            }>('/api/journals/media', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              // @ts-ignore - onUploadProgress type issue
              onUploadProgress: (progressEvent: any) => {
                if (progressEvent.total && progressEvent.loaded) {
                  const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                  setMediaFiles((prev) =>
                    prev.map((m) =>
                      m.id === media.id ? { ...m, progress: percentCompleted } : m
                    )
                  );
                }
              },
            });

            const response = uploadResponse.data.media;

            // Update status to success
            setMediaFiles((prev) =>
              prev.map((m) =>
                m.id === media.id
                  ? {
                      ...m,
                      status: 'success' as const,
                      progress: 100,
                      url: response.signed_url || response.public_url,
                    }
                  : m
              )
            );

            return true;
          } catch (error: any) {
            console.error('Upload error:', error);
            setMediaFiles((prev) =>
              prev.map((m) =>
                m.id === media.id
                  ? {
                      ...m,
                      status: 'error' as const,
                      errorMessage: error.response?.data?.error || error.message || 'Upload failed',
                    }
                  : m
              )
            );
            return false;
          }
        });

      await Promise.all(uploadPromises);
      
      setIsUploading(false);

      // Redirect to journal detail page after successful upload
      if (backendJournalId) {
        setTimeout(() => {
          router.push(`/journal/${backendJournalId}`);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error creating journal:', error);
      alert(`Failed to create journal: ${error.message}`);
      setIsUploading(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading': return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default: return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/journal"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-500 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Journals
          </Link>
          <h1 className="text-3xl font-bold mb-2" style={{ color: elementColors.text }}>
            Upload Media
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Upload images, audio, videos, and documents to create a media collection
          </p>
        </div>

        {/* Upload Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div>
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e, 'image')}
              className="hidden"
            />
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-amber-500 transition-colors"
            >
              <Image className="w-8 h-8 mb-2 text-amber-600" />
              <span className="text-sm font-medium">Images</span>
              <span className="text-xs text-gray-500">Up to {MEDIA_LIMITS.image.count}</span>
            </label>
          </div>

          <div>
            <input
              type="file"
              id="audio-upload"
              accept="audio/*"
              multiple
              onChange={(e) => handleFileSelect(e, 'audio')}
              className="hidden"
            />
            <label
              htmlFor="audio-upload"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-green-500 transition-colors"
            >
              <Music className="w-8 h-8 mb-2 text-green-600" />
              <span className="text-sm font-medium">Audio</span>
              <span className="text-xs text-gray-500">Up to {MEDIA_LIMITS.audio.count}</span>
            </label>
          </div>

          <div>
            <input
              type="file"
              id="video-upload"
              accept="video/*"
              multiple
              onChange={(e) => handleFileSelect(e, 'video')}
              className="hidden"
            />
            <label
              htmlFor="video-upload"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition-colors"
            >
              <Video className="w-8 h-8 mb-2 text-purple-600" />
              <span className="text-sm font-medium">Videos</span>
              <span className="text-xs text-gray-500">Up to {MEDIA_LIMITS.video.count}</span>
            </label>
          </div>

          <div>
            <input
              type="file"
              id="document-upload"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              onChange={(e) => handleFileSelect(e, 'document')}
              className="hidden"
            />
            <label
              htmlFor="document-upload"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
            >
              <FileText className="w-8 h-8 mb-2 text-blue-600" />
              <span className="text-sm font-medium">Documents</span>
              <span className="text-xs text-gray-500">Up to {MEDIA_LIMITS.document.count}</span>
            </label>
          </div>
        </div>

        {/* File List */}
        {mediaFiles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4" style={{ color: elementColors.text }}>
              Selected Files ({mediaFiles.length})
            </h2>
            <div className="space-y-2">
              {mediaFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-shrink-0">
                    {getMediaIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: elementColors.text }}>
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)} • {file.type}
                    </p>
                    {file.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {file.status === 'error' && file.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{file.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {getStatusIcon(file.status)}
                    {file.status !== 'uploading' && (
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {mediaFiles.length > 0 && (
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setMediaFiles([])}
              disabled={isUploading}
              className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || mediaFiles.every(f => f.status === 'success')}
              className="px-6 py-3 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ backgroundColor: elementColors.button }}
            >
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Files
                </>
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {mediaFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium mb-2" style={{ color: elementColors.text }}>
              No Files Selected
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Choose files from the categories above to get started
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MediaUploadPage;
