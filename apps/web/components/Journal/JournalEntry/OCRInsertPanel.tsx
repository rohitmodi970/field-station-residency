"use client";
import React, { useState, useRef, useCallback } from "react";
import {
  ScanLine,
  Upload,
  FileText,
  RefreshCw,
  X,
  Check,
  ChevronDown,
  Plus,
  Replace,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";

// ─── Types ──────────────────────────────────────────────
type InsertMode = "append" | "overwrite";

interface OCRInsertPanelProps {
  /** Current journal content (used for preview comparison) */
  currentContent: string;
  /** Called with final text + chosen mode so the parent can update state */
  onInsert: (text: string, mode: InsertMode) => void;
  onClose: () => void;
}

interface OCRPage {
  markdown: string;
  images?: { content_type: string; content: string }[];
}

interface OCRResponse {
  pages?: OCRPage[];
  text?: string;
  content?: string;
  combinedText?: string;
  failedFiles?: number;
  totalFiles?: number;
}

// ─── Helpers ────────────────────────────────────────────
/** Strip markdown syntax → readable plain text */
const markdownToPlain = (md: string): string => {
  let t = md;
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/^#{1,6}\s*/gm, "");
  t = t.replace(/(\*\*|__)(.*?)\1/g, "$2");
  t = t.replace(/(\*|_)(.*?)\1/g, "$2");
  t = t.replace(/^>\s?/gm, "");
  t = t.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "");
  t = t.replace(/^\s*[*\-+]\s+/gm, "• ");
  t = t.replace(/^\s*(\d+)\.\s+/gm, "$1. ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
};

// ─── Component ──────────────────────────────────────────
const OCRInsertPanel: React.FC<OCRInsertPanelProps> = ({
  currentContent,
  onInsert,
  onClose,
}) => {
  const { isDarkMode, elementColors } = useTheme();

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Extracted text state
  const [extractedText, setExtractedText] = useState("");

  // Insert mode state
  const [mode, setMode] = useState<InsertMode>("append");
  const [showPreview, setShowPreview] = useState(true);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);

  // ── File handling ─────────────────────────────────────
  const addFiles = useCallback(
    (incoming: File[]) => {
      if (files.length + incoming.length > 10) {
        setError("Maximum 10 files allowed.");
        return;
      }
      setFiles((prev) => [...prev, ...incoming]);
      setExtractedText("");
      setError("");
    },
    [files.length]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const resetAll = () => {
    setFiles([]);
    setExtractedText("");
    setError("");
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Drag & Drop ───────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  // ── OCR Processing ────────────────────────────────────
  const processOCR = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setExtractedText("");
    setError("");
    setProgress("Preparing files…");

    try {
      // 1. Get presigned upload URLs
      const meta = files.map((f) => ({
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type,
      }));
      setProgress("Getting upload URLs…");
      const presignRes = await fetch("/api/ocr/presigned-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: meta }),
      });
      if (!presignRes.ok) {
        const d = await presignRes.json();
        throw new Error(d.error || "Failed to get upload URLs");
      }
      const { uploads } = await presignRes.json();

      // 2. Upload to storage
      setProgress("Uploading files…");
      const uploaded = await Promise.all(
        uploads.map(async (u: { uploadUrl: string; filePath: string; fileName: string }, i: number) => {
          const file = files[i];
          if (!file) throw new Error(`Missing file at index ${i}`);
          const res = await fetch(u.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
          return {
            filePath: u.filePath,
            fileName: u.fileName,
            mimeType: file.type || "application/octet-stream",
          };
        })
      );

      // 3. Run OCR
      setProgress(`Processing ${files.length} file(s)…`);
      const ocrRes = await fetch("/api/ocr/process-from-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded }),
      });
      if (!ocrRes.ok) {
        const d = await ocrRes.json();
        throw new Error(d.error || "OCR processing failed");
      }
      const data: OCRResponse = await ocrRes.json();

      const raw = data.combinedText || data.text || data.content || "";
      const plain = markdownToPlain(raw);
      setExtractedText(plain);
      setProgress("Done!");

      if (data.failedFiles && data.failedFiles > 0) {
        setError(
          `${data.failedFiles} of ${data.totalFiles} file(s) failed to process.`
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "OCR failed. Please try again.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Styles ────────────────────────────────────────────
  const cardBg = isDarkMode ? "#1F2937" : "#ffffff";
  const mutedText = isDarkMode ? "#9CA3AF" : "#6B7280";
  const borderColor = isDarkMode ? "#374151" : "#E5E7EB";
  const surfaceBg = isDarkMode ? "#111827" : "#F9FAFB";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: cardBg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b shrink-0"
          style={{ borderColor }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${elementColors.button}15` }}
            >
              <ScanLine size={20} style={{ color: elementColors.button }} />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: elementColors.text }}
              >
                OCR — Scan &amp; Insert
              </h2>
              <p className="text-xs" style={{ color: mutedText }}>
                Extract text from images or PDFs and add to your journal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-500/20"
          >
            <X size={18} style={{ color: mutedText }} />
          </button>
        </div>

        {/* ─── Body (scrollable) ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5">
          {/* Upload area */}
          {!extractedText && (
            <>
              <input
                type="file"
                ref={fileRef}
                onChange={handleFileInput}
                accept=".pdf,.png,.jpg,.jpeg,.avif,.heic,.heif"
                multiple
                className="hidden"
              />
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "scale-[1.02]"
                    : "hover:border-opacity-70"
                }`}
                style={{
                  borderColor: isDragging
                    ? elementColors.button
                    : files.length > 0
                    ? isDarkMode
                      ? "#059669"
                      : "#34D399"
                    : borderColor,
                  backgroundColor: isDragging
                    ? `${elementColors.button}08`
                    : files.length > 0
                    ? isDarkMode
                      ? "rgba(6,78,59,0.15)"
                      : "rgba(236,253,245,0.8)"
                    : surfaceBg,
                }}
              >
                {files.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <Check
                      size={36}
                      className={isDarkMode ? "text-green-400" : "text-green-500"}
                    />
                    <p
                      className="font-medium"
                      style={{ color: isDarkMode ? "#6EE7B7" : "#059669" }}
                    >
                      {files.length} file(s) ready
                    </p>
                    <p className="text-xs" style={{ color: mutedText }}>
                      Click to add more (max 10)
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={36} style={{ color: mutedText }} />
                    <p className="font-medium" style={{ color: elementColors.text }}>
                      Drop files or click to upload
                    </p>
                    <p className="text-xs" style={{ color: mutedText }}>
                      PDF, JPG, PNG, JPEG, AVIF — multiple files supported
                    </p>
                  </div>
                )}
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: elementColors.text }}
                    >
                      Files ({files.length}/10)
                    </span>
                    <button
                      onClick={resetAll}
                      className="text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      Remove all
                    </button>
                  </div>
                  <div
                    className="rounded-lg p-2 space-y-1.5 max-h-36 overflow-y-auto"
                    style={{ backgroundColor: surfaceBg }}
                  >
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ backgroundColor: cardBg }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} style={{ color: mutedText }} />
                          <span
                            className="text-sm truncate"
                            style={{ color: elementColors.text }}
                          >
                            {f.name}
                          </span>
                          <span className="text-xs shrink-0" style={{ color: mutedText }}>
                            {(f.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        >
                          <X size={14} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Process button */}
              {files.length > 0 && (
                <button
                  onClick={processOCR}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white transition-all disabled:opacity-60"
                  style={{
                    backgroundColor: isProcessing
                      ? isDarkMode
                        ? "#374151"
                        : "#9CA3AF"
                      : elementColors.button,
                  }}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      {progress}
                    </>
                  ) : (
                    <>
                      <ScanLine size={18} />
                      Extract Text from {files.length} File
                      {files.length > 1 ? "s" : ""}
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg border"
              style={{
                backgroundColor: isDarkMode
                  ? "rgba(127,29,29,0.2)"
                  : "#FEF2F2",
                borderColor: isDarkMode ? "#7F1D1D" : "#FECACA",
              }}
            >
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* ─── Extracted Text + Preview ─────────────────── */}
          {extractedText && (
            <>
              {/* Mode selector */}
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: elementColors.text }}
                >
                  Insert mode:
                </span>
                <div
                  className="inline-flex rounded-lg border overflow-hidden"
                  style={{ borderColor }}
                >
                  <button
                    onClick={() => setMode("append")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      backgroundColor:
                        mode === "append" ? elementColors.button : "transparent",
                      color:
                        mode === "append" ? "#fff" : elementColors.text,
                    }}
                  >
                    <Plus size={14} />
                    Append
                  </button>
                  <button
                    onClick={() => setMode("overwrite")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      backgroundColor:
                        mode === "overwrite" ? "#EF4444" : "transparent",
                      color:
                        mode === "overwrite" ? "#fff" : elementColors.text,
                    }}
                  >
                    <Replace size={14} />
                    Overwrite
                  </button>
                </div>
              </div>

              {/* Mode description */}
              <p className="text-xs" style={{ color: mutedText }}>
                {mode === "append"
                  ? "The extracted text will be added to the end of your existing content."
                  : "⚠️ This will replace ALL existing content with the extracted text."}
              </p>

              {/* Extracted text */}
              <div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: elementColors.text }}
                >
                  Extracted Text
                </h3>
                <div
                  className="rounded-lg p-4 max-h-48 overflow-y-auto text-sm leading-relaxed"
                  style={{
                    backgroundColor: surfaceBg,
                    color: elementColors.text,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                    {extractedText}
                  </pre>
                </div>
              </div>

              {/* Preview toggle */}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: elementColors.button }}
              >
                <Eye size={16} />
                {showPreview ? "Hide" : "Show"} Final Preview
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showPreview ? "rotate-180" : ""}`}
                />
              </button>

              {/* Preview pane */}
              {showPreview && (
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{ borderColor }}
                >
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b"
                    style={{
                      backgroundColor: isDarkMode
                        ? "rgba(55,65,81,0.5)"
                        : "#F3F4F6",
                      borderColor,
                      color: mutedText,
                    }}
                  >
                    {mode === "append"
                      ? "Preview — Existing + New Text"
                      : "Preview — Replaced Content"}
                  </div>
                  <div
                    className="p-4 max-h-56 overflow-y-auto text-sm leading-relaxed"
                    style={{
                      backgroundColor: surfaceBg,
                      color: elementColors.text,
                    }}
                  >
                    {mode === "append" && currentContent && (
                      <>
                        <div className="opacity-50">
                          <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                            {currentContent}
                          </pre>
                        </div>
                        <div
                          className="my-3 border-t-2 border-dashed"
                          style={{ borderColor: elementColors.button }}
                        />
                        <div
                          className="pl-3 border-l-2"
                          style={{ borderColor: elementColors.button }}
                        >
                          <span
                            className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
                            style={{
                              backgroundColor: `${elementColors.button}20`,
                              color: elementColors.button,
                            }}
                          >
                            New from OCR
                          </span>
                          <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                            {extractedText}
                          </pre>
                        </div>
                      </>
                    )}
                    {mode === "append" && !currentContent && (
                      <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                        {extractedText}
                      </pre>
                    )}
                    {mode === "overwrite" && (
                      <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                        {extractedText}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Scan another */}
              <button
                onClick={resetAll}
                className="text-sm font-medium flex items-center gap-1.5 transition-colors"
                style={{ color: mutedText }}
              >
                <RefreshCw size={14} />
                Scan another document
              </button>
            </>
          )}
        </div>

        {/* ─── Footer ────────────────────────────────────── */}
        {extractedText && (
          <div
            className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t shrink-0"
            style={{ borderColor }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors text-center"
              style={{
                backgroundColor: isDarkMode ? "#374151" : "#F3F4F6",
                color: elementColors.text,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onInsert(extractedText, mode)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{
                backgroundColor:
                  mode === "overwrite" ? "#EF4444" : elementColors.button,
              }}
            >
              {mode === "append" ? (
                <>
                  <Plus size={16} />
                  Append to Journal
                </>
              ) : (
                <>
                  <Replace size={16} />
                  Overwrite Content
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OCRInsertPanel;
