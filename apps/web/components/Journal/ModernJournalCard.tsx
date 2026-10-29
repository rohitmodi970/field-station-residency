"use client"

/* eslint-disable */
import React from 'react';
import { Calendar, Tag, Heart, Archive, Image, Music, Video, FileText, Clock } from 'lucide-react';
import { JournalWithMedia } from '@/types/database';
import { useRouter } from 'next/navigation';
import { resolveJournalTitle } from '@/utilities/journalTitle';

interface ModernJournalCardProps {
  journal: JournalWithMedia;
  onFavorite?: (journalId: string, isFavorite: boolean) => void;
  onArchive?: (journalId: string, isArchived: boolean) => void;
}

const ModernJournalCard: React.FC<ModernJournalCardProps> = ({
  journal,
  onFavorite,
  onArchive
}) => {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const getMediaCounts = () => {
    if (!journal.media) return null;
    
    const counts = {
      image: journal.media.filter(m => m.media_type === 'image').length,
      audio: journal.media.filter(m => m.media_type === 'audio').length,
      video: journal.media.filter(m => m.media_type === 'video').length,
      document: journal.media.filter(m => m.media_type === 'document').length,
    };

    return counts;
  };

  const mediaCounts = getMediaCounts();
  const hasMedia = mediaCounts && Object.values(mediaCounts).some(count => count > 0);
  const hasVoiceMedia = Boolean(mediaCounts?.audio && mediaCounts.audio > 0);
  const displayTitle = resolveJournalTitle({
    title: journal.title,
    date: journal.date,
    hasVoiceMedia,
  });

  const handleClick = () => {
    router.push(`/journal/${journal.journal_id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-card border border-border rounded-lg p-4 hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(journal.date)}</span>
            {journal.reading_time_minutes > 0 && (
              <>
                <span>•</span>
                <Clock className="w-3.5 h-3.5" />
                <span>{journal.reading_time_minutes} min read</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {/* eslint-disable-next-line */}
        <div className="flex items-center gap-1 shrink-0">
          {onFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(journal.journal_id, !journal.is_favorite);
              }}
              className={`p-2 rounded-lg transition-colors ${
                journal.is_favorite
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
              title={journal.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-4 h-4 ${journal.is_favorite ? 'fill-current' : ''}`}
              />
            </button>
          )}

          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(journal.journal_id, !journal.is_archived);
              }}
              className={`p-2 rounded-lg transition-colors ${
                journal.is_archived
                  ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
              title={journal.is_archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      {journal.content && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {journal.content}
        </p>
      )}

      {/* Media Preview */}
      {hasMedia && journal.media && (
        <div className="mb-3">
          <div className="grid grid-cols-4 gap-2">
            {journal.media.slice(0, 4).map((media, index) => (
              <div
                key={media.id}
                className="aspect-square bg-secondary rounded-md overflow-hidden relative"
              >
                {media.media_type === 'image' && media.thumbnail_url ? (
                  <img
                    src={media.thumbnail_url}
                    alt={media.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {media.media_type === 'audio' && <Music className="w-6 h-6 text-muted-foreground" />}
                    {media.media_type === 'video' && <Video className="w-6 h-6 text-muted-foreground" />}
                    {media.media_type === 'document' && <FileText className="w-6 h-6 text-muted-foreground" />}
                  </div>
                )}
                {index === 3 && journal.media && journal.media.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      +{journal.media.length - 4}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {/* Tags */}
        {journal.tags && journal.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* eslint-disable-next-line */}
            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {journal.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  // eslint-disable-next-line
                  className="px-2 py-0.5 bg-primary/10 text-primary rounded-full truncate max-w-25"
                >
                  {tag}
                </span>
              ))}
              {journal.tags.length > 3 && (
                <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
                  +{journal.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Media Count Summary */}
        {hasMedia && mediaCounts && (
          <div className="flex items-center gap-3 text-muted-foreground shrink-0">
            {mediaCounts.image > 0 && (
              <div className="flex items-center gap-1">
                <Image className="w-3.5 h-3.5" />
                <span>{mediaCounts.image}</span>
              </div>
            )}
            {mediaCounts.audio > 0 && (
              <div className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5" />
                <span>{mediaCounts.audio}</span>
              </div>
            )}
            {mediaCounts.video > 0 && (
              <div className="flex items-center gap-1">
                <Video className="w-3.5 h-3.5" />
                <span>{mediaCounts.video}</span>
              </div>
            )}
            {mediaCounts.document > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>{mediaCounts.document}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mood Indicator */}
      {journal.mood && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary rounded-full text-xs">
            <span>Mood:</span>
            <span className="font-medium capitalize">{journal.mood}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernJournalCard;
