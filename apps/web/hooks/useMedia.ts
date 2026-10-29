import { useEffect, useState } from 'react';
import { useToast } from './use-toast';

interface UseMediaOptions {
  journalId: string;
}

export function useMedia({ journalId }: UseMediaOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [media, setMedia] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  // Fetch media for the journal
  useEffect(() => {
    if (!journalId) return;

    const fetchMedia = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/media/list?journalId=${journalId}`);
        if (!res.ok) throw new Error('Failed to load media');
        const data = await res.json();
        setMedia(data);
      } catch (error: any) {
        toast({
          title: 'Error loading media',
          description: error.message || 'Could not load media files',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();
  }, [journalId, refreshTrigger]);

  // Upload media
  const uploadMedia = async (file: File, mediaType: 'image' | 'audio' | 'video' | 'document') => {
    if (!journalId) {
      toast({ title: 'Error', description: 'Journal ID is required', variant: 'destructive' });
      return null;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('journalId', journalId);
    formData.append('mediaType', mediaType);
    formData.append('fileName', file.name);
    formData.append('fileSize', file.size.toString());

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        };
        xhr.onerror = () => reject(new Error('Upload error'));
      });

      xhr.send(formData);
      const result = await uploadPromise;

      toast({ title: 'Upload successful', description: `${mediaType} uploaded successfully` });
      setRefreshTrigger((p) => p + 1);
      return result;
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'An error occurred during upload',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete media
  const deleteMedia = async (mediaId: string) => {
    if (!journalId || !mediaId) {
      toast({
        title: 'Error',
        description: 'Journal ID and Media ID are required',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, journalId }),
      });
      if (!res.ok) throw new Error('Deletion failed');

      toast({ title: 'Media deleted', description: 'Media file deleted successfully' });
      setRefreshTrigger((p) => p + 1);
      return true;
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'An error occurred while deleting',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    media,
    uploadMedia,
    deleteMedia,
    uploadProgress,
    uploading,
    isLoading,
    refreshTrigger,
  };
}
