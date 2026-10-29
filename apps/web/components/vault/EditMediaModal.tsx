
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MediaItem } from '@/types/vault';

interface EditMediaModalProps {
  media: MediaItem;
  onClose: () => void;
  onSave: (updates: Partial<MediaItem>) => Promise<void>;
}

export default function EditMediaModal({ media, onClose, onSave }: EditMediaModalProps) {
  const [fileName, setFileName] = useState(media.file_name);
  const [folder, setFolder] = useState(media.folder);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        file_name: fileName,
        folder: folder,
      });
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Edit Media</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Name
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder
            </label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
              {folder === 'mydrive' && '📁 My Drive'}
              {folder === 'journal' && '📓 Journal (read-only)'}
              {folder === 'onboarding' && '🎯 Onboarding (read-only)'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Folder location cannot be changed after upload
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}