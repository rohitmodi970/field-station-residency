import React from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    name: string;
    mimeType?: string;
  } | null;
  isDarkMode: boolean;
}

// Usage instructions:
// 1. Copy this component to your project (e.g., @/components/MediaModal.tsx)
// 2. Import it in your journal page
// 3. Add state for modal: const [selectedMedia, setSelectedMedia] = useState<{type, url, name, mimeType} | null>(null)
// 4. Add the component: <MediaModal isOpen={!!selectedMedia} onClose={() => setSelectedMedia(null)} media={selectedMedia} isDarkMode={isDarkMode} />
// 5. Add onClick handlers to media items to open modal

const MediaModal: React.FC<MediaModalProps> = ({ isOpen, onClose, media, isDarkMode }) => {
  const { elementColors } = useTheme();
  const [zoom, setZoom] = React.useState(1);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  if (!isOpen || !media) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = media.url;
    link.download = media.name;
    link.click();
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const renderMedia = () => {
    switch (media.type) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <img
              src={media.url}
              alt={media.name}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <video
              controls
              autoPlay
              src={media.url}
              className="max-w-full max-h-full"
              style={{ maxHeight: '80vh' }}
            >
              Your browser does not support video playback.
            </video>
          </div>
        );
      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-full max-w-2xl space-y-6">
              <div className="flex items-center justify-center w-32 h-32 mx-auto rounded-full" 
                   style={{ backgroundColor: elementColors.background || (isDarkMode ? '#374151' : '#F3F4F6') }}>
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-center">{media.name}</h3>
              <audio controls className="w-full" src={media.url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-full max-w-4xl">
              {media.mimeType === 'application/pdf' ? (
                <iframe
                  src={media.url}
                  className="w-full h-[80vh] rounded-lg"
                  title={media.name}
                />
              ) : (
                <div className="text-center space-y-6">
                  <div className="flex items-center justify-center w-32 h-32 mx-auto rounded-full"
                       style={{ backgroundColor: elementColors.background || (isDarkMode ? '#374151' : '#F3F4F6') }}>
                    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">{media.name}</h3>
                  <p className="text-gray-500">Preview not available for this file type</p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Download size={20} />
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return <div>Unsupported media type</div>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
    >
      {/* Header Controls */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4"
        style={{ backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold truncate max-w-md">{media.name}</h3>
        
        <div className="flex items-center gap-2">
          {media.type === 'image' && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-sm px-2">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={20} />
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
            </>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 size={20} />
          </button>
          
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Download"
          >
            <Download size={20} />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Media Content */}
      <div
        className="w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {renderMedia()}
      </div>

      {/* Navigation Hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm opacity-75">
        Press ESC to close
      </div>
    </div>
  );
};

export default MediaModal;