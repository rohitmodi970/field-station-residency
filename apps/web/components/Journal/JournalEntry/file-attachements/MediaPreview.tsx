import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, FileText, Image, Music, Video, Loader, ChevronUp, Menu, Check } from 'lucide-react';
import { MediaFile } from '../../types';
import AudioAnalyzer from '../AudioAnalyzer';
import AudioAnalysisDisplay from '../AudioAnalysisDisplay';
import { useTheme } from '@/utilities/context/ThemeContext';

interface MediaPreviewProps {
  mediaFiles: MediaFile[];
  onRemove: (id: string) => void;
  isUploading: boolean;
}

type SectionKey = 'image' | 'audio' | 'video' | 'document';

const SECTION_STATE_STORAGE_KEY = 'journal_media_preview_sections_v1';
const getFileExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const heicPreviewCache = new Map<string, string>();

interface AnalysisResults {
  status?: string;
  emotions?: Record<string, number>;
  linguistics: {
    transcript?: string;
    summary: string;
    sentiment: {
      overall: string;
      score: number;
      positive: number;
      negative: number;
      neutral: number;
    };
    confidence: number;
    topics: string[];
    keywords?: string[];
  };
  speech?: {
    pitch: {
      average: number;
      variation: number;
      data: number[];
    };
    rate: {
      wordsPerMinute: number;
      syllablesPerSecond: number;
      data: number[];
    };
    volume: {
      average: number;
      peak: number;
      data: number[];
    };
    pauses: {
      count: number;
      locations: number[];
      durations?: number[];
      averageDuration: number;
    };
  };
  energyData?: {
    totalEnergy: number;
    averageEnergy: number;
    energyDistribution: Array<{ time: number; energy: number }>;
  };
  metadata?: {
    duration: number;
    filename: string;
    filesize: number;
  };
  data?: {
    [key: string]: unknown;
  };
}

interface HeicAwareImagePreviewProps {
  file: MediaFile;
  imageExtension: string;
  className: string;
}

