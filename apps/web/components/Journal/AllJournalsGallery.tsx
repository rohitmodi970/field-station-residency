"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { format } from "date-fns"
import { CalendarIcon, ArrowRightIcon as ArrowsMaximize, ArrowLeftIcon as ArrowsMinimize, Info, Loader2, Trash2, X, Filter, Images, Calendar as CalendarComponent, Grid3x3, LayoutGrid, Maximize2, ChevronLeft, ChevronRight, RefreshCw, Search, SortAsc, Zap, BookOpen, Move, ZoomIn } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "../ui/quilted-gallery/ui/badge"
import { Alert, AlertDescription } from "../ui/quilted-gallery/ui/alert"
import { Card, CardContent } from "../ui/quilted-gallery/ui/card"
import { Button } from "../ui/quilted-gallery/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/quilted-gallery/ui/popover"
import { Calendar } from "../ui/quilted-gallery/ui/calendar"
import { Label } from "../ui/quilted-gallery/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/quilted-gallery/ui/tooltip"
import { useTheme } from "@/utilities/context/ThemeContext"
import DeleteConfirmDialog from "./quiltedgalleryComponent/DeleteConfirmDialog"
import GoogleDriveEmbed from "./quiltedgalleryComponent/GoogleDriveEmbed"

// ─── In-memory cache (survives navigation, cleared on full page reload) ───
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const journalIdsCache: { entry: CacheEntry<string[]> | null } = { entry: null }
const mediaCache = new Map<string, CacheEntry<ImageItem[]>>()

function getCachedJournalIds(): string[] | null {
  if (!journalIdsCache.entry) return null
  if (Date.now() - journalIdsCache.entry.timestamp > CACHE_TTL) {
    journalIdsCache.entry = null
    return null
  }
  return journalIdsCache.entry.data
}

function setCachedJournalIds(ids: string[]) {
  journalIdsCache.entry = { data: ids, timestamp: Date.now() }
}

function getCachedMedia(journalId: string): ImageItem[] | null {
  const entry = mediaCache.get(journalId)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    mediaCache.delete(journalId)
    return null
  }
  return entry.data
}

function setCachedMedia(journalId: string, images: ImageItem[]) {
  mediaCache.set(journalId, { data: images, timestamp: Date.now() })
}

function invalidateMediaCache(journalId: string) {
  mediaCache.delete(journalId)
}

function dedupeImagesById(images: ImageItem[]): ImageItem[] {
  const byId = new Map<string, ImageItem>()
  for (const image of images) {
    byId.set(image.id, image)
  }
  return Array.from(byId.values())
}

interface ImageItem {
  id: string
  src: string
  title: string
  cols: number
  rows: number
  uploadDate: Date
  importance: number
  driveFileId: string
  mimeType?: string
  thumbnailLink?: string
  thumbnailUrl?: string
  journalId: string
}

interface MediaApiResponse {
  media?: Array<{
    id?: number
    journal_id?: number
    user_id?: string
    file_name?: string
    original_name?: string
    mime_type?: string
    file_size?: number
    media_type?: string
    storage_provider?: string
    path?: string
    bucket?: string
    url?: string
    signed_url?: string
    public_url?: string
    thumbnail_link?: string
    thumbnail_url?: string
    drive_file_id?: string
    drive_mime_type?: string
    upload_status?: string
    uploaded_at?: string
    created_at?: string
    driveFileId?: string
    driveMimeType?: string
    uploadedAt?: string
    thumbnailLink?: string
    _id?: string
  }>
  error?: string
}

interface JournalIdsResponse {
  journalIds: string[]
  error?: string
}

interface LoadingProgress {
  loaded: number
  total: number
}

