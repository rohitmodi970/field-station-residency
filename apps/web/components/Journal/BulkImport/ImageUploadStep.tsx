"use client";

import React, { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import Image from 'next/image';
import {
  Upload,
  X,
  GripVertical,
  ImagePlus,
  AlertCircle,
  ChevronRight,
  Paperclip,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UploadedFile } from './BulkJournalImport';

// ─── Constants ───────────────────────────────────────────────────────

const MAX_FILES = 50;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/webp',
  'application/pdf',
];
const ACCEPT_STRING = '.jpg,.jpeg,.png,.heic,.heif,.avif,.webp,.pdf';

// ─── Helpers ─────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAcceptedType(file: File): boolean {
  // HEIC files sometimes report as '' on some browsers
  if (file.name.match(/\.heic$/i) || file.name.match(/\.heif$/i)) return true;
  return ACCEPTED_TYPES.includes(file.type);
}

// ─── Sortable Thumbnail ──────────────────────────────────────────────

interface SortableThumbnailProps {
  item: UploadedFile;
  index: number;
  isDarkMode: boolean;
  onRemove: (id: string) => void;
}

const SortableThumbnail: React.FC<SortableThumbnailProps> = ({
  item,
  index,
  isDarkMode,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const isPdf = item.file.type === 'application/pdf';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
        isDragging
          ? 'border-dashed border-blue-400'
          : isDarkMode
            ? 'border-gray-700 hover:border-gray-500'
            : 'border-gray-200 hover:border-gray-400'
      }`}
    >
      {/* Thumbnail image / PDF placeholder */}
      <div className="aspect-3/4 w-full bg-gray-900/5 flex items-center justify-center overflow-hidden">
        {isPdf ? (
          <div className={`flex flex-col items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="text-[10px] font-medium">PDF</span>
          </div>
        ) : item.preview ? (
          <Image
            src={item.preview}
            alt={item.file.name}
            className="w-full h-full object-cover"
            draggable={false}
            width={200}
            height={267}
            unoptimized
          />
        ) : (
          <div className={`flex flex-col items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <ImageIcon size={32} />
            <span className="text-[10px] font-medium uppercase overflow-hidden text-ellipsis whitespace-nowrap px-2 w-full text-center">
              {item.file.name.split('.').pop()?.toUpperCase() || 'IMAGE'}
            </span>
          </div>
        )}
      </div>

      {/* Page number badge */}
      <div
        className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        {index + 1}
      </div>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-8 w-6 h-6 rounded flex items-center justify-center
                   bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center
                   bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        title="Remove"
      >
        <X size={14} />
      </button>

      {/* File name */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[10px] truncate font-medium ${
          isDarkMode ? 'bg-gray-900/80 text-gray-300' : 'bg-white/80 text-gray-700'
        }`}
      >
        {item.file.name}
      </div>
    </div>
  );
};

// ─── ImageUploadStep Props ───────────────────────────────────────────

interface ImageUploadStepProps {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  attachImages: boolean;
  setAttachImages: React.Dispatch<React.SetStateAction<boolean>>;
  onNext: () => void;
}

// ─── ImageUploadStep Component ───────────────────────────────────────

