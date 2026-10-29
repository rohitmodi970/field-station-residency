"use client";

/* eslint-disable */
import React, { useState } from 'react';
import { JournalEntry } from './types';
import { useRouter } from 'next/navigation';
import { Heart, Archive, Calendar, Clock, Image, Music, Video, FileText, Tag, Trash2, ArchiveRestore, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { resolveJournalTitle } from '@/utilities/journalTitle';

interface JournalCardWithActionsProps {
  entries: JournalEntry[];
  onToggleFavorite?: (journalId: string, isFavorite: boolean) => Promise<void>;
  onToggleArchive?: (journalId: string, isArchived: boolean) => Promise<void>;
  onDelete?: (journalId: string) => Promise<void>;
  showArchived?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (journalId: string) => void;
}

const JournalCardWithActions: React.FC<JournalCardWithActionsProps> = ({
  entries,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  showArchived = false,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}) => {
  const router = useRouter();
  const { elementColors, isDarkMode } = useTheme();
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const getMediaCounts = (entry: JournalEntry) => {
    if (!entry.mediaUrl) return null;
    
    return {
      image: entry.mediaUrl.image?.length || 0,
      audio: entry.mediaUrl.audio?.length || 0,
      video: entry.mediaUrl.video?.length || 0,
      document: entry.mediaUrl.document?.length || 0,
    };
  };

  const handleCardClick = (journalId: string) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(journalId);
    } else {
      setNavigatingId(journalId);
      router.push(`/journal/${journalId}`);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, journalId: string, currentValue: boolean) => {
    e.stopPropagation();
    if (!onToggleFavorite) return;

    setLoadingStates(prev => ({ ...prev, [`fav-${journalId}`]: true }));
    try {
      await onToggleFavorite(journalId, !currentValue);
    } finally {
      setLoadingStates(prev => ({ ...prev, [`fav-${journalId}`]: false }));
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent, journalId: string, currentValue: boolean) => {
    e.stopPropagation();
    if (!onToggleArchive) return;

    setLoadingStates(prev => ({ ...prev, [`arc-${journalId}`]: true }));
    try {
      await onToggleArchive(journalId, !currentValue);
    } finally {
      setLoadingStates(prev => ({ ...prev, [`arc-${journalId}`]: false }));
    }
  };

  const handleDelete = async (e: React.MouseEvent, journalId: string) => {
    e.stopPropagation();
    if (!onDelete) return;

    setLoadingStates(prev => ({ ...prev, [`del-${journalId}`]: true }));
    try {
      await onDelete(journalId);
    } finally {
      setLoadingStates(prev => ({ ...prev, [`del-${journalId}`]: false }));
    }
  };

  const getMoodColor = (mood: string | null): string => {
    const moodColors: Record<string, string> = {
      happy: '#FFD700',
      sad: '#4682B4',
      excited: '#FF6347',
      calm: '#90EE90',
      anxious: '#DDA0DD',
      angry: '#DC143C',
      grateful: '#FFA07A',
      content: '#98FB98',
      stressed: '#F08080',
      neutral: '#D3D3D3',
    };
    return mood ? moodColors[mood.toLowerCase()] || '#A0AEC0' : '#A0AEC0';
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const mediaCounts = getMediaCounts(entry);
        const hasMedia = mediaCounts && Object.values(mediaCounts).some(count => count > 0);
        const hasVoiceMedia = Boolean((mediaCounts?.audio || 0) > 0 || entry.mediaType?.includes('audio'));
        const displayTitle = resolveJournalTitle({
          title: entry.title,
          date: entry.date,
          hasVoiceMedia,
        });
        const previewContent = entry.resolvedContent || entry.content;
        const moodColor = getMoodColor(entry.mood);
        const isSelected = selectedIds.has(entry.journalId);

        return (
          <div
            key={entry.journalId}
            onClick={() => handleCardClick(entry.journalId)}
            className={`
              group relative overflow-hidden rounded-[24px] border transition-all duration-300 cursor-pointer
              bg-[#fffdfb]/95 shadow-[0_10px_24px_rgba(73,53,39,0.1)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(73,53,39,0.16)]
              ${isSelected 
                ? 'border-[#976b43] ring-2 ring-[#b7895f] ring-offset-2 ring-offset-[#f4e8de]'
                : 'border-[#dbc5b7]/70 hover:border-[#be967e]'}
            `}
          >
            {/* Loading Overlay when Navigating */}
            {navigatingId === entry.journalId && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#fff8f2]/60 backdrop-blur-[2px]">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-[#ead7ca] rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#976b43] rounded-full border-t-transparent animate-spin"></div>
                </div>
              </div>
            )}
            {/* Mood Indicator Bar */}
            <div
              className="absolute left-0 right-0 top-0 h-1.5"
              style={{ background: `linear-gradient(90deg, ${moodColor}, rgba(255,255,255,0.9))` }}
            />
            
            {/* Selection Checkbox */}
            {selectionMode && (
              <div className="absolute left-4 top-4 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection?.(entry.journalId);
                  }}
                  className={`p-1.5 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-[#8e6248] text-white shadow-md'
                      : 'border border-[#d4beb0] bg-[#fff9f3] text-[#745347]'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}

            {/* Card Content */}
            <div className={`p-4 ${selectionMode ? 'pl-12 md:pl-14' : ''}`}>
              {/* Header */}
              <div className="mb-3.5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="flex-1 line-clamp-2 text-xl font-semibold tracking-[0.01em] text-[#3d2a23] transition-colors group-hover:text-[#734837]"
                      style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>
                    {displayTitle}
                  </h3>
                  
                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, entry.journalId, entry.isFavorite || false)}
                    disabled={loadingStates[`fav-${entry.journalId}`]}
                    className={`
                      p-1.5 rounded-full transition-all
                      ${entry.isFavorite 
                        ? 'text-[#b34747] bg-[#fdebea] hover:bg-[#f7dddb]' 
                        : 'text-[#b19a8e] hover:text-[#b34747] hover:bg-[#f7ede4]'}
                      ${loadingStates[`fav-${entry.journalId}`] ? 'opacity-50 cursor-wait' : ''}
                    `}
                    style={{ flexShrink: 0 }}
                    title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-5 h-5 ${entry.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Date and Reading Time */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#7b6154]">
                  <div className="inline-flex items-center gap-1 rounded-full border border-[#dbc9bd] bg-[#fff8f2] px-2.5 py-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(entry.date)}</span>
                  </div>
                  {entry.readingTimeMinutes && entry.readingTimeMinutes > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#dbc9bd] bg-[#fff8f2] px-2.5 py-1">
                      <Clock className="w-4 h-4" />
                      <span>{entry.readingTimeMinutes} min</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Preview */}
              <p className="mb-3.5 min-h-[60px] text-sm leading-relaxed text-[#6c5245] line-clamp-3">
                {previewContent || 'No content available'}
              </p>

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  {entry.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full border border-[#e2d3c7] bg-[#f9efe6] px-2.5 py-1 text-xs font-medium text-[#7b5848]"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 3 && (
                    <span className="inline-flex items-center rounded-full border border-[#dfcec1] bg-[#f7eee6] px-2 py-1 text-xs font-medium text-[#7c6357]">
                      +{entry.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Media Indicators */}
              {hasMedia && (
                <div className="mb-3.5 flex flex-wrap items-center gap-1.5 text-xs text-[#7f6557]">
                  {mediaCounts!.image > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#decfc3] bg-[#fff7f1] px-2.5 py-1">
                      <Image className="w-4 h-4" />
                      <span>{mediaCounts!.image}</span>
                    </div>
                  )}
                  {mediaCounts!.audio > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#decfc3] bg-[#fff7f1] px-2.5 py-1">
                      <Music className="w-4 h-4" />
                      <span>{mediaCounts!.audio}</span>
                    </div>
                  )}
                  {mediaCounts!.video > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#decfc3] bg-[#fff7f1] px-2.5 py-1">
                      <Video className="w-4 h-4" />
                      <span>{mediaCounts!.video}</span>
                    </div>
                  )}
                  {mediaCounts!.document > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#decfc3] bg-[#fff7f1] px-2.5 py-1">
                      <FileText className="w-4 h-4" />
                      <span>{mediaCounts!.document}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 border-t border-[#e2d0c4] pt-3">
                {/* Archive/Unarchive Button */}
                <button
                  onClick={(e) => handleToggleArchive(e, entry.journalId, entry.isArchived || false)}
                  disabled={loadingStates[`arc-${entry.journalId}`]}
                  className={`
                    flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all
                    ${entry.isArchived
                      ? 'bg-[#f2e2d1] text-[#7f4f34] hover:bg-[#edd8c5]'
                      : 'bg-[#f8eee5] text-[#6f4f41] hover:bg-[#f0e2d7]'}
                    ${loadingStates[`arc-${entry.journalId}`] ? 'opacity-50 cursor-wait' : ''}
                  `}
                  title={entry.isArchived ? 'Unarchive' : 'Archive'}
                >
                  {entry.isArchived ? (
                    <>
                      <ArchiveRestore className="w-4 h-4" />
                      <span>Unarchive</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      <span>Archive</span>
                    </>
                  )}
                </button>

                {!!onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, entry.journalId)}
                    disabled={loadingStates[`del-${entry.journalId}`]}
                    className={`rounded-xl p-2 transition-all ${loadingStates[`del-${entry.journalId}`] ? 'cursor-wait opacity-50' : 'text-[#ad5c5c] hover:bg-[#f8e3e3]'}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Mood Badge */}
                {entry.mood && (
                  <div
                    className="ml-auto rounded-xl border px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: `${moodColor}22`,
                      borderColor: `${moodColor}55`,
                      color: moodColor,
                    }}
                  >
                    {entry.mood}
                  </div>
                )}
              </div>
            </div>

            {/* Hover Overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ backgroundImage: 'linear-gradient(to top, rgba(203, 148, 109, 0.12), transparent 54%)' }} />
          </div>
        );
      })}
    </div>
  );
};

export default JournalCardWithActions;