// Sortable image component
const SortableImage = ({
  image,
  onSizeChange,
  onDelete,
  onFullscreen,
  onAspectRatioDetected,
}: {
  image: ImageItem
  onSizeChange: (id: string, size: "small" | "medium" | "large") => void
  onDelete: () => void
  onFullscreen: () => void
  onAspectRatioDetected: (id: string, ratio: number) => void
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const { currentTheme, isDarkMode } = useTheme()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${image.cols}`,
    gridRow: `span ${image.rows}`,
    zIndex: isDragging ? 10 : 0,
  }

  const currentSize =
    image.cols === 1 && image.rows === 1 ? "small" : image.cols === 2 && image.rows === 1 ? "medium" : "large"

  const canEnlarge = currentSize === "small" || currentSize === "medium"
  const canShrink = currentSize === "medium" || currentSize === "large"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative overflow-hidden rounded-xl border-2 group cursor-grab transition-all duration-300 ${
        isDragging ? 'opacity-70 shadow-2xl scale-105' : 'hover:shadow-xl'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Hidden probe: detects natural aspect ratio once thumbnail loads */}
      {image.thumbnailUrl && (
        <img
          src={image.thumbnailUrl}
          alt=""
          style={{ display: 'none', position: 'absolute' }}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget
            if (naturalWidth && naturalHeight) {
              onAspectRatioDetected(image.id, naturalWidth / naturalHeight)
            }
          }}
        />
      )}
      <div className="absolute inset-0">
        <GoogleDriveEmbed
          id={image.id}
          src={image.src}
          driveFileId={image.driveFileId}
          title={image.title}
          thumbnailUrl={image.thumbnailUrl}
        />
      </div>

      {/* Gradient overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* Image info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 text-white transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <div className="font-semibold text-sm md:text-base line-clamp-1">{image.title}</div>
        <div className="text-xs text-gray-300 flex items-center gap-1.5 mt-1">
          <CalendarIcon className="h-3 w-3" />
          {format(image.uploadDate, "MMM d, yyyy")}
        </div>
      </div>

      {/* Control buttons */}
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 md:p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onFullscreen()
                }}
              >
                <Maximize2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View fullscreen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {canEnlarge && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 md:p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSizeChange(image.id, currentSize === "small" ? "medium" : "large")
                  }}
                >
                  <ArrowsMaximize className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enlarge image</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {canShrink && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 md:p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSizeChange(image.id, currentSize === "large" ? "medium" : "small")
                  }}
                >
                  <ArrowsMinimize className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Shrink image</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1.5 md:p-2 rounded-lg bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete image</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Importance indicator */}
      {image.importance > 1 && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Badge 
            variant="secondary" 
            className="text-xs bg-black/60 text-white border-none backdrop-blur-sm"
          >
            {image.importance === 3 ? "High" : "Medium"} Priority
          </Badge>
        </div>
      )}
    </div>
  )
}

// Date picker component
function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
}: {
  startDate: Date | undefined
  endDate: Date | undefined
  onStartDateChange: (date: Date | undefined) => void
  onEndDateChange: (date: Date | undefined) => void
  minDate: Date
  maxDate: Date
}) {
  const { currentTheme, elementColors } = useTheme()

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="grid gap-2 flex-1">
        <Label htmlFor="start-date" style={{ color: elementColors.text }}>Start Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="start-date"
              variant="outline"
              className={`w-full justify-start text-left font-normal ${!startDate ? 'text-muted-foreground' : ''}`}
              style={{ 
                borderColor: currentTheme.medium,
                backgroundColor: elementColors.background
              }}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMMM d, yyyy") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartDateChange}
              initialFocus
              fromDate={minDate}
              toDate={maxDate}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid gap-2 flex-1">
        <Label htmlFor="end-date" style={{ color: elementColors.text }}>End Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="end-date"
              variant="outline"
              className={`w-full justify-start text-left font-normal ${!endDate ? 'text-muted-foreground' : ''}`}
              style={{ 
                borderColor: currentTheme.medium,
                backgroundColor: elementColors.background
              }}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMMM d, yyyy") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              initialFocus
              fromDate={startDate || minDate}
              toDate={maxDate}
            />
          </PopoverContent>
        </Popover>
      </div>
      {(startDate || endDate) && (
        <Button
          variant="ghost"
          className="h-10 px-3 mt-auto"
          onClick={() => {
            onStartDateChange(undefined)
            onEndDateChange(undefined)
          }}
          style={{ color: currentTheme.primary }}
        >
          Reset
        </Button>
      )}
    </div>
  )
}

// Combined Gallery component
function CombinedGallery({ journalIds }: { journalIds: string[] }) {
  const [allImages, setAllImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    loaded: 0,
    total: journalIds.length
  })
  const { currentTheme, isDarkMode, elementColors } = useTheme()

  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [showFilters, setShowFilters] = useState(false)

  const [arrangedImageIds, setArrangedImageIds] = useState<string[]>([])

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<ImageItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<ImageItem | null>(null)

  // Search, sort, tips, refresh
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'importance'>('newest')
  const [tipsDismissed, setTipsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gallery-tips-dismissed') === 'true'
    }
    return false
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartX = useRef<number>(0)
  // Track which images have already had their aspect ratio auto-detected
  // so we don't repeatedly overwrite user manual resizes
  const detectedAspectRatios = useRef<Set<string>>(new Set())

  const handleAspectRatioDetected = useCallback((id: string, ratio: number) => {
    if (detectedAspectRatios.current.has(id)) return
    detectedAspectRatios.current.add(id)
    setAllImages(prev => prev.map(img => {
      if (img.id !== id) return img
      let cols = 1
      let rows = 1
      if (ratio >= 1.6) {
        // Landscape: wide photo → 2 cols
        cols = 2
        rows = img.importance === 3 ? 2 : 1
      } else if (ratio < 0.75) {
        // Portrait: tall photo → 2 rows
        cols = 1
        rows = 2
      } else {
        // Square-ish
        cols = img.importance >= 2 ? 2 : 1
        rows = img.importance === 3 ? 2 : 1
      }
      return { ...img, cols, rows }
    }))
  }, [])

  const handleDismissTips = () => {
    setTipsDismissed(true)
    localStorage.setItem('gallery-tips-dismissed', 'true')
  }

  const handleRefresh = useCallback(() => {
    journalIds.forEach(id => invalidateMediaCache(id))
    setAllImages([])
    setLoading(true)
    setIsRefreshing(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setIsRefreshing(false), 800)
  }, [journalIds])

  const handleFullscreenOpen = (image: ImageItem) => {
    setFullscreenImage(image)
    setIsFullscreen(true)
    document.body.style.overflow = 'hidden'
  }

  const handleFullscreenClose = () => {
    setIsFullscreen(false)
    setFullscreenImage(null)
    document.body.style.overflow = 'unset'
  }

  const dateRange = useMemo(() => {
    if (allImages.length === 0) {
      return { min: new Date(), max: new Date() }
    }

    const dates = allImages.map(img => img.uploadDate)
    const min = new Date(Math.min(...dates.map(d => d.getTime())))
    const max = new Date(Math.max(...dates.map(d => d.getTime())))

    return { min, max }
  }, [allImages])

  const filteredImages = useMemo(() => {
    let result = allImages.filter((image) => {
      // Date filter
      if (startDate || endDate) {
        const imageDate = new Date(image.uploadDate)
        const start = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null
        const end = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59) : null

        if (start && end && !(imageDate >= start && imageDate <= end)) return false
        if (start && !end && imageDate < start) return false
        if (!start && end && imageDate > end) return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!image.title.toLowerCase().includes(q) && !image.journalId.toLowerCase().includes(q)) {
          return false
        }
      }

      return true
    })

    // Sort
    result = [...result].sort((a, b) => {
      if (sortOrder === 'oldest') return a.uploadDate.getTime() - b.uploadDate.getTime()
      if (sortOrder === 'importance') return b.importance - a.importance
      return b.uploadDate.getTime() - a.uploadDate.getTime() // newest (default)
    })

    return result
  }, [allImages, startDate, endDate, searchQuery, sortOrder])

  useEffect(() => {
    setArrangedImageIds(filteredImages.map((img) => img.id))
  }, [filteredImages])

  const arrangedImages = useMemo(() => {
    const imageMap = new Map(filteredImages.map((img) => [img.id, img]))
    return arrangedImageIds.map((id) => imageMap.get(id)).filter((img): img is ImageItem => img !== undefined)
  }, [filteredImages, arrangedImageIds])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isFullscreen || !fullscreenImage) return
      
      if (e.key === 'Escape') {
        handleFullscreenClose()
      } else if (e.key === 'ArrowLeft') {
        const currentIndex = arrangedImages.findIndex(img => img.id === fullscreenImage.id)
        if (currentIndex > 0 && arrangedImages[currentIndex - 1]) {
          setFullscreenImage(arrangedImages[currentIndex - 1] ?? null)
        }
      } else if (e.key === 'ArrowRight') {
        const currentIndex = arrangedImages.findIndex(img => img.id === fullscreenImage.id)
        if (currentIndex < arrangedImages.length - 1 && arrangedImages[currentIndex + 1]) {
          setFullscreenImage(arrangedImages[currentIndex + 1] ?? null)
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isFullscreen, fullscreenImage, arrangedImages])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const activeImage = allImages.find((img) => img.id === active.id)
      const overImage = allImages.find((img) => img.id === over.id)

      if (activeImage && overImage) {
        setArrangedImageIds((items) => {
          const oldIndex = items.indexOf(active.id.toString())
          const newIndex = items.indexOf(over.id.toString())

          if (oldIndex !== -1 && newIndex !== -1) {
            return arrayMove(items, oldIndex, newIndex)
          }
          return items
        })

        setAllImages((currentImages) => {
          return currentImages.map((img) => {
            if (img.id === active.id) {
              return { ...img, cols: overImage.cols, rows: overImage.rows }
            }
            if (img.id === over.id) {
              return { ...img, cols: activeImage.cols, rows: activeImage.rows }
            }
            return img
          })
        })
      }
    }
  }

  const handleSizeChange = (id: string, size: "small" | "medium" | "large") => {
    setAllImages((currentImages) => {
      return currentImages.map((img) => {
        if (img.id === id) {
          if (size === "small") {
            return { ...img, cols: 1, rows: 1 }
          } else if (size === "medium") {
            return { ...img, cols: 2, rows: 1 }
          } else {
            return { ...img, cols: 2, rows: 2 }
          }
        }
        return img
      })
    })
  }

  const handleDeleteImage = async () => {
    if (!imageToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/journal/media', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journal_id: imageToDelete.journalId,
          file_id: imageToDelete.driveFileId,
          media_type: 'image'
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Invalidate cache for this journal
        invalidateMediaCache(imageToDelete.journalId)
        setAllImages(currentImages =>
          currentImages.filter(img => img.id !== imageToDelete.id)
        )
        setArrangedImageIds(currentIds =>
          currentIds.filter(id => id !== imageToDelete.id)
        )
        setDeleteDialogOpen(false)
        setImageToDelete(null)
      } else {
        throw new Error(data.error || 'Failed to delete image')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete image')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteClick = (image: ImageItem) => {
    setImageToDelete(image)
    setDeleteDialogOpen(true)
  }

  // Helper: transform API response into ImageItem[]
  const transformMedia = useCallback((journalId: string, data: MediaApiResponse): ImageItem[] => {
    if (!data.media || data.media.length === 0) return []
    const seenSourceKeys = new Set<string>()
    const idCounts = new Map<string, number>()
    const transformed: ImageItem[] = []

    for (const item of data.media) {
      const sourceKey = [
        item.id ?? '',
        item.driveFileId ?? item.drive_file_id ?? '',
        item.path ?? '',
        item.url ?? item.public_url ?? item.signed_url ?? '',
      ].join('|')
      const hasStableIdentity = Boolean(
        item.id || item.driveFileId || item.drive_file_id || item.path || item.url || item.public_url || item.signed_url,
      )

      // API can occasionally return duplicated media rows for the same journal.
      if (hasStableIdentity && seenSourceKeys.has(sourceKey)) {
        continue
      }
      if (hasStableIdentity) {
        seenSourceKeys.add(sourceKey)
      }

      const index = transformed.length
      const imageUrl = item.signed_url || item.public_url || item.url || item.thumbnailLink || ''
      const thumbnailUrl = item.thumbnail_url || item.thumbnailLink || item.thumbnail_link || imageUrl
      const uploadDate = new Date(item.uploadedAt || item.uploaded_at || Date.now())
      const importance = index < 2 ? 3 : index < 5 ? 2 : 1
      const cols = importance === 3 ? 2 : importance === 2 ? 2 : 1
      const rows = importance === 3 ? 2 : importance === 2 ? 1 : 1

      const baseIdPart = item.id || item.driveFileId || item.drive_file_id || item._id || `${item.file_name || 'image'}-${index}`
      const baseId = `${journalId}-${baseIdPart}`
      const existingCount = idCounts.get(baseId) || 0
      idCounts.set(baseId, existingCount + 1)
      const uniqueId = existingCount === 0 ? baseId : `${baseId}-${existingCount}`

      transformed.push({
        id: uniqueId,
        src: imageUrl,
        title: item.original_name || item.file_name || `Journal ${journalId} — Image ${index + 1}`,
        cols,
        rows,
        uploadDate,
        importance,
        driveFileId: item.driveFileId || item.drive_file_id || null,
        mimeType: item.driveMimeType || item.mime_type || item.media_type,
        thumbnailUrl,
        thumbnailLink: thumbnailUrl,
        journalId
      } as ImageItem)
    }

    return transformed
  }, [])

  // ─── Progressive loading with caching ───
  //
  // This uses "Incremental / Progressive Loading" — each journal's images
  // are appended to state as soon as they arrive so the UI renders
  // progressively instead of waiting for ALL journals to finish.
  //
  // Combined with an in-memory cache, returning to this page after
  // navigation shows cached data instantly (stale-while-revalidate).
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const fetchAllImages = async () => {
      try {
        setError(null)

        // ── Phase 1: Restore from cache instantly ──
        const cachedImages: ImageItem[] = []
        const journalsToFetch: string[] = []

        for (const journalId of journalIds) {
          const cached = getCachedMedia(journalId)
          if (cached) {
            cachedImages.push(...cached)
          } else {
            journalsToFetch.push(journalId)
          }
        }

        // If we have ANY cached data, show it immediately
        if (cachedImages.length > 0 && isMounted) {
          const dedupedCachedImages = dedupeImagesById(cachedImages)
          dedupedCachedImages.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime())
          setAllImages(dedupedCachedImages)
          setLoading(false) // Stop showing full-page loader
        }

        // If everything was cached, we're done
        if (journalsToFetch.length === 0) {
          if (isMounted) {
            setLoading(false)
            setLoadingProgress({ loaded: journalIds.length, total: journalIds.length })
          }
          return
        }

        // ── Phase 2: Fetch remaining journals incrementally ──
        let loadedCount = journalIds.length - journalsToFetch.length
        if (isMounted) {
          setLoadingProgress({ loaded: loadedCount, total: journalIds.length })
        }

        // Process in small concurrent batches for speed
        const BATCH_SIZE = 3
        for (let i = 0; i < journalsToFetch.length; i += BATCH_SIZE) {
          if (!isMounted || controller.signal.aborted) break

          const batch = journalsToFetch.slice(i, i + BATCH_SIZE)
          const results = await Promise.allSettled(
            batch.map(async (journalId) => {
              const response = await fetch(
                `/api/journal/media?journal_id=${journalId}&media_type=image`,
                { signal: controller.signal }
              )
              if (!response.ok) {
                console.warn(`Failed to fetch images for journal ${journalId}: ${response.status}`)
                return { journalId, images: [] as ImageItem[] }
              }
              const data: MediaApiResponse = await response.json()
              const images = transformMedia(journalId, data)
              return { journalId, images }
            })
          )

          // ── Incremental append: render each batch as it arrives ──
          const newImages: ImageItem[] = []
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.images.length > 0) {
              setCachedMedia(result.value.journalId, result.value.images)
              newImages.push(...result.value.images)
            }
          }

          loadedCount += batch.length

          if (isMounted && newImages.length > 0) {
            // Append new images and re-sort
            setAllImages(prev => {
              const combined = dedupeImagesById([...prev, ...newImages])
              combined.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime())
              return combined
            })
          }

          if (isMounted) {
            setLoadingProgress({ loaded: loadedCount, total: journalIds.length })
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Error fetching all images:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load images')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (journalIds.length > 0) {
      fetchAllImages()
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [journalIds, transformMedia, refreshKey])

  // Show full-page loader only when we have ZERO images AND are still loading
  const showFullLoader = loading && allImages.length === 0
  // Show inline progress bar when we have SOME images but still fetching more
  const showInlineProgress = loadingProgress.loaded < loadingProgress.total && allImages.length > 0

  if (showFullLoader) {
    const skeletonSizes = [
      { cols: 2, rows: 2 }, { cols: 1, rows: 1 }, { cols: 1, rows: 2 },
      { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 1, rows: 1 },
      { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 1, rows: 1 },
    ]
    return (
      <div className="space-y-8 px-3 sm:px-4 md:px-6 animate-in fade-in duration-500">
        {/* Progress header */}
        <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: currentTheme.medium }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg animate-pulse" style={{ backgroundColor: currentTheme.light }}>
              <Images className="h-5 w-5" style={{ color: currentTheme.primary }} />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-28 rounded animate-pulse" style={{ backgroundColor: currentTheme.light }} />
              <div className="h-3 w-20 rounded animate-pulse" style={{ backgroundColor: currentTheme.light }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: currentTheme.primary }} />
            <span className="text-xs text-muted-foreground">
              {loadingProgress.loaded}/{loadingProgress.total} journals
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ backgroundColor: currentTheme.primary, width: `${Math.max(8, (loadingProgress.loaded / Math.max(loadingProgress.total, 1)) * 100)}%` }}
          />
        </div>

        {/* Skeleton masonry grid */}
        <div
          className="grid gap-3 md:gap-4 auto-rows-[120px] sm:auto-rows-[140px] md:auto-rows-[160px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {skeletonSizes.map((size, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{
                gridColumn: `span ${size.cols}`,
                gridRow: `span ${size.rows}`,
                backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6',
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div
                className="w-full h-full animate-pulse"
                style={{
                  background: isDarkMode
                    ? `linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)`
                    : `linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)`,
                  backgroundSize: '200% 100%',
                  animation: `shimmer 1.5s infinite ${i * 0.1}s`,
                }}
              />
            </div>
          ))}
        </div>

        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <Alert 
          variant="destructive" 
          className="max-w-2xl mx-auto border-2 rounded-xl"
          style={{ 
            borderColor: '#EF4444',
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <AlertDescription className="flex items-start gap-3" style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}>
            <X className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="font-semibold">Error Loading Gallery</strong>
              <p className="mt-1">{error}</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 px-3 sm:px-4 md:px-6">
      {/* Sticky Header Bar */}
      <div 
        className="sticky top-0 z-30 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-4 backdrop-blur-lg border-b transition-all duration-300"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: currentTheme.medium
        }}
      >
        {/* Row 1: title + controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: currentTheme.light }}
            >
              <Images 
                className="h-5 w-5 md:h-6 md:w-6" 
                style={{ color: currentTheme.primary }}
              />
            </div>
            <div>
              <h2 
                className="text-lg md:text-xl font-bold"
                style={{ color: elementColors.text }}
              >
                Photo Gallery
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground">
                {allImages.length} photos • {journalIds.length} journals
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge 
              variant="secondary" 
              className="px-3 py-1.5 text-xs md:text-sm font-medium"
              style={{ 
                backgroundColor: currentTheme.light,
                color: currentTheme.primary,
                border: `1px solid ${currentTheme.medium}`
              }}
            >
              <LayoutGrid className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
              {filteredImages.length} visible
            </Badge>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              title="Refresh gallery"
              className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: showFilters ? currentTheme.primary : currentTheme.light,
                color: showFilters ? '#fff' : currentTheme.primary
              }}
            >
              <Filter className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Filters</span>
              {(startDate || endDate) && (
                <span className="w-2 h-2 rounded-full bg-white ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: search + sort */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: currentTheme.primary }}  
            />
            <input
              type="text"
              placeholder="Search photos…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: elementColors.background,
                borderColor: currentTheme.medium,
                color: elementColors.text,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: currentTheme.primary }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <SortAsc className="h-4 w-4 shrink-0" style={{ color: currentTheme.primary }} />
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest' | 'importance')}
              className="text-sm rounded-lg border px-3 py-2 outline-none transition-all cursor-pointer text-black"
              style={{
                backgroundColor: elementColors.background,
                borderColor: currentTheme.medium,
                color: elementColors.text,
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="importance">By importance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inline progress bar — shown while images are progressively loading */}
      {showInlineProgress && (
        <div className="flex items-center gap-3 px-1">
          <Loader2 
            className="h-4 w-4 animate-spin shrink-0" 
            style={{ color: currentTheme.primary }}
          />
          <div className="flex-1">
            <div 
              className="w-full rounded-full h-1.5 overflow-hidden"
              style={{ backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  backgroundColor: currentTheme.primary,
                  width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` 
                }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {loadingProgress.loaded}/{loadingProgress.total} journals
          </span>
        </div>
      )}

      {/* Collapsible Filters */}
      {showFilters && (
        <Card 
          className="border-2 rounded-xl overflow-hidden animate-in slide-in-from-top duration-300"
          style={{ 
            backgroundColor: elementColors.background,
            borderColor: currentTheme.medium
          }}
        >
          <CardContent className="p-4 md:p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" style={{ color: currentTheme.primary }} />
                <h3 className="font-semibold" style={{ color: elementColors.text }}>Date Range Filter</h3>
              </div>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                minDate={dateRange.min}
                maxDate={dateRange.max}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {arrangedImages.length === 0 && (
        <Card 
          className="border-2 border-dashed rounded-2xl"
          style={{ 
            borderColor: currentTheme.medium,
            backgroundColor: elementColors.background
          }}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 md:py-20 px-4">
            <div 
              className="p-4 md:p-6 rounded-full mb-6"
              style={{ backgroundColor: currentTheme.light }}
            >
              <CalendarComponent 
                className="h-10 w-10 md:h-12 md:w-12" 
                style={{ color: currentTheme.medium }}
              />
            </div>
            <h3 
              className="text-lg md:text-xl font-bold mb-3"
              style={{ color: elementColors.text }}
            >
              No photos found
            </h3>
            <p className="text-sm md:text-base text-muted-foreground text-center max-w-md">
              {startDate || endDate ?
                "No photos match your selected date range. Try adjusting the filters." :
                "No photos available in your journals yet."
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gallery Grid */}
      {arrangedImages.length > 0 && (
        <div className="space-y-6">
          {/* Instructions Card — dismissible */}
          {!tipsDismissed && (
          <Card 
            className="border rounded-xl"
            style={{ 
              backgroundColor: `${currentTheme.light}40`,
              borderColor: currentTheme.medium
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info 
                  className="h-5 w-5 mt-0.5 flex-shrink-0" 
                  style={{ color: currentTheme.primary }}
                />
                <div className="space-y-2 flex-1">
                  <p 
                    className="text-sm md:text-base font-semibold"
                    style={{ color: elementColors.text }}
                  >
                    Gallery Tips
                  </p>
                  <div 
                    className="text-xs md:text-sm space-y-1"
                    style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                  >
                    <p>• Drag photos to reposition • Hover for resize/delete options • Filter by date range • Search by name</p>
                  </div>
                </div>
                <button
                  onClick={handleDismissTips}
                  className="p-1 rounded-md hover:bg-black/10 transition-colors flex-shrink-0"
                  title="Dismiss tips"
                  style={{ color: currentTheme.primary }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Masonry Grid */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={arrangedImageIds} strategy={rectSortingStrategy}>
              <div
                className="grid gap-3 md:gap-4 auto-rows-[120px] sm:auto-rows-[140px] md:auto-rows-[160px] lg:auto-rows-[180px]"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                }}
              >
                {arrangedImages.map((image) => (
                  <SortableImage
                    key={image.id}
                    image={image}
                    onSizeChange={handleSizeChange}
                    onDelete={() => handleDeleteClick(image)}
                    onFullscreen={() => handleFullscreenOpen(image)}
                    onAspectRatioDetected={handleAspectRatioDetected}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Footer Stats */}
          {/* <Card
            className="border rounded-xl"
            style={{ 
              backgroundColor: elementColors.background,
              borderColor: currentTheme.medium
            }}
          >
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs md:text-sm" style={{ color: elementColors.text }}>
                  Showing <span className="font-bold">{arrangedImages.length}</span> of <span className="font-bold">{allImages.length}</span> photos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${currentTheme.primary}10`,
                      borderColor: currentTheme.medium,
                      color: currentTheme.primary
                    }}
                  >
                    Small: 1×1
                  </Badge>
                  <Badge 
                    variant="outline"
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${currentTheme.primary}10`,
                      borderColor: currentTheme.medium,
                      color: currentTheme.primary
                    }}
                  >
                    Medium: 2×1
                  </Badge>
                  <Badge 
                    variant="outline"
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${currentTheme.primary}10`,
                      borderColor: currentTheme.medium,
                      color: currentTheme.primary
                    }}
                  >
                    Large: 2×2
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && fullscreenImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          onClick={handleFullscreenClose}
          onTouchStart={(e) => { if (e.touches[0]) touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            const delta = (e.changedTouches[0] ? touchStartX.current - e.changedTouches[0].clientX : 0)
            if (Math.abs(delta) < 50) return
            const currentIndex = arrangedImages.findIndex(img => img.id === fullscreenImage.id)
            if (delta > 0 && currentIndex < arrangedImages.length - 1) {
              setFullscreenImage(arrangedImages[currentIndex + 1] ?? null)
            } else if (delta < 0 && currentIndex > 0) {
              setFullscreenImage(arrangedImages[currentIndex - 1] ?? null)
            }
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
            {/* Close button */}
            <button
              onClick={handleFullscreenClose}
              className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            
            {/* Navigation arrows */}
            {arrangedImages.findIndex(img => img.id === fullscreenImage.id) > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const currentIndex = arrangedImages.findIndex(img => img.id === fullscreenImage.id)
                  const prevImage = arrangedImages[currentIndex - 1]
                  if (prevImage) {
                    setFullscreenImage(prevImage)
                  }
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
              >
                <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
            )}
            
            {arrangedImages.findIndex(img => img.id === fullscreenImage.id) < arrangedImages.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const currentIndex = arrangedImages.findIndex(img => img.id === fullscreenImage.id)
                  const nextImage = arrangedImages[currentIndex + 1]
                  if (nextImage) {
                    setFullscreenImage(nextImage)
                  }
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
              >
                <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
            )}
            
            {/* Image */}
            <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <GoogleDriveEmbed
                id={fullscreenImage?.id}
                src={fullscreenImage?.src}
                driveFileId={fullscreenImage?.driveFileId}
                title={fullscreenImage?.title}
                thumbnailUrl={fullscreenImage?.thumbnailUrl}
              />
            </div>
            
            {/* Image info */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 text-center backdrop-blur-md rounded-xl p-3 sm:p-4"
                 style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
              <p className="text-white text-sm sm:text-base md:text-lg font-semibold mb-1 truncate">
                {fullscreenImage.title}
              </p>
              <p className="text-white/80 text-xs sm:text-sm">
                {format(fullscreenImage.uploadDate, 'PPP')} • 
                {arrangedImages.findIndex(img => img.id === fullscreenImage.id) + 1} of {arrangedImages.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setImageToDelete(null)
        }}
        onConfirm={handleDeleteImage}
        isDeleting={isDeleting}
        imageName={imageToDelete?.title || 'this image'}
      />
    </div>
  )
}

// ─── Animated loading splash ───────────────────────────────────────────────
function LoadingSplash({
  theme,
  isDarkMode,
  messages,
}: {
  theme: { primary: string; light: string; medium: string; hover: string }
  isDarkMode: boolean
  messages: string[]
}) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % messages.length)
        setVisible(true)
      }, 300)
    }, 2200)
    return () => clearInterval(iv)
  }, [messages.length])

  const features = [
    { icon: Move,     label: 'Drag & drop to reorder'  },
    { icon: ZoomIn,   label: 'Fullscreen with swipe'   },
    { icon: Filter,   label: 'Filter by date'          },
    { icon: Search,   label: 'Search all photos'       },
  ]

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        background: isDarkMode
          ? `linear-gradient(160deg, #0f172a 0%, ${theme.primary}18 100%)`
          : `linear-gradient(160deg, #ffffff 0%, ${theme.light} 100%)`,
      }}
    >
      {/* Animated icon ring */}
      <div className="relative mb-10">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-10"
          style={{ backgroundColor: theme.primary, width: 96, height: 96 }}
        />
        <div
          className="absolute inset-0 rounded-full animate-pulse opacity-20"
          style={{ backgroundColor: theme.primary, width: 96, height: 96, animationDelay: '0.5s' }}
        />
        <div
          className="relative flex items-center justify-center w-24 h-24 rounded-full shadow-xl"
          style={{ backgroundColor: theme.light }}
        >
          <Images className="h-10 w-10" style={{ color: theme.primary }} />
        </div>
        <div
          className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full shadow"
          style={{ backgroundColor: theme.primary }}
        >
          <Zap className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Title */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-3 tracking-tight"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary}, ${theme.hover})`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        All Journals Gallery
      </h1>
      <p className="text-sm sm:text-base text-muted-foreground text-center max-w-sm mb-8 leading-relaxed">
        Your personal photo archive — every memory from every journal, beautifully organised in one place.
      </p>

      {/* Cycling loading message */}
      <div className="flex items-center gap-3 mb-10">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: theme.primary }} />
        <span
          className="text-sm font-medium transition-opacity duration-300"
          style={{ color: theme.primary, opacity: visible ? 1 : 0 }}
        >
          {messages[msgIdx]}
        </span>
      </div>

      {/* Feature chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl">
        {features.map(({ icon: Icon, label }, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
            style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.medium}` }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: theme.light }}>
              <Icon className="h-4 w-4" style={{ color: theme.primary }} />
            </div>
            <span className="text-xs text-muted-foreground leading-snug">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main component with enhanced responsive header
export default function AllJournalsGallery() {
  const [journalIds, setJournalIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { currentTheme, isDarkMode, elementColors } = useTheme()

  useEffect(() => {
    let isMounted = true

    const fetchJournalIds = async () => {
      try {
        setError(null)

        // Check cache first — show instantly if available
        const cached = getCachedJournalIds()
        if (cached) {
          setJournalIds(Array.from(new Set(cached)))
          setLoading(false)
          // Still revalidate in the background (stale-while-revalidate)
        }

        const response = await fetch('/api/journals/ids')

        if (!response.ok) {
          // If we had cache, don't throw — just log
          if (cached) {
            console.warn('Background revalidation failed:', response.status)
            return
          }
          throw new Error(`Failed to fetch journal IDs: ${response.status}`)
        }

        const data: JournalIdsResponse = await response.json()

        if (!data.journalIds) {
          if (!cached) throw new Error('No journal IDs returned from API')
          return
        }

        const uniqueJournalIds = Array.from(new Set(data.journalIds))

        setCachedJournalIds(uniqueJournalIds)

        if (isMounted) {
          setJournalIds(uniqueJournalIds)
        }
      } catch (err) {
        console.error('Error fetching journal IDs:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load journal IDs')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchJournalIds()

    return () => { isMounted = false }
  }, [])

  if (loading) {
    const messages = [
      "Gathering your memories…",
      "Organising your journals…",
      "Almost ready…",
    ]
    return (
      <LoadingSplash theme={currentTheme} isDarkMode={isDarkMode} messages={messages} />
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <Alert 
          variant="destructive" 
          className="max-w-2xl border-2 rounded-xl"
          style={{ 
            borderColor: '#EF4444',
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <AlertDescription className="flex items-start gap-3" style={{ color: isDarkMode ? '#FCA5A5' : '#DC2626' }}>
            <X className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="font-semibold">Failed to load journals</strong>
              <p className="mt-1">{error}</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (journalIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card 
          className="max-w-2xl w-full border-2 border-dashed rounded-2xl"
          style={{ 
            borderColor: currentTheme.medium,
            backgroundColor: elementColors.background
          }}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 md:py-20">
            <div 
              className="p-5 md:p-6 rounded-full mb-6"
              style={{ backgroundColor: currentTheme.light }}
            >
              <Images 
                className="h-12 w-12 md:h-16 md:w-16" 
                style={{ color: currentTheme.medium }}
              />
            </div>
            <h3 
              className="text-xl md:text-2xl font-bold mb-3"
              style={{ color: elementColors.text }}
            >
              No journals found
            </h3>
            <p className="text-sm md:text-base text-muted-foreground text-center max-w-md px-4">
              Create your first journal to start building your photo gallery.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: isDarkMode 
          ? `linear-gradient(135deg, #111827 0%, ${currentTheme.primary}15 100%)`
          : `linear-gradient(135deg, #FFFFFF 0%, ${currentTheme.light} 100%)`
      }}
    >
      <div className="max-w-7xl mx-auto py-6 sm:py-8 md:py-12">
        {/* Hero Header */}
        <div className="text-center mb-10 md:mb-14 px-4">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold uppercase tracking-widest"
            style={{ backgroundColor: currentTheme.light, color: currentTheme.primary, border: `1px solid ${currentTheme.medium}` }}>
            <Zap className="h-3.5 w-3.5" />
            Photo Archive
          </div>

          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-5 tracking-tight"
            style={{
              backgroundImage: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.hover})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            All Journals Gallery
          </h1>

          {/* Subtitle */}
          <p
            className="text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8"
            style={{ color: elementColors.text }}
          >
            Every photo from every journal — unified in one beautiful, searchable gallery.
            <span className="hidden sm:inline"> Drag to reorder, resize cards, filter by date, and relive your moments.</span>
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { icon: Move,        label: 'Drag & drop'    },
              { icon: ZoomIn,      label: 'Fullscreen view' },
              { icon: Filter,      label: 'Date filters'    },
              { icon: Search,      label: 'Live search'     },
              { icon: BookOpen,    label: 'All journals'    },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: currentTheme.light, color: currentTheme.primary, border: `1px solid ${currentTheme.medium}` }}
              >
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>

          {/* Divider */}
          <div className="w-16 h-1 mx-auto rounded-full" style={{ backgroundColor: currentTheme.medium }} />
        </div>

        <CombinedGallery journalIds={journalIds} />
      </div>
    </div>
  )
}