const ImageUploadStep: React.FC<ImageUploadStepProps> = ({
  uploadedFiles,
  setUploadedFiles,
  attachImages,
  setAttachImages,
  onNext,
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // ── DnD sensors ──────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── File handling ────────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newErrors: string[] = [];
      const filesToAdd: UploadedFile[] = [];

      const fileArray = Array.from(incoming);

      for (const file of fileArray) {
        // Check total count
        if (uploadedFiles.length + filesToAdd.length >= MAX_FILES) {
          newErrors.push(`Maximum ${MAX_FILES} files allowed. "${file.name}" was skipped.`);
          continue;
        }

        // Check type
        if (!isAcceptedType(file)) {
          newErrors.push(`"${file.name}" is not a supported file type.`);
          continue;
        }

        // Check size
        if (file.size > MAX_FILE_SIZE) {
          newErrors.push(`"${file.name}" exceeds 25 MB limit (${formatFileSize(file.size)}).`);
          continue;
        }

        // Check duplicate name (simple heuristic)
        const isDuplicate = uploadedFiles.some(
          (f) => f.file.name === file.name && f.file.size === file.size,
        );
        if (isDuplicate) {
          newErrors.push(`"${file.name}" is already added.`);
          continue;
        }

        const isHeic = file.name.match(/\.(heic|heif)$/i);
        const preview = (!isHeic && file.type.startsWith('image/')) ? URL.createObjectURL(file) : '';
        const id = generateId();
        filesToAdd.push({ file, id, preview });

        if (isHeic) {
          import('heic2any')
            .then((heic2anyModule) => {
              const heic2any = heic2anyModule.default as any;
              return heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 });
            })
            .then((converted) => {
              const blob = Array.isArray(converted) ? converted[0] : converted;
              if (blob) {
                const convertedUrl = URL.createObjectURL(blob);
                setUploadedFiles((current) =>
                  current.map((f) => (f.id === id ? { ...f, preview: convertedUrl } : f))
                );
              }
            })
            .catch((err) => {
              console.warn('HEIC preview conversion failed', err);
            });
        }
      }

      if (filesToAdd.length > 0) {
        setUploadedFiles((prev) => [...prev, ...filesToAdd]);
      }
      if (newErrors.length > 0) {
        setErrors(newErrors);
        // Auto-dismiss errors after 6s
        setTimeout(() => setErrors([]), 6000);
      }
    },
    [uploadedFiles, setUploadedFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset so same file can be selected again
      e.target.value = '';
    },
    [addFiles],
  );

  const removeFile = useCallback(
    (id: string) => {
      setUploadedFiles((prev) => {
        const removed = prev.find((f) => f.id === id);
        if (removed?.preview) URL.revokeObjectURL(removed.preview);
        return prev.filter((f) => f.id !== id);
      });
    },
    [setUploadedFiles],
  );

  const removeAll = useCallback(() => {
    uploadedFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setUploadedFiles([]);
  }, [uploadedFiles, setUploadedFiles]);

  // ── Drag & Drop zone handlers ────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  // ── DnD reorder ──────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setUploadedFiles((prev) => {
          const oldIndex = prev.findIndex((f) => f.id === active.id);
          const newIndex = prev.findIndex((f) => f.id === over.id);
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
    },
    [setUploadedFiles],
  );

  // ── Render ───────────────────────────────────────────────────────

  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Title area ── */}
      <div>
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Upload Journal Pages
        </h2>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload photos of your handwritten journal pages. You can reorder them by dragging.
          We&apos;ll extract text from each page and create separate journal entries based on dates.
        </p>
      </div>

      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      {/* ── Drop zone (shown when no files OR as add-more trigger) ── */}
      {!hasFiles && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-400 bg-blue-50/10 scale-[1.01]'
              : isDarkMode
                ? 'border-gray-600 hover:border-gray-400 hover:bg-gray-800/50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: isDarkMode
                  ? 'rgba(255,255,255,0.08)'
                  : currentTheme.light,
              }}
            >
              <Upload size={28} style={{ color: currentTheme.primary }} />
            </div>
            <div>
              <p className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Drag & drop your journal pages here
              </p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                or click to browse • JPG, PNG, HEIC, PDF • Max 25 MB each • Up to {MAX_FILES} files
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-white transition-colors"
                style={{ backgroundColor: elementColors.button }}
              >
                <ImagePlus size={16} /> Browse Files
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // On mobile, use camera capture
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.multiple = true;
                  input.onchange = (ev) => {
                    const target = ev.target as HTMLInputElement;
                    if (target.files) addFiles(target.files);
                  };
                  input.click();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Camera size={16} /> Take Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error messages ── */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg p-3 border ${
            isDarkMode
              ? 'bg-red-900/30 border-red-800/50'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm py-0.5">
              <AlertCircle size={14} className={`mt-0.5 shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <span className={isDarkMode ? 'text-red-300' : 'text-red-700'}>{err}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Thumbnail grid (sortable) ── */}
      {hasFiles && (
        <div>
          {/* File count + actions bar */}
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {uploadedFiles.length} page{uploadedFiles.length !== 1 ? 's' : ''} selected
              <span className={`ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                (drag to reorder)
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ImagePlus size={14} /> Add More
              </button>
              <button
                onClick={removeAll}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'text-red-400 hover:bg-red-900/30'
                    : 'text-red-500 hover:bg-red-50'
                }`}
              >
                Remove All
              </button>
            </div>
          </div>

          {/* Drop zone overlay for adding more files */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl p-1 transition-colors ${
              dragOver
                ? 'bg-blue-50/10 ring-2 ring-blue-400 ring-dashed'
                : ''
            }`}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={uploadedFiles.map((f) => f.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {uploadedFiles.map((item, index) => (
                    <SortableThumbnail
                      key={item.id}
                      item={item}
                      index={index}
                      isDarkMode={isDarkMode}
                      onRemove={removeFile}
                    />
                  ))}

                  {/* "Add more" card */}
                  {uploadedFiles.length < MAX_FILES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`aspect-3/4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                        isDarkMode
                          ? 'border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300'
                          : 'border-gray-300 hover:border-gray-400 text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <ImagePlus size={24} />
                      <span className="text-[10px] font-medium">Add</span>
                    </button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* File summary */}
          <div className={`mt-3 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Total: {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0))}
            {' · '}
            {uploadedFiles.length}/{MAX_FILES} files
          </div>
        </div>
      )}

      {/* ── Attach images toggle ── */}
      {hasFiles && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <Paperclip size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          <div className="flex-1">
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Attach original images to created journals
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              The scanned page images will be saved as media attachments on each journal entry
            </p>
          </div>
          <button
            onClick={() => setAttachImages(!attachImages)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              attachImages ? '' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}
            style={attachImages ? { backgroundColor: currentTheme.primary } : undefined}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                attachImages ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      {/* ── Next button ── */}
      {hasFiles && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end pt-2"
        >
          <button
            onClick={onNext}
            className="px-6 py-3 rounded-lg font-medium text-white flex items-center gap-2 transition-colors hover:opacity-90"
            style={{ backgroundColor: elementColors.button }}
          >
            Extract Text
            <ChevronRight size={18} />
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default ImageUploadStep;
