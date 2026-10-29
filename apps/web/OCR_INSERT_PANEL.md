# OCR Insert Panel — Journal Edit Integration

## Overview

The **OCR Insert Panel** lets users scan images/PDFs and insert the extracted text directly into a journal entry while editing. It provides a **preview** of the result before committing, with two insertion modes.

---

## User Flow

```
Journal Edit Mode
       │
       ▼
┌─────────────────────────────────┐
│  Edit Toolbar                   │
│  [📷 OCR Scan] hint text       │
└──────────┬──────────────────────┘
           │ click
           ▼
┌─────────────────────────────────────────────┐
│  OCR Insert Panel (Modal)                   │
│                                             │
│  STEP 1: Upload                             │
│  ┌─────────────────────────────────────┐    │
│  │ Drop files or click to upload       │    │
│  │ PDF, JPG, PNG, JPEG, AVIF          │    │
│  │ Up to 10 files, drag & drop        │    │
│  └─────────────────────────────────────┘    │
│  [File list with remove buttons]            │
│  [🔍 Extract Text from N Files]            │
│                                             │
│  STEP 2: Preview & Choose                   │
│  ┌─────────────────────────────────────┐    │
│  │ Insert Mode: [Append ✓] [Overwrite] │    │
│  │                                     │    │
│  │ ── Extracted Text ──                │    │
│  │ "Lorem ipsum dolor sit amet..."     │    │
│  │                                     │    │
│  │ ── Final Preview ──                 │    │
│  │ (existing text faded)               │    │
│  │ ─── New from OCR ───               │    │
│  │ "Lorem ipsum dolor sit amet..."     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Cancel]            [Append to Journal ✓]  │
└─────────────────────────────────────────────┘
           │
           ▼
  Text inserted into textarea
  User continues editing normally
  Save → encrypt → API update (existing flow)
```

---

## Components

### `OCRInsertPanel`

**File:** `apps/web/components/Journal/JournalEntry/OCRInsertPanel.tsx`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `currentContent` | `string` | The current journal content (for preview) |
| `onInsert` | `(text: string, mode: 'append' \| 'overwrite') => void` | Callback with extracted text and chosen mode |
| `onClose` | `() => void` | Close the modal |

**Features:**
- Drag & drop + click file upload
- Multi-file support (up to 10)
- Uses existing `/api/ocr/presigned-upload` → `/api/ocr/process-from-storage` pipeline
- Markdown → plain text conversion
- Two insertion modes with visual toggle
- Live preview showing how the final content will look
- Append mode shows existing content (faded) + new text highlighted
- Overwrite mode warns with red styling
- "Scan another" to reset and try different files

---

## Insertion Modes

### Append (Default)
- Adds OCR text **to the end** of existing content
- Separated by two newlines (`\n\n`)
- Preview shows existing content dimmed + new text highlighted with accent border
- Button: primary color, "Append to Journal"

### Overwrite
- **Replaces** all existing content with OCR text
- Toggle turns red as a warning signal
- Button changes to red: "Overwrite Content"
- Preview shows only the new text

---

## Integration Point

**File:** `apps/web/app/(user)/journal/[journalId]/page.tsx`

### What was added:
1. **Import** — `OCRInsertPanel` + `ScanLine` icon
2. **State** — `showOCR` boolean
3. **Edit toolbar** — Above the textarea, shows "OCR Scan" button (only in edit mode)
4. **Modal render** — `<OCRInsertPanel>` rendered when `showOCR` is true
5. **Handler** — `onInsert` callback updates `editedJournal.content` and shows toast

### No changes to:
- Save flow (encryption works the same)
- API routes (reuses existing OCR APIs)
- Other components

---

## API Pipeline (Existing — No Changes)

```
1. POST /api/ocr/presigned-upload
   Body: { files: [{ fileName, fileSize, mimeType }] }
   Returns: { uploads: [{ uploadUrl, filePath, fileName }] }

2. PUT {uploadUrl} (direct to Supabase Storage)
   Body: raw file bytes

3. POST /api/ocr/process-from-storage
   Body: { files: [{ filePath, fileName, mimeType }] }
   Returns: { combinedText, failedFiles, totalFiles }
```

OCR backend uses **Mistral OCR** (`mistral-ocr-latest` model).

---

## File Structure

```
apps/web/
├── components/Journal/JournalEntry/
│   ├── OCRInsertPanel.tsx    ← NEW (self-contained component)
│   └── OCRUpload.tsx         ← Existing (used in bulk import, untouched)
├── app/(user)/journal/[journalId]/
│   └── page.tsx              ← MODIFIED (import + toolbar + modal + handler)
└── app/api/ocr/
    ├── presigned-upload/route.ts   ← Existing (no changes)
    └── process-from-storage/route.ts ← Existing (no changes)
```
