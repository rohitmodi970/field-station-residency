"use client"

import React from 'react';
import { Image, Music, Video, FileText, Download, Trash2, ExternalLink } from 'lucide-react';
import { JournalMedia, MediaType } from '@/types/database';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface MediaGalleryProps {
  media: JournalMedia[];
  onDelete?: (mediaId: string) => Promise<void>;
  readOnly?: boolean;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ 
  media, 
  onDelete,
  readOnly = false 
}) => {
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
    }
  };

  const getMediaColor = (type: MediaType) => {
    switch (type) {
      case 'image': return 'text-blue-500';
      case 'audio': return 'text-purple-500';
      case 'video': return 'text-red-500';
      case 'document': return 'text-green-500';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDeleteRequest = (mediaId: string) => {
    if (!onDelete || deleting) return;
    setDeleteTargetId(mediaId);
    setDeleteError(null);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete || deleting || !deleteTargetId) return;

    try {
      setDeleting(deleteTargetId);
      setDeleteError(null);
      await onDelete(deleteTargetId);
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Error deleting media:', error);
      setDeleteError('Failed to delete media');
    } finally {
      setDeleting(null);
    }
  };

  const openMedia = (url: string | null) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (media.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No media files attached</p>
      </div>
    );
  }

  // Group media by type
  const groupedMedia = media.reduce((acc, item) => {
    if (!acc[item.media_type]) {
      acc[item.media_type] = [];
    }
    acc[item.media_type].push(item);
    return acc;
  }, {} as Record<MediaType, JournalMedia[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedMedia).map(([type, items]) => (
        <div key={type} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground capitalize">
            {getMediaIcon(type as MediaType)}
            <span>{type}s ({items.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all"
              >
                {/* Preview for images */}
                {item.media_type === 'image' && item.public_url && (
                  <div className="aspect-video w-full bg-secondary rounded-md overflow-hidden mb-3">
                    <img
                      src={item.thumbnail_url || item.public_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Media info */}
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 ${getMediaColor(item.media_type)}`}>
                    {getMediaIcon(item.media_type)}
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.file_name}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Size: {formatFileSize(item.file_size)}</p>
                    <p>Type: {item.mime_type}</p>
                    {item.storage_provider && (
                      <p className="capitalize">Storage: {item.storage_provider}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {item.public_url && (
                      <button
                        onClick={() => openMedia(item.public_url)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Open"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                    )}

                    {!readOnly && onDelete && (
                      <button
                        onClick={() => handleDeleteRequest(item.id)}
                        disabled={deleting === item.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === item.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
        <span>Total: {media.length} file{media.length !== 1 ? 's' : ''}</span>
        <span>
          Size: {formatFileSize(media.reduce((sum, m) => sum + (m.file_size || 0), 0))}
        </span>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setDeleteTargetId(null);
            setDeleteError(null);
          }
        }}
        title="Delete this file?"
        description="This media file will be permanently removed from the entry."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting..."
        onConfirm={handleDeleteConfirm}
        loading={Boolean(deleteTargetId && deleting === deleteTargetId)}
        error={deleteError}
        confirmTone="danger"
      />
    </div>
  );
};

export default MediaGallery;
