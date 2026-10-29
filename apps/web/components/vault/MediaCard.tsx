
import React from 'react';
import { Image, Music, Video, FileText, Trash2, Download, Edit2 } from 'lucide-react';
import { MediaItem } from '@/types/vault';
import { formatFileSize } from '@/hooks/valult/fileHelpers';

interface MediaCardProps {
  media: MediaItem;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (media: MediaItem) => void;
}

export default function MediaCard({ media, selected, onSelect, onDelete, onEdit }: MediaCardProps) {
  const getMediaIcon = () => {
    switch (media.media_type) {
      case 'image': return <Image className="w-6 h-6" />;
      case 'audio': return <Music className="w-6 h-6" />;
      case 'video': return <Video className="w-6 h-6" />;
      case 'document': return <FileText className="w-6 h-6" />;
    }
  };

  return (
    <div
      className={`relative border-2 rounded-lg overflow-hidden hover:shadow-lg transition-all ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(media.id)}
            className="w-5 h-5 rounded cursor-pointer"
          />
        </div>
      )}

      {/* Media Preview */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {media.media_type === 'image' ? (
          <img
            src={media.public_url}
            alt={media.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : media.media_type === 'video' ? (
          <video
            src={media.public_url}
            className="w-full h-full object-cover"
            controls={false}
          />
        ) : (
          <div className="text-gray-400">
            {getMediaIcon()}
          </div>
        )}
      </div>

      {/* Media Info */}
      <div className="p-3">
        <p className="font-medium text-sm truncate" title={media.file_name}>
          {media.file_name}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{formatFileSize(media.file_size)}</span>
          <span className="capitalize px-2 py-1 bg-gray-100 rounded">
            {media.folder}
          </span>
        </div>

        {/* Dimensions or Duration */}
        {media.width && media.height && (
          <p className="text-xs text-gray-500 mt-1">
            {media.width} × {media.height}
          </p>
        )}
        {media.duration && (
          <p className="text-xs text-gray-500 mt-1">
            Duration: {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, '0')}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <a
            href={media.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 text-center transition"
          >
            View
          </a>
          
          {onEdit && (
            <button
              onClick={() => onEdit(media)}
              className="p-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(media.id)}
              className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Upload Status Badge */}
        {media.upload_status !== 'completed' && (
          <div className="mt-2">
            <span
              className={`inline-block px-2 py-1 text-xs rounded ${
                media.upload_status === 'uploading'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {media.upload_status}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}