import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useTheme } from "@/utilities/context/ThemeContext";
import GoogleDriveEmbed from "./GoogleDriveEmbed";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Maximize2, 
  Minimize2, 
  Trash2, 
  MoreVertical,
  Star,
  Circle,
  Expand // Add this import for fullscreen icon
} from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/quilted-gallery/ui/tooltip";
import { Button } from "@/components/ui/button2";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/quilted-gallery/ui/dropdown-menu";

interface ImageItem {
  id: string;
  src: string;
  driveFileId: string;
  title: string;
  thumbnailUrl?: string; // Updated to match the definition in AllJournalsGallery
  uploadDate?: Date;
  cols?: number;
  rows?: number;
  importance?: number;
  mimeType?: string;
  thumbnailLink?: string;
  journalId: string;
}

interface SortableImageProps {
  image: ImageItem;
  onSizeChange: (id: string, size: "small" | "medium" | "large") => void;
  onDelete: (image: ImageItem) => void;
  onFullscreen: (image: ImageItem) => void; // Add this new prop
}

const SortableImage = ({ image, onSizeChange, onDelete, onFullscreen }: SortableImageProps) => {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging 
  } = useSortable({ id: image.id });
  
  const { currentTheme, isDarkMode, elementColors, currentFont } = useTheme();

  // Calculate current size
  const currentSize = 
    image.cols === 1 && image.rows === 1 ? "small" : 
    image.cols === 2 && image.rows === 1 ? "medium" : "large";

  const canEnlarge = currentSize === "small" || currentSize === "medium";
  const canShrink = currentSize === "medium" || currentSize === "large";

  // Dynamic styles
  const containerStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    gridColumn: `span ${image.cols}`,
    gridRow: `span ${image.rows}`,
    zIndex: isDragging ? 50 : 0,
  };

  // Theme-aware CSS variables
  const themeVars = {
    '--primary-color': currentTheme.primary,
    '--primary-hover': currentTheme.hover,
    '--primary-light': currentTheme.light,
    '--primary-medium': currentTheme.medium,
    '--element-bg': elementColors.background,
    '--element-accent': elementColors.accent,
    '--element-text': elementColors.text,
    '--border-color': isDarkMode ? '#374151' : '#e5e7eb',
    '--overlay-dark': isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    '--overlay-light': isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)',
    '--control-bg': isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)',
    '--text-secondary': isDarkMode ? '#e5e7eb' : '#d1d5db',
    '--font-family': 'var(--font-family)',
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={{ ...containerStyle, ...themeVars }}
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300 ease-out",
        "group cursor-grab active:cursor-grabbing",
        "hover:shadow-xl hover:shadow-black/10",
        "font-[var(--font-family)]",
        isDragging && "opacity-80 shadow-2xl scale-[1.02] rotate-1",
        isDarkMode ? "bg-gray-900/50" : "bg-white/50",
        "backdrop-blur-sm"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Animated border */}
      <div 
        className={cn(
          "absolute inset-0 rounded-2xl border-2 transition-all duration-300",
          isDragging 
            ? "border-[var(--primary-color)] shadow-[0_0_0_4px_var(--primary-light)]" 
            : "border-[var(--border-color)] group-hover:border-[var(--primary-color)]/50"
        )}
      />

      {/* Image container */}
      <div className="absolute inset-2 rounded-xl overflow-hidden">
        <GoogleDriveEmbed
          id={image.id}
          src={image.src}
          driveFileId={image.driveFileId}
          title={image.title}
          thumbnailUrl={image.thumbnailUrl}
        />
      </div>

      {/* Improved gradient overlay */}
      <div 
        className={cn(
          "absolute inset-0 rounded-2xl transition-all duration-500 ease-out",
          "opacity-0 group-hover:opacity-100"
        )}
        style={{
          background: `linear-gradient(
            to top, 
            var(--overlay-dark) 0%, 
            var(--overlay-light) 40%, 
            transparent 70%
          )`
        }}
      />

      {/* Enhanced image info */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-4 text-white",
        "transform translate-y-4 opacity-0 transition-all duration-500 ease-out",
        "group-hover:translate-y-0 group-hover:opacity-100"
      )}>
        <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">
          {image.title}
        </h3>
        {image.uploadDate && (
          <div 
            className="text-xs flex items-center gap-2 opacity-90"
            style={{ color: 'var(--text-secondary)' }}
          >
            <CalendarIcon className="h-3 w-3" />
            <span>{format(image.uploadDate, "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Improved control panel */}
      <div className={cn(
        "absolute top-3 right-3 transition-all duration-300 ease-out",
        "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
      )}>
        <div 
          className="flex items-center gap-1 backdrop-blur-md rounded-lg p-1 border border-white/20"
          style={{ backgroundColor: 'var(--control-bg)' }}
        >
          {/* Fullscreen button - Add this as the first button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 text-white/90 hover:text-white border-none",
                    "hover:bg-[var(--primary-color)]/20 transition-colors duration-200"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFullscreen(image);
                  }}
                >
                  <Expand className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                View fullscreen
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Quick resize buttons */}
          {canEnlarge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 text-white/90 hover:text-white border-none",
                      "hover:bg-[var(--primary-color)]/20 transition-colors duration-200"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSizeChange(image.id, currentSize === "small" ? "medium" : "large");
                    }}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Enlarge image
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {canShrink && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 text-white/90 hover:text-white border-none",
                      "hover:bg-[var(--primary-color)]/20 transition-colors duration-200"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSizeChange(image.id, currentSize === "large" ? "medium" : "small");
                    }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Shrink image
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 text-white/90 hover:text-white border-none",
                  "hover:bg-[var(--primary-color)]/20 transition-colors duration-200"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className={cn(
                "w-48 backdrop-blur-md border",
                isDarkMode 
                  ? "bg-gray-900/90 border-gray-700 text-white" 
                  : "bg-white/90 border-gray-200 text-gray-900"
              )}
            >
              {/* Add fullscreen option to dropdown as well */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onFullscreen(image);
                }}
                className="hover:bg-[var(--primary-color)]/10"
              >
                <Expand className="h-4 w-4 mr-2" />
                View Fullscreen
              </DropdownMenuItem>
              <DropdownMenuSeparator className={isDarkMode ? "border-gray-700" : "border-gray-200"} />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onSizeChange(image.id, "small");
                }}
                disabled={currentSize === "small"}
                className="hover:bg-[var(--primary-color)]/10"
              >
                <Circle className="h-4 w-4 mr-2" />
                Small (1×1)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onSizeChange(image.id, "medium");
                }}
                disabled={currentSize === "medium"}
                className="hover:bg-[var(--primary-color)]/10"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Medium (2×1)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onSizeChange(image.id, "large");
                }}
                disabled={currentSize === "large"}
                className="hover:bg-[var(--primary-color)]/10"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Large (2×2)
              </DropdownMenuItem>
              <DropdownMenuSeparator className={isDarkMode ? "border-gray-700" : "border-gray-200"} />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(image);
                }}
                className={cn(
                  "text-red-500 hover:text-red-600",
                  "hover:bg-red-500/10 focus:bg-red-500/10"
                )}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Enhanced importance indicator */}
      {image.importance && image.importance > 1 && (
        <div className={cn(
          "absolute top-3 left-3 transition-all duration-300 ease-out",
          "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
        )}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  className={cn(
                    "text-white border border-white/20 backdrop-blur-md text-xs font-medium px-2 py-1",
                    image.importance === 3 
                      ? "bg-amber-500/80 shadow-amber-500/20" 
                      : "bg-blue-500/80 shadow-blue-500/20",
                    "shadow-lg"
                  )}
                >
                  {image.importance === 3 ? (
                    <>
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      High
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3 mr-1 fill-current" />
                      Medium
                    </>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {image.importance === 3 ? "High priority" : "Medium priority"} image
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Improved size indicator */}
      <div className={cn(
        "absolute bottom-3 right-3 transition-all duration-300 ease-out",
        "opacity-0 group-hover:opacity-100"
      )}>
        <Badge 
          variant="outline" 
          className={cn(
            "text-white text-xs border-white/30 backdrop-blur-md px-2 py-1",
            "bg-black/30"
          )}
        >
          {currentSize.charAt(0).toUpperCase() + currentSize.slice(1)}
        </Badge>
      </div>

      {/* Drag indicator */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 text-white px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
            Moving...
          </div>
        </div>
      )}
    </div>
  );
};

export default SortableImage;