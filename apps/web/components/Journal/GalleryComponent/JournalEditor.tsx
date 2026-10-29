import React, { useState, useEffect, useRef } from "react";
import { Loader2, Save, Trash2, AlertTriangle, Plus, Clock, Tag, FileText } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import Link from "next/link";
import { JournalEntry } from "../types";
import Toast from "@/components/ui/toast";
import { encryptJournalEntry } from "@/utils/encryption/journalEncryption";
import { isEncryptionInitialized } from "@/utils/encryption/keyManager";

interface JournalEditorProps {
  selectedDate: Date;
  entries: JournalEntry[];
  onSave?: (newEntry: boolean) => void;
  onDelete?: () => void;
}

const JournalEditor: React.FC<JournalEditorProps> = ({
  selectedDate,
  entries,
  onSave,
  onDelete
}) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  // Refs for dynamic height
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [journalType, setJournalType] = useState<string>("personal");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  // Toast state
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("info");
  
  // Current entry management
  const [currentJournalId, setCurrentJournalId] = useState<string | null>(null);
  const [entriesForDate, setEntriesForDate] = useState<JournalEntry[]>([]);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number>(-1);
  const [hasMedia, setHasMedia] = useState<boolean>(false);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteWithMedia, setDeleteWithMedia] = useState<boolean>(false);

  // Dynamic textarea height adjustment
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`;
  };

  // Handle content change with dynamic height
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustTextareaHeight(e.target);
  };

  // Adjust height when content is loaded
  useEffect(() => {
    if (contentRef.current) {
      adjustTextareaHeight(contentRef.current);
    }
  }, [content]);

  // Show toast notification
  const showToast = (message: string, type: "success" | "error" | "info" | "warning") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Format date to YYYY-MM-DD string
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Check if current journal has media
  const checkForMedia = async (journalId: string) => {
    try {
      const response = await fetch(`/api/journals/media?journal_id=${journalId}`);
      if (response.ok) {
        const data = await response.json();
        const media = data.media || { image: [], audio: [], video: [], document: [] };
        const totalMedia = Object.values(media).reduce((total: number, arr: any) => total + (arr?.length || 0), 0);
        setHasMedia(totalMedia > 0);
      }
    } catch (error) {
      console.error('Error checking media:', error);
      setHasMedia(false);
    }
  };
  
  // Get entries for the selected date
  useEffect(() => {
    const dateString = formatDateString(selectedDate);
    const filteredEntries = entries.filter(entry => entry.date === dateString)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setEntriesForDate(filteredEntries);
    
    // Handle different scenarios after filtering entries
    if (filteredEntries.length > 0) {
      // Check if current selected entry still exists
      const currentEntryExists = currentJournalId && 
        filteredEntries.some(entry => entry.journalId === currentJournalId);
      
      if (currentEntryExists) {
        // Keep the current entry if it still exists
        const currentEntryIndex = filteredEntries.findIndex(
          entry => entry.journalId === currentJournalId
        );
        setSelectedEntryIndex(currentEntryIndex);
        // Don't reload the entry as user might be editing
      } else {
        // Current entry no longer exists, load the first available entry
        setSelectedEntryIndex(0);
        if (filteredEntries[0]) {
          loadEntry(filteredEntries[0]);
        }
      }
    } else {
      // No entries for this date, reset form
      resetForm();
      setSelectedEntryIndex(-1);
    }
  }, [selectedDate, entries]);
  
  // Load an entry into the form
  const loadEntry = (entry: JournalEntry): void => {
    setTitle(entry.title || "");
    setContent(entry.content || "");
    setJournalType(entry.journalType || "personal");
    setTags(entry.tags || []);
    setCurrentJournalId(entry.journalId);
    
    if (entry.journalId) {
      checkForMedia(entry.journalId);
    }
  };
  
  // Reset the form for a new entry
  const resetForm = (): void => {
    setTitle("");
    setContent("");
    setJournalType("personal");
    setTags([]);
    setCurrentJournalId(null);
    setHasMedia(false);
    
    // Reset textarea height
    if (contentRef.current) {
      contentRef.current.style.height = '200px';
    }
  };
  
  // Handle selecting a different entry for the same day
  const handleEntrySelect = (index: number): void => {
    if (index >= 0 && index < entriesForDate.length) {
      setSelectedEntryIndex(index);
      const entry = entriesForDate[index];
      if (entry) {
        loadEntry(entry);
      }
    }
  };
  
  // Handle creating a new entry
  const handleNewEntry = (): void => {
    resetForm();
    setSelectedEntryIndex(-1);
    showToast("Started new journal entry", "info");
  };
  
  // Handle delete confirmation
  const handleDeleteClick = (): void => {
    if (!currentJournalId) {
      showToast("No journal entry to delete", "warning");
      return;
    }
    setShowDeleteModal(true);
  };
  
  // Handle actual deletion
  const handleConfirmDelete = async (): Promise<void> => {
    if (!currentJournalId) return;
    
    try {
      setIsDeleting(true);
      
      if (deleteWithMedia && hasMedia) {
      const mediaResponse = await fetch(`/api/journals/media?journal_id=${currentJournalId}`);
      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        const media = mediaData.media || {};
        
        for (const [mediaType, mediaArray] of Object.entries(media)) {
        if (Array.isArray(mediaArray)) {
          for (const mediaItem of mediaArray) {
          if (mediaItem.driveFileId) {
            try {
            await fetch(`/api/journals/media?media_id=${mediaItem.driveFileId}`, {
              method: 'DELETE'
            });
            } catch (mediaError) {
            console.error('Error deleting media:', mediaError);
            }
          }
          }
        }
        }
      }
      }
      
      const deleteResponse = await fetch(`/api/journals?journal_id=${currentJournalId}`, {
      method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
      throw new Error('Failed to delete journal entry');
      }
      
      showToast(
      deleteWithMedia && hasMedia 
        ? 'Journal entry and media deleted successfully' 
        : 'Journal entry deleted successfully', 
      'success'
      );
      
      // Reset form and close modal
      resetForm();
      setShowDeleteModal(false);
      setDeleteWithMedia(false);
      setSelectedEntryIndex(-1);
      
      // Call onDelete callback to refresh parent data
      if (onDelete) {
      onDelete();
      }

      // Hard reload the page
  window.location.reload();
      
    } catch (error) {
      console.error('Error deleting journal:', error);
      showToast('Failed to delete journal entry', 'error');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Tag management
  const handleAddTag = (): void => {
    if (tagInput.trim() !== "" && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
      showToast(`Tag "${tagInput.trim()}" added`, "success");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string): void => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    showToast(`Tag "${tagToRemove}" removed`, "info");
  };
  
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && tagInput.trim() !== "") {
      e.preventDefault();
      handleAddTag();
    }
  };
  
  // Save journal entry
  const handleSave = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const timestamp = new Date().toISOString();
      const dateString = formatDateString(selectedDate);
      
      // Generate proper UUID for journal_id if creating new entry
      const journalId = currentJournalId || crypto.randomUUID();
      
      // Check if encryption is initialized
      const encryptionEnabled = isEncryptionInitialized();
      
      // Prepare entry data
      let entryData: any = {
        journal_id: journalId,
        journal_type: journalType,
        tags,
        date: dateString,
        timestamp,
        is_favorite: false,
        is_archived: false,
      };

      // If encryption is enabled, encrypt title and content on client side
      if (encryptionEnabled) {
        try {
          // Get current user ID from session/auth
          const userResponse = await fetch('/api/user/current');
          const userData = await userResponse.json();
          
          if (userData.user?.id) {
            const encrypted = await encryptJournalEntry({
              title,
              content,
              journal_type: journalType,
              tags,
              date: dateString,
              is_favorite: false,
              is_archived: false,
            }, userData.user.id);

            // Send encrypted data to server
            entryData = {
              ...entryData,
              title_encrypted: encrypted.title_encrypted,
              title_iv: encrypted.title_iv,
              content_encrypted: encrypted.content_encrypted,
              content_iv: encrypted.content_iv,
              is_encrypted: true,
              word_count: encrypted.word_count,
              // Don't send plaintext title/content
              title: null,
              content: null,
            };
          }
        } catch (encryptError) {
          console.error('Encryption failed, saving unencrypted:', encryptError);
          // Fallback to unencrypted
          entryData.title = title;
          entryData.content = content;
          entryData.is_encrypted = false;
        }
      } else {
        // No encryption, send plaintext
        entryData.title = title;
        entryData.content = content;
        entryData.is_encrypted = false;
      }
      
      // Use new Supabase journals API
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save journal entry');
      }
      
      const data = await response.json();
      
      // Update journal ID if it was a new entry
      if (!currentJournalId) {
        setCurrentJournalId(journalId);
      }
      
      showToast(
        currentJournalId ? 'Journal entry updated' : 'Journal entry created',
        'success'
      );
      
      console.log('🔍 [EMBEDDING DEBUG] Starting embedding generation process');
      console.log('🔍 [EMBEDDING DEBUG] Response data:', data);
      
      // Generate embedding for mind map connections (async, non-blocking)
      const contentForEmbedding = entryData.is_encrypted ? content : (entryData.content || content);
      console.log('[JournalEditor] Embedding check:', {
        hasContent: !!contentForEmbedding,
        contentLength: contentForEmbedding?.length,
        hasJournalId: !!data.journal?.id,
        journalId: data.journal?.id,
        isEncrypted: entryData.is_encrypted,
        responseData: data
      });
      
      if (contentForEmbedding && contentForEmbedding.length > 50 && data.journal?.id) {
        console.log('[JournalEditor] Generating embedding for entry:', data.journal.id);
        fetch('/api/journal-embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId: data.journal.id, // Use database UUID, not journal_id
            content: contentForEmbedding,
            title: title || '', // Pass title for category extraction
            threshold: 0.56 // Threshold for deterministic embeddings
          })
        })
          .then(res => res.json())
          .then(result => {
            console.log('[JournalEditor] Embedding generation result:', result);
            if (result.success) {
              console.log(`[JournalEditor] Created ${result.edgesCreated} connections for entry`);
            }
          })
          .catch(err => console.error('[JournalEditor] Embedding generation error:', err));
      } else {
        console.warn('[JournalEditor] Skipping embedding generation - condition not met');
      }
      
      // Metrics tracking
      const charCount = (title ? title.length : 0) + (content ? content.length : 0);
      if (charCount > 0) {
        fetch('/api/metrics/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ charactersWritten: charCount })
        }).catch(err => console.error('Metrics error:', err));
      }
      
      if (onSave) onSave(currentJournalId === null);
      
    } catch (error) {
      console.error('Error saving journal:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to save journal entry',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format time for display
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Journal type icons
  const getJournalTypeIcon = (type: string) => {
    switch (type) {
      case 'work': return '💼';
      case 'travel': return '✈️';
      case 'gratitude': return '🙏';
      case 'dream': return '💭';
      default: return '📔';
    }
  };

  // Dynamic styles based on theme
  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
    boxShadow: isDarkMode 
      ? '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)' 
      : '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  };

  const inputStyle = {
    backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
    color: elementColors.text
  };

  const buttonStyle = {
    backgroundColor: elementColors.button,
    color: '#FFFFFF'
  };

  const modalOverlayStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)'
  };

  const modalStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
    boxShadow: isDarkMode 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  };
  
  return (
    <div 
      className="rounded-2xl border p-8 transition-all duration-300 hover:shadow-lg"
      style={containerStyle}
    >
      {/* Toast notification */}
      <Toast 
        message={toastMessage} 
        type={toastType} 
        visible={toastVisible} 
        onClose={() => setToastVisible(false)} 
        duration={3000}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
          style={modalOverlayStyle}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border transform transition-all duration-300 scale-100"
            style={modalStyle}
          >
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-full bg-red-100 mr-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Delete Journal Entry</h3>
                <p className="text-sm opacity-75 mt-1">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="mb-6 leading-relaxed" style={{ color: elementColors.text }}>
              Are you sure you want to delete this journal entry? All content will be permanently removed.
            </p>
            
            {hasMedia && (
              <div className="mb-6 p-4 rounded-xl border-2 border-dashed" style={{ 
                backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
              }}>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteWithMedia}
                    onChange={(e) => setDeleteWithMedia(e.target.checked)}
                    className="mt-1 mr-3 rounded"
                    style={{ accentColor: currentTheme.primary }}
                  />
                  <div>
                    <span className="font-medium" style={{ color: elementColors.text }}>
                      Also delete all media files
                    </span>
                    <p className="text-sm mt-1 opacity-75" style={{ color: elementColors.text }}>
                      {deleteWithMedia 
                        ? "Media will be permanently deleted from Google Drive" 
                        : "Media will remain in Google Drive"}
                    </p>
                  </div>
                </label>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteWithMedia(false);
                }}
                disabled={isDeleting}
                className="px-6 py-3 rounded-xl border font-medium hover:opacity-80 transition-all duration-200"
                style={{
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  color: elementColors.text
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-6 py-3 rounded-xl text-white font-medium flex items-center hover:opacity-90 transition-all duration-200 shadow-lg"
                style={{ backgroundColor: '#EF4444' }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Entry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header with entry selector */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5" style={{ color: currentTheme.primary }} />
            <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-2">
              {entriesForDate.map((entry, index) => (
                <button
                  key={entry.journalId}
                  onClick={() => handleEntrySelect(index)}
                  className={`px-4 py-2 mr-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 font-medium shadow-sm ${
                    selectedEntryIndex === index
                      ? 'transform scale-105'
                      : 'hover:opacity-80 hover:scale-102'
                  }`}
                  style={{
                    backgroundColor: selectedEntryIndex === index 
                      ? currentTheme.primary 
                      : isDarkMode ? '#374151' : '#F3F4F6',
                    color: selectedEntryIndex === index 
                      ? '#FFFFFF' 
                      : elementColors.text
                  }}
                >
                  <span className="mr-2">{getJournalTypeIcon(entry.journalType || 'personal')}</span>
                  {formatTime(entry.timestamp)}
                  {entry.title && ` - ${entry.title.substring(0, 12)}${entry.title.length > 12 ? '...' : ''}`}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={handleNewEntry}
            className="px-4 py-2 rounded-xl text-sm whitespace-nowrap font-medium transition-all duration-200 hover:scale-105 shadow-sm flex items-center"
            style={{
              backgroundColor: currentTheme.light,
              color: currentTheme.primary
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Entry
          </button>
        </div>
        
        <Link 
          href="/journal/new"
          className="text-sm flex items-center font-medium hover:underline transition-all duration-200 hover:scale-105"
          style={{ color: currentTheme.primary }}
        >
          <FileText className="w-4 h-4 mr-1" />
          Advanced Editor →
        </Link>
      </div>
      
      {/* Title input */}
      <div className="mb-6">
        <input
          ref={titleRef}
          type="text"
          placeholder="Give your entry a title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-0 py-3 text-2xl font-bold border-0 border-b-2 focus:outline-none transition-all duration-200 placeholder-opacity-50"
          style={{
            borderColor: isDarkMode ? '#374151' : '#E5E7EB',
            color: elementColors.text,
            backgroundColor: 'transparent',
            borderBottomColor: title ? currentTheme.primary : (isDarkMode ? '#374151' : '#E5E7EB')
          }}
        />
      </div>
      
      {/* Content textarea with dynamic height */}
      <div className="mb-8">
        <textarea
          ref={contentRef}
          placeholder="What's on your mind today? Share your thoughts, experiences, or reflections..."
          value={content}
          onChange={handleContentChange}
          className="w-full px-4 py-4 border-2 rounded-2xl focus:outline-none transition-all duration-200 resize-none placeholder-opacity-60 leading-relaxed"
          style={{
            ...inputStyle,
            borderColor: content ? currentTheme.primary : (isDarkMode ? '#374151' : '#E5E7EB'),
            minHeight: '200px',
            maxHeight: 'none'
          }}
        />
        <div className="flex justify-between items-center mt-2 text-sm opacity-60">
          <span>{content.length} characters</span>
          <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
        </div>
      </div>
      
      {/* Journal type and tags section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label 
            className="flex text-sm font-semibold mb-3 items-center"
            style={{ color: elementColors.text }}
          >
            <span className="mr-2">📝</span>
            Journal Type
          </label>
          <select
            value={journalType}
            onChange={(e) => setJournalType(e.target.value)}
            className="w-full p-4 border-2 rounded-xl focus:outline-none transition-all duration-200 font-medium"
            style={{
              ...inputStyle,
              borderColor: isDarkMode ? '#374151' : '#E5E7EB'
            }}
          >
            <option value="personal">📔 Personal</option>
            <option value="work">💼 Work</option>
            <option value="travel">✈️ Travel</option>
            <option value="gratitude">🙏 Gratitude</option>
            <option value="dream">💭 Dream</option>
          </select>
        </div>
        
        <div>
          <label 
            className="flex text-sm font-semibold mb-3 items-center"
            style={{ color: elementColors.text }}
          >
            <Tag className="w-4 h-4 mr-2" />
            Add Tags
          </label>
          <div className="flex">
            <input
              type="text"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 p-4 border-2 rounded-l-xl focus:outline-none transition-all duration-200"
              style={{
                ...inputStyle,
                borderColor: isDarkMode ? '#374151' : '#E5E7EB'
              }}
            />
            <button
              onClick={handleAddTag}
              className="px-6 rounded-r-xl font-medium hover:opacity-90 transition-all duration-200 shadow-sm"
              style={{
                backgroundColor: currentTheme.primary,
                color: '#FFFFFF'
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Tags display */}
      {tags.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="text-sm px-4 py-2 rounded-full flex items-center font-medium transition-all duration-200 hover:scale-105 shadow-sm"
                style={{
                  backgroundColor: currentTheme.light,
                  color: currentTheme.primary
                }}
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 w-5 h-5 rounded-full flex items-center justify-center hover:opacity-80 focus:outline-none text-xs font-bold transition-all duration-200"
                  style={{ 
                    backgroundColor: currentTheme.primary + '20',
                    color: currentTheme.primary 
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex justify-between items-center">
        {currentJournalId && (
          <button 
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="px-6 py-3 rounded-xl flex items-center font-medium transition-all duration-200 hover:scale-105 shadow-lg"
            style={{
              backgroundColor: '#EF4444',
              color: '#FFFFFF'
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Entry
          </button>
        )}
        
        <div className="flex-1"></div>
        
        <button 
          onClick={handleSave}
          disabled={!content.trim() || isLoading}
          className={`px-8 py-3 rounded-xl flex items-center font-semibold transition-all duration-200 shadow-lg ${
            !content.trim() || isLoading 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-105 hover:shadow-xl'
          }`}
          style={{
            backgroundColor: !content.trim() || isLoading ? '#9CA3AF' : elementColors.button,
            color: '#FFFFFF'
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              {currentJournalId ? 'Update Entry' : 'Save Entry'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default JournalEditor;