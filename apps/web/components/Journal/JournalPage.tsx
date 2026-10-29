"use client"
import { format } from "date-fns";
import { JournalEntry } from "./types";
import { Play, FileText, Edit, Trash2, Upload, X, Image as ImageIcon, Maximize2, ExternalLink, Share2, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button2";
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { BUCKETS, USERS_CLOUD_PATHS } from "@/utils/supabase/storage";
import Stack from "./Stack";

interface JournalPageProps {
  entry: JournalEntry;
  isEven: boolean;
  backgroundClass?: string;
  backgroundStyle?: React.CSSProperties;
  onEntryUpdated?: () => void;
}

const JournalPage = ({ entry, isEven, backgroundClass, backgroundStyle, onEntryUpdated }: JournalPageProps) => {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMediaDeleteConfirm, setShowMediaDeleteConfirm] = useState(false);
  const [mediaDeleteTarget, setMediaDeleteTarget] = useState<{ url: string; type: string } | null>(null);
  const [mediaDeleteLoading, setMediaDeleteLoading] = useState(false);
  const [mediaDeleteError, setMediaDeleteError] = useState<string | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [showZoomView, setShowZoomView] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMMM d, yyyy");
    } catch (error) {
      return dateString;
    }
  };

  const handleEditEntry = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    router.push(`/journal/${entry.journalId}`);
  };

  const handleViewFullEntry = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    router.push(`/journal/${entry.journalId}`);
  };

  const handleCopyShareUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.publishedShareId) {
      const shareUrl = `${window.location.origin}/shared/${entry.publishedShareId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleDeleteEntry = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/journals/${entry.journalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      // Notify parent to refresh entries
      if (onEntryUpdated) {
        onEntryUpdated();
      }
      
      // Optionally navigate away or show success message
      alert('Journal entry deleted successfully');
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleMediaUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    try {
      setUploadingMedia(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const uploadedMedia = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file) continue;
        
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${USERS_CLOUD_PATHS.JOURNAL}/${user.id}/${entry.journalId}/${timestamp}_${sanitizedFileName}`;
        
        // Determine media type
        let mediaType: 'image' | 'audio' | 'video' | 'document' = 'document';
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';
        else if (file.type.startsWith('video/')) mediaType = 'video';

        // Upload to Supabase storage using users_cloud bucket
        const { data, error } = await supabase.storage
          .from(BUCKETS.USERS_CLOUD)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(BUCKETS.USERS_CLOUD)
          .getPublicUrl(storagePath);

        // Save media reference to database
        const { error: dbError } = await supabase
          .from('journal_media')
          .insert({
            journal_id: entry.id, // Use UUID, not custom journal_id string
            user_id: user.id,
            media_type: mediaType,
            storage_provider: 'supabase',
            bucket: BUCKETS.USERS_CLOUD,
            path: storagePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            public_url: urlData.publicUrl,
            upload_status: 'completed',
            processed: false,
            display_order: i
          });

        if (dbError) throw dbError;

        uploadedMedia.push({
          type: mediaType,
          url: urlData.publicUrl
        });
      }

      // Notify parent to refresh entries BEFORE showing alert
      if (onEntryUpdated) {
        await onEntryUpdated();
      }
      
      alert(`Successfully uploaded ${uploadedMedia.length} file(s)`);
      setShowMediaUpload(false);
      setSelectedFiles(null);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Failed to upload media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaUrl: string, mediaType: string) => {
    try {
      setMediaDeleteLoading(true);
      setMediaDeleteError(null);
      const supabase = createClient();
      
      // Extract the storage path from the URL (handles both signed and public URLs)
      // Format: https://[project].supabase.co/storage/v1/object/[sign|public]/bucket/path?token=...
      let storagePath = '';
      try {
        const url = new URL(mediaUrl);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+)/);
        if (pathMatch && pathMatch[1]) {
          storagePath = decodeURIComponent(pathMatch[1]);
        }
      } catch (e) {
        console.error('Failed to parse media URL:', e);
      }

      if (!storagePath) {
        throw new Error('Could not extract storage path from URL');
      }

      // Find the media record by matching the storage path
      const { data: mediaRecords, error: fetchError } = await supabase
        .from('journal_media')
        .select('*')
        .eq('journal_id', entry.id) // Use UUID, not custom journal_id string
        .eq('path', storagePath);

      if (fetchError) throw fetchError;

      if (mediaRecords && mediaRecords.length > 0) {
        const mediaRecord = mediaRecords[0];

        // Delete from storage using users_cloud bucket
        const { error: storageError } = await supabase.storage
          .from(BUCKETS.USERS_CLOUD)
          .remove([mediaRecord.path]);

        if (storageError) console.error('Storage deletion error:', storageError);

        // Delete from database
        const { error: dbError } = await supabase
          .from('journal_media')
          .delete()
          .eq('id', mediaRecord.id);

        if (dbError) throw dbError;

        // Notify parent to refresh entries BEFORE showing alert
        if (onEntryUpdated) {
          await onEntryUpdated();
        }
        
        alert('Media deleted successfully');
      } else {
        throw new Error('Media record not found');
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      setMediaDeleteError('Failed to delete media. Please try again.');
    }
    finally {
      setMediaDeleteLoading(false);
      setShowMediaDeleteConfirm(false);
      setMediaDeleteTarget(null);
    }
  };

  const handleDeleteMediaRequest = (mediaUrl: string, mediaType: string) => {
    setMediaDeleteTarget({ url: mediaUrl, type: mediaType });
    setMediaDeleteError(null);
    setShowMediaDeleteConfirm(true);
  };
  
  // Safely extract a URL string from a possible media value
  const getMediaUrl = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (typeof val.url === 'string' && val.url) return val.url;
      if (typeof val.signed_url === 'string' && val.signed_url) return val.signed_url;
      if (typeof val.public_url === 'string' && val.public_url) return val.public_url;
      if (typeof val.thumbnail_url === 'string' && val.thumbnail_url) return val.thumbnail_url;
    }
    return '';
  };

  // Function to open media in a modal or new page (accepts any media shape)
  const handleOpenMedia = (url: any, type: string) => {
    const resolved = getMediaUrl(url);
    if (!resolved) return;
    window.open(resolved, '_blank');
  };

  // Default background if none provided
  const defaultBackgroundClass = isEven 
    ? 'bg-gradient-to-br from-card to-muted/30' 
    : 'bg-gradient-to-br from-muted/30 to-card';

  return (
    <div 
      className={`h-full w-full overflow-hidden ${backgroundClass || defaultBackgroundClass}`}
      style={backgroundStyle}
    >
      <div className="p-4 sm:p-8 overflow-y-auto h-full" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 border-b pb-3">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-journal text-primary mb-2 tracking-wide break-words">
                {entry.title}
              </h2>
              <div className="flex flex-col gap-1">
                <p className="text-xs md:text-sm text-muted-foreground font-journal flex flex-wrap items-center gap-2">
                  {formatDate(entry.date)}
                  {entry.mood && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />
                      <span className="text-xs">Mood: {entry.mood}</span>
                    </>
                  )}
                </p>
                
                {/* Publication Status */}
                {entry.isPublic && entry.publishedShareId && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                      <Share2 className="h-3 w-3" />
                      Published
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyShareUrl}
                      className="h-6 px-2 text-xs flex items-center gap-1 hover:bg-green-500/10"
                      title="Copy share URL"
                    >
                      {copiedUrl ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span className="text-xs hidden sm:inline">Copy URL</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-1 sm:gap-2 items-end sm:items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewFullEntry}
                className="h-8 px-2 text-xs flex items-center gap-1 hover:bg-blue-500/10"
                title="View Full Entry"
              >
                <Maximize2 className="h-3 w-3" />
                <span className="hidden sm:inline">View</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditEntry}
                className="h-8 px-2 text-xs flex items-center gap-1 hover:bg-primary/10"
                title="Edit Entry"
              >
                <Edit className="h-3 w-3" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMediaUpload(!showMediaUpload);
                }}
                className="h-8 px-2 text-xs flex items-center gap-1 hover:bg-blue-500/10"
                title="Upload Media"
              >
                <Upload className="h-3 w-3" />
                <span className="hidden sm:inline">Media</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="h-8 px-2 text-xs flex items-center gap-1 hover:bg-destructive/10 text-destructive"
                title="Delete Entry"
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
          
          {/* Media Upload Panel */}
          {showMediaUpload && (
            <div className="mt-4 p-4 bg-background/80 rounded-lg border border-border space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Upload New Media
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMediaUpload(false);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <input
                type="file"
                multiple
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedFiles(e.target.files);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedFiles.length} file(s) selected
                </p>
              )}
              
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMediaUpload();
                }}
                disabled={!selectedFiles || uploadingMedia}
                className="w-full h-8 text-xs"
                size="sm"
              >
                {uploadingMedia ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          )}
          
        </div>
        
        <div className="journal-content whitespace-pre-line mb-4 sm:mb-6 font-journal text-sm sm:text-lg leading-relaxed">
          {entry.content}
        </div>
        
        {/* Image Gallery - Stack Component */}
        {entry.mediaUrl?.image && entry.mediaUrl.image.length > 0 && (
          <div className="mt-6 flex justify-center items-center">
            <Stack
              cardsData={entry.mediaUrl.image.map((image, index) => ({
                id: index + 1,
                img: getMediaUrl(image) || ''
              })).filter(card => card.img)}
              cardDimensions={{ width: 200, height: 200 }}
              randomRotation={true}
              sensitivity={150}
              sendToBackOnClick={true}
              animationConfig={{ stiffness: 300, damping: 25 }}
            />
          </div>
        )}
        
        {/* Audio Files */}
        {entry.mediaUrl?.audio && entry.mediaUrl.audio.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Audio Recordings</h3>
            {entry.mediaUrl.audio.map((audio, index) => {
              const audioUrl = getMediaUrl(audio);
              return (
                <div 
                  key={index}
                  className="flex flex-col gap-2 p-3 bg-background/70 rounded-lg hover:bg-background/90 transition-colors group relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Audio Recording {index + 1}</p>
                      <p className="text-xs text-muted-foreground">From {entry.title}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMediaRequest(audioUrl, 'audio');
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete audio"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {audioUrl && (
                    <audio 
                      controls
                      src={audioUrl}
                      className="w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Video Files */}
        {entry.mediaUrl?.video && entry.mediaUrl.video.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Videos</h3>
            {entry.mediaUrl.video.map((video, index) => {
              const videoUrl = getMediaUrl(video);
              return (
                <div 
                  key={index}
                  className="relative rounded-lg overflow-hidden aspect-video group hover:shadow-lg transition-all duration-300"
                >
                  {videoUrl ? (
                    <>
                      <video 
                        controls
                        src={videoUrl}
                        className="w-full h-full"
                        poster={entry.mediaUrl?.image?.[0] ? getMediaUrl(entry.mediaUrl.image[0]) : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Your browser does not support the video tag.
                      </video>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMediaRequest(videoUrl, 'video');
                        }}
                        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete video"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <p className="text-sm text-muted-foreground">No video</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Document Files */}
        {entry.mediaUrl?.document && entry.mediaUrl.document.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Documents</h3>
            {entry.mediaUrl.document.map((doc, index) => {
              const docUrl = getMediaUrl(doc);
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-background/70 rounded-lg hover:bg-background/90 transition-colors cursor-pointer group relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenMedia(doc, 'document');
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {entry.fileName || `Document ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.fileSize ? `${(entry.fileSize / 1024).toFixed(2)} KB` : 'Document'}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMediaRequest(docUrl, 'document');
                    }}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete document"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {entry.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-journal transition-colors duration-300 hover:bg-primary/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete entry?"
          description="This action cannot be undone. All associated media will also be deleted."
          confirmLabel="Delete"
          confirmLoadingLabel="Deleting..."
          onConfirm={handleDeleteEntry}
          loading={isDeleting}
          confirmTone="danger"
        />

        <ConfirmDialog
          open={showMediaDeleteConfirm}
          onOpenChange={(open) => {
            setShowMediaDeleteConfirm(open);
            if (!open) {
              setMediaDeleteTarget(null);
              setMediaDeleteError(null);
            }
          }}
          title="Delete media?"
          description="This media file will be permanently removed."
          confirmLabel="Delete"
          confirmLoadingLabel="Deleting..."
          onConfirm={() => {
            if (mediaDeleteTarget) {
              handleDeleteMedia(mediaDeleteTarget.url, mediaDeleteTarget.type);
            }
          }}
          loading={mediaDeleteLoading}
          error={mediaDeleteError}
          confirmTone="danger"
        />
    </div>
  );
};

export default JournalPage;