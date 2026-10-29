// apps/web/components/Journal/EnhancedComponents/EntryCard.tsx
"use client";

import React from 'react';
import { Calendar, Clock, Bookmark, Star, Trash2, Edit, Lock } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';
import { resolveJournalTitle } from '@/utilities/journalTitle';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt: string;
  isFavorite?: boolean;
  tags?: string[];
  mood?: string;
  isEncrypted?: boolean;
  wordCount?: number;
}

interface EntryCardProps {
  entry: JournalEntry;
  onEdit?: (entry: JournalEntry) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onClick?: (entry: JournalEntry) => void;
  compact?: boolean;
}

export default function EntryCard({ 
  entry, 
  onEdit, 
  onDelete, 
  onToggleFavorite,
  onClick,
  compact = false
}: EntryCardProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getPreview = (content: string) => {
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  };

  const getMoodColor = (mood?: string) => {
    const colors: { [key: string]: string } = {
      happy: '#10B981',
      sad: '#3B82F6',
      angry: '#EF4444',
      anxious: '#F59E0B',
      calm: '#8B5CF6',
      excited: '#EC4899',
      neutral: '#6B7280',
    };
    return mood ? colors[mood.toLowerCase()] || currentTheme.primary : currentTheme.primary;
  };

  const runtimeEntry = entry as JournalEntry & {
    mediaType?: string[];
    mediaUrl?: { audio?: string[] };
  };
  const hasVoiceMedia = Boolean(
    runtimeEntry.mediaType?.includes('audio') ||
    ((runtimeEntry.mediaUrl?.audio?.length || 0) > 0)
  );
  const displayTitle = resolveJournalTitle({
    title: entry.title,
    date: entry.date || entry.createdAt,
    hasVoiceMedia,
  });

  return (
    <Card
      className={`p-4 hover:shadow-lg transition-all group cursor-pointer ${compact ? 'hover:scale-[1.01]' : 'hover:scale-[1.02]'}`}
      style={containerStyle}
      onClick={() => onClick && onClick(entry)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold truncate ${compact ? 'text-base' : 'text-lg'}`}>
              {displayTitle}
            </h3>
            {entry.isEncrypted && (
              <div
                className="p-1 rounded"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
                title="Encrypted"
              >
                <Lock size={12} style={{ color: currentTheme.primary }} />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>{formatDate(entry.date)}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatTime(entry.createdAt)}</span>
            </div>
            {entry.wordCount !== undefined && (
              <>
                <span>•</span>
                <span>{entry.wordCount} words</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(entry.id);
              }}
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{
                backgroundColor: entry.isFavorite ? `${currentTheme.primary}20` : 'transparent',
                color: entry.isFavorite ? currentTheme.primary : elementColors.text,
              }}
              title={entry.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              {entry.isFavorite ? <Star size={16} fill="currentColor" /> : <Star size={16} />}
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(entry);
              }}
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{
                backgroundColor: `${currentTheme.primary}20`,
                color: currentTheme.primary,
              }}
              title="Edit Entry"
            >
              <Edit size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="p-2 rounded-lg transition-all hover:scale-110 hover:bg-red-100 dark:hover:bg-red-900/20"
              style={{ color: '#EF4444' }}
              title="Delete Entry"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      {!compact && (
        <p className="text-sm opacity-80 mb-3 line-clamp-3">
          {getPreview(entry.content)}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {entry.mood && (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1"
              style={{
                backgroundColor: `${getMoodColor(entry.mood)}20`,
                color: getMoodColor(entry.mood),
              }}
            >
              <Bookmark size={10} />
              {entry.mood}
            </span>
          )}
          {entry.tags && entry.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
              }}
            >
              {tag}
            </span>
          ))}
          {entry.tags && entry.tags.length > 3 && (
            <span className="text-xs px-2 py-1 opacity-60">
              +{entry.tags.length - 3} more
            </span>
          )}
        </div>

        {/* Favorite Badge */}
        {entry.isFavorite && (
          <div className="flex items-center gap-1 text-xs opacity-70">
            <Star size={12} fill={currentTheme.primary} style={{ color: currentTheme.primary }} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete entry?"
        description="This entry will be permanently removed."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting..."
        onConfirm={() => {
          onDelete?.(entry.id);
          setShowDeleteDialog(false);
        }}
        confirmTone="danger"
      />
    </Card>
  );
}
