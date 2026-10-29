// apps/web/app/[username]/journal/[shareId]/PublicJournalView.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Cloud, Tag, Eye, Share2, Heart, Image as ImageIcon, Music, Video, FileText, TrendingUp } from 'lucide-react';
import MediaModal from '@/components/MediaModal';
import JournalAnalysisReport from './JournalAnalysisReport';

interface PublicJournalViewProps {
  journal: {
    shareId: string;
    username: string;
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
    uniqueViewsCount: number;
    totalSharesCount: number;
    includeMedia: boolean;
    includeAnalysis: boolean;
    snapshotAnalysis: any | null;
    is_anonymous?: boolean;
    anonymous_alias?: string | null;
    media: {
      images: any[];
      audio: any[];
      video: any[];
      documents: any[];
    };
  };
  visitorId: string;
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


export default function PublicJournalView({ journal, visitorId }: PublicJournalViewProps) {
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    name: string;
    mimeType?: string;
  } | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  // Engagement tracking state
  const [timeSpent, setTimeSpent] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [clickedMedia, setClickedMedia] = useState(false);
  const [clickedShare, setClickedShare] = useState(false);
  
  const startTimeRef = useRef<number>(Date.now());
  const engagementSentRef = useRef<boolean>(false);

  const moodColor = journal.mood ? moodColors[journal.mood.toLowerCase()] || moodColors.neutral : moodColors.neutral;

  // Track time spent and scroll depth
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const percentage = scrollHeight > 0 ? Math.round((scrolled / scrollHeight) * 100) : 0;
      setMaxScroll(prev => Math.max(prev, percentage));
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Send engagement data when user leaves or after 30 seconds
  useEffect(() => {
    const sendEngagementData = async () => {
      if (engagementSentRef.current) return;
      engagementSentRef.current = true;

      try {
        await fetch(`/api/${journal.username}/journal/${journal.shareId}/engagement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            timeSpentSeconds: timeSpent,
            scrollPercentage: maxScroll,
            clickedMedia,
            clickedShare,
          }),
        });
      } catch (err) {
        console.error('[Engagement] Error tracking:', err);
      }
    };

    // Send after 30 seconds
    const timer = setTimeout(sendEngagementData, 30000);

    // Send on page unload
    const handleBeforeUnload = () => {
      sendEngagementData();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [journal.shareId, journal.username, visitorId, timeSpent, maxScroll, clickedMedia, clickedShare]);

  const handleShare = async (platform: string) => {
    setClickedShare(true);
    
    const baseUrl = `${window.location.origin}/${journal.username}/journal/${journal.shareId}`;
    const url = `${baseUrl}?share_platform=${platform}&ref=${visitorId}`;
    const title = journal.title;
    const text = `Check out this journal by @${journal.username}: ${title}`;

    // Track share action
    const trackShare = async () => {
      const trackingKey = `share_${journal.shareId}_${platform}`;
      const lastTracked = sessionStorage.getItem(trackingKey);
      const now = Date.now();
      
      // Only track once per 5 minutes per platform
      if (lastTracked && (now - parseInt(lastTracked)) < 300000) {
        return;
      }
      
      try {
        const response = await fetch(`/api/${journal.username}/journal/${journal.shareId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            visitorId,
            platform, 
            targetUrl: url 
          }),
        });

        if (response.ok) {
          const data = await response.json();
          sessionStorage.setItem(trackingKey, now.toString());
          return data.shareUrl;
        }
      } catch (err) {
        console.error('[Share] Tracking error:', err);
      }
      
      return url;
    };

    // Get tracked URL
    const trackedUrl = await trackShare();

