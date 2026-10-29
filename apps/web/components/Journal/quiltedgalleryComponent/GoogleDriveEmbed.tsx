import React, { useState, useEffect } from "react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Loader2, ArrowLeftIcon } from "lucide-react";

const GoogleDriveEmbed = ({
  id,
  src,
  driveFileId,
  title,
  thumbnailUrl,
}: {
  id: string;
  src: string;
  driveFileId?: string;
  title: string;
  thumbnailUrl?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  const getFileId = () => {
    if (driveFileId) return driveFileId;

    try {
      const match = src.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) return match[1];

      const idMatch = src.match(/[?&]id=([^&]+)/);
      if (idMatch && idMatch[1]) return idMatch[1];

      if (/^[a-zA-Z0-9_-]{25,40}$/.test(src)) return src;

      return null;
    } catch (e) {
      console.error("Error extracting file ID:", e);
      return null;
    }
  };

  const fileId = getFileId();

  useEffect(() => {
    if (!thumbnailUrl) {
      setShowIframe(true);
    }
  }, [thumbnailUrl]);

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    setShowIframe(true);
  };

  const handleThumbnailClick = () => {
    if (!showIframe) {
      setShowIframe(true);
    }
  };

  // If no fileId, assume Supabase storage and display image directly
  if (!fileId && src) {
    return (
      <div
        className={cn(
          "w-full h-full relative transition-all duration-300 rounded-lg overflow-hidden cursor-pointer",
          isExpanded ? "fixed inset-0 z-50 p-4" : ""
        )}
        style={{
          backgroundColor: isExpanded 
            ? (isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)')
            : undefined
        }}
        onClick={toggleExpanded}
      >
        <img
          src={thumbnailUrl || src}
          alt={title}
          className={cn(
            "w-full h-full object-cover transition-all duration-300",
            isExpanded ? "object-contain max-w-6xl max-h-[90vh] mx-auto my-auto" : ""
          )}
        />
        
        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(e);
            }}
            className="absolute top-6 right-6 p-3 rounded-full transition-all duration-200 hover:scale-110 z-10"
            style={{
              backgroundColor: isDarkMode 
                ? 'rgba(0, 0, 0, 0.7)' 
                : 'rgba(255, 255, 255, 0.9)',
              color: isDarkMode ? '#ffffff' : '#000000'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = currentTheme.primary;
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode 
                ? 'rgba(0, 0, 0, 0.7)' 
                : 'rgba(255, 255, 255, 0.9)';
              e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#000000';
            }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }
  
  if (!fileId) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center rounded-lg border-2 border-dashed"
        style={{ 
          backgroundColor: elementColors.background,
          borderColor: currentTheme.medium,
          color: elementColors.text
        }}
      >
        <div className="text-center p-4">
          <p className="font-medium mb-1">No file ID found</p>
          <p className="text-sm opacity-70">Check the URL format</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full relative transition-all duration-300 rounded-lg overflow-hidden",
        isExpanded ? "fixed inset-0 z-50 p-4" : ""
      )}
      style={{
        backgroundColor: isExpanded 
          ? (isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)')
          : undefined
      }}
    >
      {thumbnailUrl && !isExpanded && !isLoading && (
        <img
          src={thumbnailUrl}
          alt={title}
          className={cn(
            "w-full h-full object-cover transition-all duration-300 cursor-pointer hover:scale-105",
            showIframe ? "opacity-0 absolute" : "opacity-100"
          )}
          onClick={handleThumbnailClick}
        />
      )}

      {isLoading && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg"
          style={{ 
            backgroundColor: elementColors.background,
            color: elementColors.text
          }}
        >
          <Loader2 
            className="w-8 h-8 animate-spin mb-2" 
            style={{ color: currentTheme.primary }}
          />
          <span className="text-sm opacity-70">Loading preview...</span>
        </div>
      )}

      {showIframe && (
        <iframe
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          className={cn(
            "border-0 transition-opacity duration-300 rounded-lg",
            isExpanded 
              ? "w-full h-full max-w-6xl max-h-[90vh] mx-auto my-auto" 
              : "absolute inset-0 w-full h-full",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          allow="autoplay"
          onLoad={() => setIsLoading(false)}
          title={title || "Google Drive embed"}
          style={{
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
      )}

      {isExpanded && (
        <button
          onClick={toggleExpanded}
          className="absolute top-6 right-6 p-3 rounded-full transition-all duration-200 hover:scale-110 z-10"
          style={{
            backgroundColor: isDarkMode 
              ? 'rgba(0, 0, 0, 0.7)' 
              : 'rgba(255, 255, 255, 0.9)',
            color: isDarkMode ? '#ffffff' : '#000000'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = currentTheme.primary;
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode 
              ? 'rgba(0, 0, 0, 0.7)' 
              : 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#000000';
          }}
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
      )}

      {/* Optional: Add a theme-aware border when not expanded */}
      {!isExpanded && (
        <div 
          className="absolute inset-0 border-2 rounded-lg pointer-events-none transition-opacity duration-200 opacity-0 hover:opacity-100"
          style={{ borderColor: currentTheme.primary }}
        />
      )}
    </div>
  );
};

export default GoogleDriveEmbed;