"use client"

import React from 'react';
import { Image, Music, Video, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { MediaUploadProgress as MediaUploadProgressType } from '@/types/database';

interface MediaUploadProgressProps {
  uploads: MediaUploadProgressType[];
  onRemove?: (fileIndex: number) => void;
}

const MediaUploadProgress: React.FC<MediaUploadProgressProps> = ({ uploads, onRemove }) => {
  const getMediaIcon = (fileName: string, status: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-5 h-5" />;
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) {
      return <Music className="w-5 h-5" />;
    }
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
      return <Video className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const getStatusIcon = (status: 'uploading' | 'completed' | 'failed') => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (uploads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Uploading Files ({uploads.filter(u => u.status !== 'failed').length}/{uploads.length})
      </h3>
      
      <div className="space-y-2">
        {uploads.map((upload, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-muted-foreground shrink-0">
                  {getMediaIcon(upload.file.name, upload.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(upload.file.size)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusIcon(upload.status)}
                  
                  {upload.status === 'uploading' && (
                    <span className="text-xs font-medium text-blue-500">
                      {upload.progress}%
                    </span>
                  )}
                  
                  {upload.status === 'completed' && (
                    <span className="text-xs font-medium text-green-500">
                      Done
                    </span>
                  )}
                  
                  {upload.status === 'failed' && (
                    <span className="text-xs font-medium text-red-500">
                      Failed
                    </span>
                  )}

                  {onRemove && upload.status !== 'uploading' && (
                    <button
                      onClick={() => onRemove(index)}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                      title="Remove"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {upload.status === 'uploading' && (
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}

            {/* Error message */}
            {upload.status === 'failed' && upload.error && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded">
                {upload.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span>
          {uploads.filter(u => u.status === 'completed').length} completed, 
          {' '}{uploads.filter(u => u.status === 'uploading').length} uploading
          {uploads.filter(u => u.status === 'failed').length > 0 && 
            `, ${uploads.filter(u => u.status === 'failed').length} failed`
          }
        </span>
      </div>
    </div>
  );
};

export default MediaUploadProgress;