    // Open share dialog
    let shareOpened = false;
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl)}`, '_blank');
        shareOpened = true;
        break;
      case 'twitter':
      case 'x':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(trackedUrl)}&text=${encodeURIComponent(text)}`, '_blank');
        shareOpened = true;
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trackedUrl)}`, '_blank');
        shareOpened = true;
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + trackedUrl)}`, '_blank');
        shareOpened = true;
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(trackedUrl)}&text=${encodeURIComponent(text)}`, '_blank');
        shareOpened = true;
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + trackedUrl)}`;
        shareOpened = true;
        break;
      case 'copy_link':
        navigator.clipboard.writeText(trackedUrl);
        alert('Link copied to clipboard!');
        shareOpened = true;
        break;
      case 'native_share':
        if (navigator.share) {
          navigator.share({ title, text, url: trackedUrl })
            .then(() => console.log('[Share] Native share successful'))
            .catch(err => console.error('[Share] Native share error:', err));
          shareOpened = true;
        }
        break;
    }

    setShowShareMenu(false);
  };

  const handleMediaClick = (media: any, type: 'image' | 'video' | 'audio' | 'document') => {
    setClickedMedia(true);
    setSelectedMedia({
      type,
      url: media.url,
      name: media.fileName,
      mimeType: media.mimeType,
    });
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {journal.is_anonymous ? (
              <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-lg">
                🕶️
              </div>
            ) : journal.author.profileImage ? (
              <img 
                src={journal.author.profileImage} 
                alt={journal.author.name || 'Author'} 
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {journal.author.name?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            <div>
              {journal.is_anonymous ? (
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {journal.anonymous_alias || 'Anonymous'}
                </div>
              ) : (
                <>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    @{journal.username}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {journal.author.name || 'Anonymous'}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Eye className="w-4 h-4" />
              <span>{journal.uniqueViewsCount.toLocaleString()}</span>
            </div>
            {journal.totalSharesCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <TrendingUp className="w-4 h-4" />
                <span>{journal.totalSharesCount}</span>
              </div>
            )}
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Share Menu */}
        {showShareMenu && (
          <div className="absolute right-4 top-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 w-48 z-20">
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              📱 WhatsApp
            </button>
            <button
              onClick={() => handleShare('facebook')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              👍 Facebook
            </button>
            <button
              onClick={() => handleShare('x')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              𝕏 X (Twitter)
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              💼 LinkedIn
            </button>
            <button
              onClick={() => handleShare('telegram')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              ✈️ Telegram
            </button>
            <button
              onClick={() => handleShare('email')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              📧 Email
            </button>
            <button
              onClick={() => handleShare('copy_link')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              🔗 Copy Link
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={() => handleShare('native_share')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
              >
                📤 More Options
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {journal.title}
        </h1>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
          {journal.date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(journal.date)}</span>
            </div>
          )}
          {journal.mood && (
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: moodColor }}
              />
              <span className="capitalize">{journal.mood}</span>
            </div>
          )}
          {journal.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{journal.location}</span>
            </div>
          )}
          {journal.weather && (
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              <span>{journal.weather}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {journal.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {journal.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div 
            className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: journal.content }}
          />
        </div>

        {/* Media Gallery */}
        {journal.includeMedia && totalMediaCount > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Media ({totalMediaCount})
            </h2>

            {/* Images */}
            {journal.media.images.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Images ({journal.media.images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {journal.media.images.map((img: any) => (
                    <div 
                      key={img.id}
                      className="cursor-pointer group relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
                      onClick={() => handleMediaClick(img, 'image')}
                    >
                      <img
                        src={img.url || img.thumbnailUrl}
                        alt={img.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio */}
            {journal.media.audio.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Audio ({journal.media.audio.length})
                </h3>
                <div className="space-y-3">
                  {journal.media.audio.map((audio: any) => (
                    <div key={audio.id} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Music className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {audio.fileName}
                        </span>
                      </div>
                      <audio controls className="w-full" src={audio.url}>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {journal.media.video.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Videos ({journal.media.video.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {journal.media.video.map((video: any) => (
                    <div key={video.id} className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <video controls className="w-full" src={video.url}>
                        Your browser does not support video playback.
                      </video>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {journal.media.documents.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents ({journal.media.documents.length})
                </h3>
                <div className="space-y-2">
                  {journal.media.documents.map((doc: any) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {doc.fileName}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis Report */}
        {journal.includeAnalysis && journal.snapshotAnalysis && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              Analysis Report
            </h2>
            <JournalAnalysisReport analysis={journal.snapshotAnalysis} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Published on {formatDate(journal.publishedAt)}</p>
          <p className="mt-2">Powered by Force Journal</p>
        </div>
      </div>

      {/* Media Modal */}
      {selectedMedia && (
        <MediaModal
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
          media={selectedMedia}
          isDarkMode={false}
        />
      )}
    </div>
  );
}
