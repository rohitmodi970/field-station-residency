// hooks/useVault.ts
// ===========================================

import { useState, useCallback } from 'react';
import { MediaItem, VaultStats, UploadOptions } from '@/types/vault';

export function useVault() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch media items
  const fetchMedia = useCallback(async (params?: {
    folder?: 'mydrive' | 'journal' | 'onboarding';
    media_type?: 'image' | 'audio' | 'video' | 'document';
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params?.folder) queryParams.append('folder', params.folder);
      if (params?.media_type) queryParams.append('media_type', params.media_type);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.search) queryParams.append('search', params.search);

      const response = await fetch(`/api/vault?${queryParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch media');
      }

      return result.data as MediaItem[];
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload file
  const uploadFile = useCallback(async (file: File, options: UploadOptions) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', options.folder);
      
      if (options.is_encrypted) {
        formData.append('is_encrypted', 'true');
        if (options.encryption_iv) {
          formData.append('encryption_iv', options.encryption_iv);
        }
      }
      
      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }
      
      if (options.width) formData.append('width', options.width.toString());
      if (options.height) formData.append('height', options.height.toString());
      if (options.duration) formData.append('duration', options.duration.toString());

      const response = await fetch('/api/vault', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      return result.data as MediaItem;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single media item
  const getMedia = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vault/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch media');
      }

      return result.data as MediaItem;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update media
  const updateMedia = useCallback(async (
    id: string,
    updates: Partial<Pick<MediaItem, 'file_name' | 'metadata' | 'folder' | 'width' | 'height' | 'duration'>>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vault/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Update failed');
      }

      return result.data as MediaItem;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete media
  const deleteMedia = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vault/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Delete failed');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bulk delete
  const bulkDelete = useCallback(async (ids: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vault/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Bulk delete failed');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get stats
  const getStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vault/stats');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      return result.data as VaultStats;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchMedia,
    uploadFile,
    getMedia,
    updateMedia,
    deleteMedia,
    bulkDelete,
    getStats,
  };
}