const HeicAwareImagePreview: React.FC<HeicAwareImagePreviewProps> = ({ file, imageExtension, className }) => {
  const { isDarkMode } = useTheme();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const isHeicLike = imageExtension === 'heic' || imageExtension === 'heif';
  const cacheKey = `${file.id}:${file.file.size}:${file.file.lastModified}:${file.file.name}`;

  useEffect(() => {
    let active = true;
    const objectUrlsToRevoke: string[] = [];

    const setSrc = (src: string) => {
      if (!active) return;
      setPreviewSrc(src);
    };

    const buildPreview = async () => {
      setPreviewError(null);

      if (!isHeicLike) {
        if (file.url) {
          setSrc(file.url);
          return;
        }

        const localUrl = URL.createObjectURL(file.file);
        objectUrlsToRevoke.push(localUrl);
        setSrc(localUrl);
        return;
      }

      setIsConverting(true);
      try {
        const cachedPreview = heicPreviewCache.get(cacheKey);
        if (cachedPreview) {
          setSrc(cachedPreview);
          return;
        }

        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default as unknown as (options: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;
        const converted = await heic2any({ blob: file.file, toType: 'image/jpeg', quality: 0.9 });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;

        if (!(convertedBlob instanceof Blob)) {
          throw new Error('Invalid converted blob');
        }

        const convertedUrl = URL.createObjectURL(convertedBlob);
  heicPreviewCache.set(cacheKey, convertedUrl);
        setSrc(convertedUrl);
      } catch (error) {
        console.warn('HEIC preview conversion failed', {
          fileName: file.file.name,
          extension: imageExtension,
          error,
        });
        if (active) {
          setPreviewError('HEIC preview is not supported in this browser. File uploaded successfully.');
          setPreviewSrc(null);
        }
      } finally {
        if (active) {
          setIsConverting(false);
        }
      }
    };

    void buildPreview();

    return () => {
      active = false;
      objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [cacheKey, file, imageExtension, isHeicLike]);

  if (isConverting) {
    return (
      <div className="flex h-28 w-full items-center justify-center rounded-xl border px-3 text-center text-[11px]" style={{ borderColor: isDarkMode ? '#475569' : '#CBD5E1', backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>
        Converting HEIC preview...
      </div>
    );
  }

  if (previewError || !previewSrc) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center rounded-xl border px-3 text-center text-[11px]" style={{ borderColor: isDarkMode ? '#475569' : '#CBD5E1', backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>
        <span className="font-medium">Preview unavailable</span>
        <span className="mt-1 truncate max-w-full">{file.file.name}</span>
        {previewError && <span className="mt-1">{previewError}</span>}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewSrc}
      alt={file.file.name}
      className={className}
      onError={(e) => {
        console.warn('Image preview unavailable', {
          fileName: file.file.name,
          extension: imageExtension,
          src: e.currentTarget.currentSrc || e.currentTarget.src,
        });
        setPreviewError('Unable to render this image preview.');
        setPreviewSrc(null);
      }}
    />
  );
};

const MediaPreview: React.FC<MediaPreviewProps> = ({ mediaFiles, onRemove, isUploading }) => {
  // Get theme context
  const { currentTheme, isDarkMode } = useTheme();
  
  // Store analysis states and results for all files
  const [analyzingFiles, setAnalyzingFiles] = useState<{[key: string]: boolean}>({});
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: AnalysisResults}>({});

  const filesByType = useMemo(() => ({
    image: mediaFiles.filter((file) => file.type === 'image'),
    audio: mediaFiles.filter((file) => file.type === 'audio'),
    video: mediaFiles.filter((file) => file.type === 'video'),
    document: mediaFiles.filter((file) => file.type === 'document')
  }), [mediaFiles]);

  const [sectionExpandedMap, setSectionExpandedMap] = useState<Record<SectionKey, boolean>>(() => {
    const defaults: Record<SectionKey, boolean> = {
      image: false,
      audio: false,
      video: false,
      document: false
    };

    if (typeof window === 'undefined') {
      return defaults;
    }

    try {
      const raw = window.localStorage.getItem(SECTION_STATE_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        image: Boolean(parsed?.image),
        audio: Boolean(parsed?.audio),
        video: Boolean(parsed?.video),
        document: Boolean(parsed?.document)
      };
    } catch {
      return defaults;
    }
  });

  const previousCountsRef = useRef<Record<SectionKey, number>>({
    image: filesByType.image.length,
    audio: filesByType.audio.length,
    video: filesByType.video.length,
    document: filesByType.document.length
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SECTION_STATE_STORAGE_KEY, JSON.stringify(sectionExpandedMap));
  }, [sectionExpandedMap]);

  useEffect(() => {
    const previous = previousCountsRef.current;
    const current: Record<SectionKey, number> = {
      image: filesByType.image.length,
      audio: filesByType.audio.length,
      video: filesByType.video.length,
      document: filesByType.document.length
    };

    const nextExpanded: Record<SectionKey, boolean> = { ...sectionExpandedMap };
    let hasChange = false;

    (Object.keys(current) as SectionKey[]).forEach((key) => {
      if (current[key] > previous[key]) {
        nextExpanded[key] = true;
        hasChange = true;
      }
    });

    if (hasChange) {
      setSectionExpandedMap(nextExpanded);
    }

    previousCountsRef.current = current;
  }, [filesByType, sectionExpandedMap]);

  const handleStartAnalysis = (fileId: string) => {
    setAnalyzingFiles(prev => ({
      ...prev,
      [fileId]: true
    }));
  };

  const handleAnalysisComplete = (fileId: string, results: AnalysisResults) => {
    setAnalyzingFiles(prev => ({
      ...prev,
      [fileId]: false
    }));
    
    setAnalysisResults(prev => ({
      ...prev,
      [fileId]: results
    }));
  };

  // Helper function to check if URL is a Google Drive link
  const isGoogleDriveLink = (url: string): boolean => {
    return Boolean(url && url.includes('drive.google.com'));
  };

  // Helper function to convert Google Drive view link to embed link
  const getGoogleDriveEmbedUrl = (url: string) => {
    if (!isGoogleDriveLink(url)) return url;
    
    // Extract file ID from various Google Drive URL formats
    let fileId = '';
    
    if (url.includes('/file/d/')) {
      const parts = url.split('/file/d/')[1];
      if (parts) {
        fileId = parts.split('/')[0] || '';
      }
    } else if (url.includes('id=')) {
      const parts = url.split('id=')[1];
      if (parts) {
        fileId = parts.split('&')[0] || '';
      }
    }
    
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    return url;
  };

  const toggleSection = (section: SectionKey) => {
    setSectionExpandedMap((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const setAllSectionsExpanded = (expanded: boolean) => {
    setSectionExpandedMap((prev) => {
      const next = { ...prev };
      (Object.keys(filesByType) as SectionKey[]).forEach((key) => {
        if (filesByType[key].length > 0) {
          next[key] = expanded;
        }
      });
      return next;
    });
  };

  const renderPreviewByType = () => {
    const imageFiles = filesByType.image;
    const audioFiles = filesByType.audio;
    const videoFiles = filesByType.video;
    const documentFiles = filesByType.document;

    return (
      <>
        {imageFiles.length > 0 && (
          <PreviewSection 
            title="Images" 
            sectionKey="image"
            files={imageFiles} 
            onRemove={onRemove} 
            isUploading={isUploading}
            analyzingFiles={analyzingFiles}
            analysisResults={analysisResults}
            onStartAnalysis={handleStartAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
            currentTheme={currentTheme}
            isDarkMode={isDarkMode}
            isGoogleDriveLink={isGoogleDriveLink}
            getGoogleDriveEmbedUrl={getGoogleDriveEmbedUrl}
            isSectionExpanded={sectionExpandedMap.image}
            onToggleSection={() => toggleSection('image')}
          />
        )}
        
        {audioFiles.length > 0 && (
          <PreviewSection 
            title="Audio Files" 
            sectionKey="audio"
            files={audioFiles} 
            onRemove={onRemove} 
            isUploading={isUploading}
            analyzingFiles={analyzingFiles}
            analysisResults={analysisResults}
            onStartAnalysis={handleStartAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
            currentTheme={currentTheme}
            isDarkMode={isDarkMode}
            isGoogleDriveLink={isGoogleDriveLink}
            getGoogleDriveEmbedUrl={getGoogleDriveEmbedUrl}
            isSectionExpanded={sectionExpandedMap.audio}
            onToggleSection={() => toggleSection('audio')}
          />
        )}
        
        {videoFiles.length > 0 && (
          <PreviewSection 
            title="Videos" 
            sectionKey="video"
            files={videoFiles} 
            onRemove={onRemove} 
            isUploading={isUploading}
            analyzingFiles={analyzingFiles}
            analysisResults={analysisResults}
            onStartAnalysis={handleStartAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
            currentTheme={currentTheme}
            isDarkMode={isDarkMode}
            isGoogleDriveLink={isGoogleDriveLink}
            getGoogleDriveEmbedUrl={getGoogleDriveEmbedUrl}
            isSectionExpanded={sectionExpandedMap.video}
            onToggleSection={() => toggleSection('video')}
          />
        )}
        
        {documentFiles.length > 0 && (
          <PreviewSection 
            title="Documents" 
            sectionKey="document"
            files={documentFiles} 
            onRemove={onRemove} 
            isUploading={isUploading}
            analyzingFiles={analyzingFiles}
            analysisResults={analysisResults}
            onStartAnalysis={handleStartAnalysis}
            onAnalysisComplete={handleAnalysisComplete}
            currentTheme={currentTheme}
            isDarkMode={isDarkMode}
            isGoogleDriveLink={isGoogleDriveLink}
            getGoogleDriveEmbedUrl={getGoogleDriveEmbedUrl}
            isSectionExpanded={sectionExpandedMap.document}
            onToggleSection={() => toggleSection('document')}
          />
        )}
      </>
    );
  };

  if (mediaFiles.length === 0) {
    return null;
  }

  const totalFilesCount = mediaFiles.length;

  return (
    <div className="space-y-3">
      {totalFilesCount > 3 && (
        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-md border px-2 py-1 text-[11px] font-medium"
            style={{
              borderColor: isDarkMode ? '#4B5563' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
              color: isDarkMode ? '#CBD5E1' : '#64748B'
            }}
            onClick={() => setAllSectionsExpanded(true)}
          >
            Expand all
          </button>
          <button
            className="rounded-md border px-2 py-1 text-[11px] font-medium"
            style={{
              borderColor: isDarkMode ? '#4B5563' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
              color: isDarkMode ? '#CBD5E1' : '#64748B'
            }}
            onClick={() => setAllSectionsExpanded(false)}
          >
            Collapse all
          </button>
        </div>
      )}
      {renderPreviewByType()}
    </div>
  );
};

interface PreviewSectionProps {
  title: string;
  sectionKey: SectionKey;
  files: MediaFile[];
  onRemove: (id: string) => void;
  isUploading: boolean;
  analyzingFiles: {[key: string]: boolean};
  analysisResults: {[key: string]: AnalysisResults};
  onStartAnalysis: (fileId: string) => void;
  onAnalysisComplete: (fileId: string, results: AnalysisResults) => void;
  currentTheme: {
    primary: string;
    light: string;
    active: string;
  };
  isDarkMode: boolean;
  isGoogleDriveLink: (url: string) => boolean;
  getGoogleDriveEmbedUrl: (url: string) => string;
  isSectionExpanded: boolean;
  onToggleSection: () => void;
}

const PreviewSection: React.FC<PreviewSectionProps> = ({ 
  title, 
  sectionKey,
  files, 
  onRemove, 
  isUploading, 
  analyzingFiles, 
  analysisResults, 
  onStartAnalysis, 
  onAnalysisComplete,
  currentTheme,
  isDarkMode,
  isGoogleDriveLink,
  getGoogleDriveEmbedUrl,
  isSectionExpanded,
  onToggleSection
}) => {
  const firstFileType = files[0]?.type || 'document';
  const isAudioSection = firstFileType === 'audio';
  const [expandedAudioRows, setExpandedAudioRows] = useState<{[key: string]: boolean}>({});

  const formatFileSize = (bytes: number) => {
    if (!bytes || Number.isNaN(bytes)) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getTotalFilesSizeLabel = () => {
    const total = files.reduce((sum, file) => sum + (file.file?.size || 0), 0);
    return formatFileSize(total);
  };
  
  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image size={16} className="mr-1" style={{ color: currentTheme.primary }} />;
      case 'audio':
        return <Music size={16} className="mr-1" style={{ color: currentTheme.primary }} />;
      case 'video':
        return <Video size={16} className="mr-1" style={{ color: currentTheme.primary }} />;
      case 'document':
        return <FileText size={16} className="mr-1" style={{ color: currentTheme.primary }} />;
      default:
        return null;
    }
  };

  const renderPreviewContent = (file: MediaFile) => {
    const isAnalyzing = analyzingFiles[file.id] || false;
    const hasResults = !!analysisResults[file.id];
    
    // Theme-based colors
    const textColor = isDarkMode ? 'text-gray-200' : 'text-gray-700';
    const secondaryTextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    
    switch (file.type) {
      case 'image': {
        const imageExtension = getFileExtension(file.file.name);

        return (
          <div className="relative">
            <div className="flex items-center mb-1">
              {getMediaTypeIcon('image')}
              <div className={`text-xs font-medium truncate ${textColor}`}>{file.file.name}</div>
            </div>
            
            {/* Fixed image rendering logic */}
            {file.url && isGoogleDriveLink(file.url) ? (
              <iframe
                src={getGoogleDriveEmbedUrl(file.url)}
                className="w-full h-28 rounded"
                allowFullScreen
                title={file.file.name}
              />
            ) : (
              <HeicAwareImagePreview
                file={file}
                imageExtension={imageExtension}
                className="w-full h-28 object-cover rounded"
              />
            )}

            {renderUploadStatus(file)}
            <div className="mt-2">
              <button
                className="text-xs px-2 py-1 rounded flex items-center justify-center w-full"
                style={{ 
                  backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
                  color: isDarkMode ? '#D1D5DB' : '#4B5563'
                }}
                disabled={true}
              >
                Analysis features coming soon
              </button>
            </div>
          </div>
        );
      }
      case 'audio': {
        const isAudioRowExpanded = !!expandedAudioRows[file.id];

        return (
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {getMediaTypeIcon('audio')}
                <div className={`truncate text-xs font-medium ${textColor}`}>{file.file.name}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#F1F5F9',
                    color: isDarkMode ? '#D1D5DB' : '#64748B'
                  }}
                >
                  {formatFileSize(file.file.size)}
                </span>
                <button
                  className="rounded-md border p-1"
                  style={{
                    borderColor: isDarkMode ? '#4B5563' : '#E2E8F0',
                    backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
                    color: isDarkMode ? '#CBD5E1' : '#64748B'
                  }}
                  onClick={() =>
                    setExpandedAudioRows((prev) => ({
                      ...prev,
                      [file.id]: !prev[file.id]
                    }))
                  }
                  aria-label={isAudioRowExpanded ? 'Collapse audio file options' : 'Expand audio file options'}
                >
                  {isAudioRowExpanded ? <ChevronUp size={13} /> : <Menu size={13} />}
                </button>
              </div>
            </div>

            {isAudioRowExpanded && (
              <div className="mt-2.5 space-y-2">
                {file.url && isGoogleDriveLink(file.url) ? (
                  <iframe
                    src={getGoogleDriveEmbedUrl(file.url)}
                    className="h-20 w-full rounded"
                    allow="autoplay"
                    title={file.file.name}
                  />
                ) : (
                  <audio 
                    controls 
                    className="h-9 w-full"
                    src={file.url || (file.file instanceof Blob ? URL.createObjectURL(file.file) : file.file)}
                  >
                    Your browser does not support the audio element.
                  </audio>
                )}

                {renderUploadStatus(file)}
                <div className="flex items-center justify-end gap-2">
                  {!hasResults && (
                    <button
                      className="flex items-center justify-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={{ 
                        backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
                        borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                        color: isAnalyzing ? (isDarkMode ? '#9CA3AF' : '#94A3B8') : (isDarkMode ? '#E5E7EB' : '#334155')
                      }}
                      onClick={() => !isAnalyzing && onStartAnalysis(file.id)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader size={14} className="mr-1 animate-spin" /> 
                          Analyzing...
                        </>
                      ) : (
                        'Analyze'
                      )}
                    </button>
                  )}

                  {!isUploading && file.status !== 'uploading' && (
                    <button
                      className="flex items-center justify-center rounded-md border px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
                        borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                        color: isDarkMode ? '#FCA5A5' : '#DC2626'
                      }}
                      onClick={() => onRemove(file.id)}
                      aria-label="Remove file"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Only render AudioAnalyzer ONCE during analysis, hidden */}
                {isAnalyzing && (
                  <div className="hidden">
                    <AudioAnalyzer
                      audioFile={file.file}
                      onAnalysisComplete={(results) => onAnalysisComplete(file.id, results)}
                    />
                  </div>
                )}

                {/* After analysis, show the full tabbed results view */}
                {hasResults && analysisResults[file.id] && (
                  <div className="w-full">
                    <AudioAnalysisDisplay results={analysisResults[file.id]!} />
                  </div>
                )}
              </div>
            )}

            {/* Keep analyzer mounted while running even when row is collapsed */}
            {!isAudioRowExpanded && isAnalyzing && (
              <div className="hidden">
                <AudioAnalyzer
                  audioFile={file.file}
                  onAnalysisComplete={(results) => onAnalysisComplete(file.id, results)}
                />
              </div>
            )}
          </div>
        );
      }
      case 'video':
        return (
          <div className="relative">
            <div className="flex items-center mb-1">
              {getMediaTypeIcon('video')}
              <div className={`text-xs font-medium truncate ${textColor}`}>{file.file.name}</div>
            </div>
            
            {file.url && isGoogleDriveLink(file.url) ? (
              <iframe
                src={getGoogleDriveEmbedUrl(file.url)}
                className="w-full h-40 rounded"
                allowFullScreen
                title={file.file.name}
              />
            ) : (
              <video 
                controls 
                className="w-full h-40 rounded"
                src={file.url || (file.file instanceof Blob ? URL.createObjectURL(file.file) : file.file)}
              >
                Your browser does not support the video element.
              </video>
            )}
            
            {renderUploadStatus(file)}
            <div className="mt-2">
              <button
                className="text-xs px-2 py-1 rounded flex items-center justify-center w-full"
                style={{ 
                  backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
                  color: isDarkMode ? '#D1D5DB' : '#4B5563'
                }}
                disabled={true}
              >
                Analysis features coming soon
              </button>
            </div>
          </div>
        );
      case 'document':
        return (
          <div className="flex flex-col">
            <div className="flex items-center mb-1">
              {getMediaTypeIcon('document')}
              <div className={`text-xs font-medium truncate ${textColor}`}>{file.file.name}</div>
            </div>
            <div className={`text-xs ${secondaryTextColor}`}>
              {(file.file.size / 1024).toFixed(2)} KB
            </div>
            {renderUploadStatus(file)}
            <div className="mt-2">
              <button
                className="text-xs px-2 py-1 rounded flex items-center justify-center w-full"
                style={{ 
                  backgroundColor: isDarkMode ? '#374151' : '#E5E7EB',
                  color: isDarkMode ? '#D1D5DB' : '#4B5563'
                }}
                disabled={true}
              >
                Analysis features coming soon
              </button>
            </div>
          </div>
        );
    }
  };

  const renderUploadStatus = (file: MediaFile) => {
    const secondaryTextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    
    if (file.status === 'uploading') {
      return (
        <div className="mt-2">
          <div className="w-full rounded-full h-2" style={{ backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }}>
            <div 
              className="h-2 rounded-full transition-all duration-300 ease-in-out" 
              style={{ 
                width: `${file.progress}%`,
                backgroundColor: currentTheme.primary
              }}
            ></div>
          </div>
          <div className={`text-xs ${secondaryTextColor} mt-1 flex items-center`}>
            <RefreshCw size={12} className="mr-1 animate-spin" />
            {file.progress}% uploaded
          </div>
        </div>
      );
    } else if (file.status === 'success') {
      return (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: isDarkMode ? 'rgba(34,197,94,0.16)' : 'rgba(34,197,94,0.12)', color: isDarkMode ? '#86EFAC' : '#15803D' }}>
          <Check size={12} />
          Added to journal
        </div>
      );
    } else if (file.status === 'error') {
      return (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: isDarkMode ? 'rgba(248,113,113,0.14)' : 'rgba(248,113,113,0.12)', color: isDarkMode ? '#FCA5A5' : '#B91C1C' }}>
          <X size={12} />
          Upload failed
        </div>
      );
    }
    return null;
  };

  const bgCardColor = isDarkMode ? 'bg-slate-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-slate-100' : 'text-slate-800';
  const shadowClass = isDarkMode ? 'shadow-black/30' : 'shadow-sm';

  if (files.length === 0) return null;

  return (
    <div
      className={`border p-3 ${isAudioSection ? 'rounded-2xl' : 'rounded-lg'} ${bgCardColor} ${shadowClass}`}
      style={{
        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
        backgroundColor: isAudioSection ? (isDarkMode ? '#0F172A' : '#FAFAFA') : undefined
      }}
    >
      <div className="relative mb-3 pr-9">
        <h3 className={`font-medium flex items-center ${textColor}`}>
          {getMediaTypeIcon(firstFileType)}
          {title} ({files.length})
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#F1F5F9',
              color: isDarkMode ? '#CBD5E1' : '#64748B'
            }}
          >
            {getTotalFilesSizeLabel()}
          </span>
        </h3>

        <button
          className="absolute right-0 top-0 rounded-md border p-1"
          style={{
            borderColor: isDarkMode ? '#4B5563' : '#E2E8F0',
            backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
            color: isDarkMode ? '#CBD5E1' : '#64748B'
          }}
          onClick={onToggleSection}
          aria-label={isSectionExpanded ? `Collapse ${sectionKey} section` : `Expand ${sectionKey} section`}
        >
          {isSectionExpanded ? <ChevronUp size={13} /> : <Menu size={13} />}
        </button>
      </div>

      {isSectionExpanded && (
        <div className={`grid ${firstFileType === 'image' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'} ${isAudioSection ? 'gap-2' : 'gap-4'}`}>
        {files.map((file) => (
          <div 
            key={file.id} 
            className={`relative border transition-shadow duration-200 ${firstFileType === 'audio' ? 'rounded-xl p-2' : 'rounded p-3'}`}
            style={{ 
              borderColor: isAudioSection ? (isDarkMode ? '#475569' : '#E2E8F0') : (isDarkMode ? '#334155' : '#E5E7EB'),
              backgroundColor: isAudioSection ? (isDarkMode ? '#111827' : '#FFFFFF') : (isDarkMode ? '#111827' : '#FFFFFF'),
              boxShadow: firstFileType === 'audio' ? (isDarkMode ? '0 1px 2px rgba(0,0,0,0.28)' : '0 1px 2px rgba(15,23,42,0.04)') : undefined
            }}
          >
            {!isAudioSection && !isUploading && file.status !== 'uploading' && (
              <button 
                className="absolute right-2 top-2 z-10 rounded-full p-1 transition-colors duration-200"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#F1F5F9',
                  color: isDarkMode ? '#CBD5E1' : '#64748B'
                }}
                onClick={() => onRemove(file.id)}
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            )}
            {renderPreviewContent(file)}
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default MediaPreview;