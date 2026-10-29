// apps/web/app/p/[shareId]/PublicJournalView.tsx
'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Cloud, Tag, Eye, Share2, Heart, Image as ImageIcon, Music, Video, FileText } from 'lucide-react';
import MediaModal from '@/components/MediaModal';

interface PublicJournalViewProps {
  journal: {
    shareId: string;
    title: string;
    content: string;
    tags: string[];
    mood: string | null;
    location: string | null;
    weather: string | null;
    date: string | null;
    author: {
      name: string | null;
      email: string | null;
      profileImage: string | null;
    };
    publishedAt: string;
    accessCount: number;
    includeMedia: boolean;
    is_anonymous?: boolean;
    anonymous_alias?: string | null;
    media: {
      images: any[];
      audio: any[];
      video: any[];
      documents: any[];
    };
  };
}

const moodColors: { [key: string]: string } = {
  happy: '#10B981',
  sad: '#3B82F6',
  angry: '#EF4444',
  anxious: '#F59E0B',
  calm: '#6366F1',
  excited: '#EC4899',
  neutral: '#6B7280',
  grateful: '#8B5CF6',
  stressed: '#DC2626',
  peaceful: '#14B8A6',
};

export default function PublicJournalView({ journal }: PublicJournalViewProps) {
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    name: string;
    mimeType?: string;
  } | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const moodColor = journal.mood ? moodColors[journal.mood.toLowerCase()] || moodColors.neutral : moodColors.neutral;

  const handleShare = async (platform: string) => {
    const url = window.location.href;
    const title = journal.title;
    const text = `Check out this journal: ${title}`;

    // Track share action asynchronously (don't block UI)
    const trackShare = () => {
      // Check if already tracked in session (prevent duplicates)
      const trackingKey = `share_${journal.shareId}_${platform}`;
      const lastTracked = sessionStorage.getItem(trackingKey);
      const now = Date.now();
      
      // Only track once per 5 minutes per platform
      if (lastTracked && (now - parseInt(lastTracked)) < 300000) {
        console.log('[Share] Already tracked recently, skipping');
        return;
      }
      
      // Record share event (non-blocking)
      fetch(`/api/p/${journal.shareId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, target_url: url }),
      })
        .then(() => {
          sessionStorage.setItem(trackingKey, now.toString());
        })
        .catch(err => console.error('[Share] Tracking error:', err));
    };

    // Open share dialog first (don't wait for tracking)
    let shareOpened = false;
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        shareOpened = true;
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
        shareOpened = true;
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        shareOpened = true;
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
        shareOpened = true;
        break;
      default:
        if (navigator.share) {
          navigator.share({ title, text, url }).then(() => {
            shareOpened = true;
            trackShare();
          });
        }
    }

    // Only track if share dialog was opened
    if (shareOpened && platform !== 'native') {
      trackShare();
    }

    setShowShareMenu(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalMediaCount = 
    journal.media.images.length + 
    journal.media.audio.length + 
    journal.media.video.length + 
    journal.media.documents.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Shared Journal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <Eye className="w-4 h-4" />
              <span>{journal.accessCount}</span>
            </div>
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Share Menu */}
        {showShareMenu && (
          <div className="max-w-4xl mx-auto mt-2 bg-white dark:bg-gray-700 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleShare('facebook')} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                Facebook
              </button>
              <button onClick={() => handleShare('twitter')} className="px-3 py-1.5 bg-sky-500 text-white rounded hover:bg-sky-600">
                Twitter
              </button>
              <button onClick={() => handleShare('whatsapp')} className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600">
                WhatsApp
              </button>
              <button onClick={() => handleShare('copy')} className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700">
                Copy Link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Mood Bar */}
        {journal.mood && (
          <div
            className="h-1 rounded-full mb-6"
            style={{ backgroundColor: moodColor }}
          />
        )}

        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {journal.title}
        </h1>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
          {journal.date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(journal.date)}</span>
            </div>
          )}
          {journal.mood && (
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: moodColor }}>
                {journal.mood}
              </span>
            </div>
          )}
          {journal.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{journal.location}</span>
            </div>
          )}
          {journal.weather && (
            <div className="flex items-center gap-1">
              <Cloud className="w-4 h-4" />
              <span>{journal.weather}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {journal.tags && journal.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {journal.tags.map((tag, index) => (
              <span
                key={index}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div 
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: journal.content }}
          />
        </div>

        {/* Media Section */}
        {journal.includeMedia && totalMediaCount > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Media ({totalMediaCount})
            </h2>

            {/* Images */}
            {journal.media.images.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Images ({journal.media.images.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {journal.media.images.map((img: any, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                      onClick={() => setSelectedMedia({ type: 'image', url: img.url, name: img.fileName, mimeType: img.mimeType })}
                    >
                      <img
                        src={img.thumbnailUrl || img.url}
                        alt={img.fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio */}
            {journal.media.audio.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Audio ({journal.media.audio.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {journal.media.audio.map((audio: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <p className="text-sm font-medium mb-2">{audio.fileName}</p>
                      <audio controls className="w-full">
                        <source src={audio.url} type={audio.mimeType} />
                      </audio>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video */}
            {journal.media.video.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Videos ({journal.media.video.length})
                  </h3>
                </div>
                <div className="space-y-4">
                  {journal.media.video.map((video: any, index: number) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded overflow-hidden">
                      <video controls className="w-full">
                        <source src={video.url} type={video.mimeType} />
                      </video>
                      <p className="p-2 text-sm">{video.fileName}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {journal.media.documents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Documents ({journal.media.documents.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {journal.media.documents.map((doc: any, index: number) => (
                    <a
                      key={index}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                    >
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{doc.fileName}</p>
                        <p className="text-xs text-gray-500">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Author Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-4">
            {journal.is_anonymous ? (
              <div className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold">
                🕶️
              </div>
            ) : journal.author.profileImage ? (
              <img
                src={journal.author.profileImage}
                alt={journal.author.name || 'Author'}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {journal.author.name?.charAt(0) || 'A'}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {journal.is_anonymous
                  ? (journal.anonymous_alias || 'Anonymous')
                  : (journal.author.name || 'Anonymous')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Published {formatDate(journal.publishedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Media Modal */}
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          isOpen={true}
          isDarkMode={false}
        />
      )}
    </div>
  );
}
