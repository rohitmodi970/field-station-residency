// ===========================================
// components/vault/VaultGallery.tsx
// ===========================================

'use client';

import { useState, useEffect } from 'react';
import { Trash2, Download, FolderOpen, Image, Music, Video, FileText, MoreVertical, Edit2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface MediaItem {
  id: string;
  file_name: string;
  media_type: 'image' | 'audio' | 'video' | 'document';
  folder: 'miscellaneous' | 'specific';
  public_url: string;
  file_size: number;
  created_at: string;
  mime_type: string;
}

interface VaultGalleryProps {
  filterFolder?: 'mydrive' | 'journal' | 'onboarding' | 'all';
  filterType?: 'image' | 'audio' | 'video' | 'document' | 'all';
  search?: string;
  onRefresh?: () => void;
}

export default function VaultGallery({ 
  filterFolder = 'all', 
  filterType = 'all',
  search,
  onRefresh 
}: VaultGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [filterFolder, filterType, search]);

  const fetchMedia = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterFolder !== 'all') params.append('folder', filterFolder);
      if (filterType !== 'all') params.append('media_type', filterType);
      params.append('limit', '50');
      if (search && search.trim().length > 0) params.append('search', search.trim());

      const response = await fetch(`/api/vault?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch media');
      }

      setMedia(result.data || []);
      console.log('✅ Fetched media:', result.data?.length, 'items');
    } catch (err: any) {
      console.error('❌ Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id);
    setDeleteError(null);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/vault/${deleteTargetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Delete failed');
      }

      console.log('✅ Deleted:', deleteTargetId);
      setMedia(media.filter(item => item.id !== deleteTargetId));
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
      
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('❌ Delete error:', err);
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedItems.size === 0) return;
    setDeleting(true);
    setBulkDeleteError(null);

    try {
      const response = await fetch('/api/vault/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Bulk delete failed');
      }

      console.log('✅ Bulk deleted:', selectedItems.size, 'items');
      setMedia(media.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      setShowBulkDeleteDialog(false);
      
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('❌ Bulk delete error:', err);
      setBulkDeleteError(err.message || 'Bulk delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={fetchMedia}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedItems.size} item(s) selected
          </span>
          <ConfirmDialog
            open={showBulkDeleteDialog}
            onOpenChange={(open) => {
              setShowBulkDeleteDialog(open);
              if (open) setBulkDeleteError(null);
            }}
            title="Delete selected files?"
            description={`You are about to delete ${selectedItems.size} item(s). This cannot be undone.`}
            confirmLabel="Delete"
            confirmLoadingLabel="Deleting..."
            onConfirm={handleBulkDeleteConfirm}
            loading={deleting}
            error={bulkDeleteError}
            confirmTone="danger"
            trigger={(
              <button
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            )}
          />
        </div>
      )}

      {/* Media Grid */}
      {media.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No media files found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className={`relative border-2 rounded-lg overflow-hidden hover:shadow-lg transition ${
                selectedItems.has(item.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="w-5 h-5 rounded"
                />
              </div>

              {/* Media Preview */}
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {item.media_type === 'image' ? (
                  <img
                    src={item.public_url}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400">
                    {getMediaIcon(item.media_type)}
                  </div>
                )}
              </div>

              {/* Media Info */}
              <div className="p-3">
                <p className="font-medium text-sm truncate" title={item.file_name}>
                  {item.file_name}
                </p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{(item.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  <span className="capitalize">{item.folder}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <a
                    href={item.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 text-center"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDeleteRequest(item.id)}
                    className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
        description="This file will be permanently removed from your vault."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting..."
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        error={deleteError}
        confirmTone="danger"
      />
    </div>
  );
}