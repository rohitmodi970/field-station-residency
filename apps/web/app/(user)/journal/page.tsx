"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from "@/components/layout/Layout";
import JournalCardWithActions from "@/components/Journal/JournalCardWithActions";
import DeleteConfirmationModal from "@/components/Journal/DeleteConfirmationModal";
import Link from "next/link";
import { NotebookPen, BookMarked, Archive, Library, Star, ArchiveX, Trash2, CheckSquare, X, Search, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { JournalEntry } from "@/components/Journal/types";
import { useTheme } from '@/utilities/context/ThemeContext';
import { createClient } from '@/utils/supabase/client';
import { getEncryptionKey } from '@/utils/encryption/keyManager';
import { decryptText } from '@/utils/encryption/crypto';
import { ensureEncryptionReady, type EncryptionReadinessResult } from '@/utils/encryption';
import useJournalStore from '@/stores/journalStore';
import { resolveJournalDisplayFields } from '@/utilities/journalTitle';

type TabType = 'all' | 'favorites' | 'archived';

const formatVoiceNoteTitle = (dateInput?: string | Date): string => {
    const parsed = dateInput ? new Date(dateInput) : new Date();
    const resolvedDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

    return `Voice Note ${resolvedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })}`;
};

// Client component that uses useSearchParams
const JournalsPageContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = (searchParams.get('tab') || 'all') as TabType;
    const { elementColors, isDarkMode, pageBackground, currentFont } = useTheme();

    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({
        total: 0,
        favorites: 0,
        archived: 0,
    });
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination state
    const PAGE_SIZE = 21;
    const [totalFromApi, setTotalFromApi] = useState(0);
    const totalPages = Math.max(1, Math.ceil(totalFromApi / PAGE_SIZE));
    const currentPage = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10), totalPages || 1));
    const encryptionReadyRef = useRef(false);

    // Search & filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMood, setSelectedMood] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    
    // Cache management
    const [isFetching, setIsFetching] = useState(false);
    const [encryptionStatus, setEncryptionStatus] = useState<EncryptionReadinessResult | null>(null);
    const [encryptionAttempted, setEncryptionAttempted] = useState(false);

    // Journal store selectors
    const clearJournalCache = useJournalStore(state => state.clear);

    // Initialize encryption on mount — must complete before loading journals
    useEffect(() => {
        async function initEncryption() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    const isOAuthUser = user.app_metadata?.provider !== 'email';
                    const status = await ensureEncryptionReady({
                        userId: user.id,
                        isOAuthUser,
                    });
                    setEncryptionStatus(status);
                } else {
                    setEncryptionStatus({ ready: false, status: 'needs_unlock', reason: 'missing_user' });
                }
            } catch (err) {
                console.error('[JournalsPage] Failed to initialize encryption:', err);
                setEncryptionStatus({ ready: false, status: 'error', reason: 'init_failed' });
            } finally {
                setEncryptionAttempted(true);
            }
        }

        initEncryption();
    }, []);

    // ─── Transform raw API entry into JournalEntry shape ───────────────────────
    const transformEntry = useCallback(async (entry: any, encryptionReady: boolean): Promise<JournalEntry> => {
        let title = entry.title || '';
        let content = entry.content || '';
        let voiceTranscript = '';

        if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
            if (encryptionReady) {
                try {
                    const { decryptJournalEntry } = await import('@/utils/encryption/journalEncryption');
                    const decrypted = await decryptJournalEntry({
                        title_encrypted: entry.title_encrypted,
                        title_iv: entry.title_iv,
                        content_encrypted: entry.content_encrypted,
                        content_iv: entry.content_iv,
                        date: entry.date || '',
                        is_favorite: entry.is_favorite || false,
                        is_archived: entry.is_archived || false,
                        journal_type: entry.journal_type,
                        mood: entry.mood,
                        tags: entry.tags,
                        location: entry.location,
                        weather: entry.weather,
                    }, entry.user_id);
                    title = decrypted.title || '';
                    content = decrypted.content || '';
                } catch {
                    title = '🔒 Locked Entry';
                    content = 'Please unlock your encryption to view this content.';
                }
            } else {
                title = '🔒 Locked Entry';
                content = 'Please unlock your encryption to view this content.';
            }
        }

        if (encryptionReady && entry.voice_transcript_encrypted && entry.voice_transcript_iv && typeof entry.user_id === 'string') {
            try {
                const key = await getEncryptionKey(entry.user_id);
                voiceTranscript = await decryptText(entry.voice_transcript_encrypted, entry.voice_transcript_iv, key);
            } catch { voiceTranscript = ''; }
        }

        const hasVoiceSignal =
            entry.journal_type === 'voice' ||
            Boolean(entry.voice_transcript_encrypted) ||
            Boolean(entry.voice_transcript_source_signature) ||
            Boolean(entry.voice_transcript_generated_at);
        const resolved = resolveJournalDisplayFields({
            title,
            date: entry.date || entry.updated_at || entry.created_at,
            hasVoiceMedia: hasVoiceSignal,
            content,
            transcript: voiceTranscript,
        });

        return {
            journalId: entry.journal_id,
            title: resolved.title,
            content: resolved.content,
            resolvedContent: resolved.content,
            contentSource: resolved.contentSource,
            voiceTranscript,
            date: entry.date || entry.created_at,
            mood: entry.mood,
            tags: entry.tags || [],
            isFavorite: entry.is_favorite || false,
            isArchived: entry.is_archived || false,
            timestamp: entry.created_at,
            mediaUrl: { image: [], audio: [], video: [], document: [] },
            journalType: entry.journal_type || 'text',
            userId: entry.user_id,
            mediaType: entry.media_type || [],
            fileName: entry.file_name || '',
            fileSize: entry.file_size || 0,
        };
    }, []);

    // ─── Load entries for a specific page ────────────────────────────────────────
    const loadPage = useCallback(async (page: number) => {
        if (isFetching) return;
        const offset = (page - 1) * PAGE_SIZE;
        try {
            setIsLoading(true);
            setIsFetching(true);
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const res = await fetch(
                `${baseUrl}/api/journals?limit=${PAGE_SIZE}&offset=${offset}&sortBy=display_date&sortOrder=desc&include_media=false`,
                { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } }
            );
            if (!res.ok) throw new Error('Failed to fetch journals');
            const data = await res.json();
            const raw: any[] = data.journals || [];
            const total: number = data.total ?? raw.length;

            setTotalFromApi(total);

            const encryptionReady = encryptionReadyRef.current;
            const transformed = await Promise.all(raw.map(e => transformEntry(e, encryptionReady)));

            setEntries(transformed);

            const fav = transformed.filter(e => e.isFavorite).length;
            const arc = transformed.filter(e => e.isArchived).length;
            setStats({ total, favorites: fav, archived: arc });

            // Scroll to top of entries on page change
            window.scrollTo({ top: 0, behavior: 'smooth' });
            console.log(`[JournalsPage] Page ${page}: ${transformed.length}/${total}`);
        } catch (err) {
            console.error('[JournalsPage] Failed to load page:', err);
            setError('Failed to load journal entries. Please try again later.');
        } finally {
            setIsLoading(false);
            setIsFetching(false);
        }
    }, [isFetching, PAGE_SIZE, transformEntry]);

    // ─── Load page whenever encryptionAttempted or currentPage changes ──────────
    useEffect(() => {
        if (!encryptionAttempted) return;
        encryptionReadyRef.current = encryptionStatus?.ready ?? false;
        loadPage(currentPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [encryptionAttempted, encryptionStatus?.ready, currentPage]);

    // Keep encryptionReadyRef in sync
    useEffect(() => {
        encryptionReadyRef.current = encryptionStatus?.ready ?? false;
    }, [encryptionStatus?.ready]);


    // Derive all unique tags from entries
    const allTags = React.useMemo(() => {
        const tagSet = new Set<string>();
        entries.forEach(e => (e.tags || []).forEach((t: string) => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [entries]);

    // Derive all unique moods from entries
    const allMoods = React.useMemo(() => {
        const moodSet = new Set<string>();
        entries.forEach(e => { if (e.mood) moodSet.add(e.mood); });
        return Array.from(moodSet).sort();
    }, [entries]);

    // Filter & sort entries based on active tab + search filters
    useEffect(() => {
        let base: JournalEntry[];
        if (currentTab === 'favorites') {
            base = entries.filter(e => e.isFavorite && !e.isArchived);
        } else if (currentTab === 'archived') {
            base = entries.filter(e => e.isArchived);
        } else {
            base = entries.filter(e => !e.isArchived);
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            base = base.filter(e =>
                e.title?.toLowerCase().includes(q) ||
                e.content?.toLowerCase().includes(q) ||
                e.voiceTranscript?.toLowerCase().includes(q)
            );
        }

        // Mood filter
        if (selectedMood) {
            base = base.filter(e => e.mood === selectedMood);
        }

        // Tag filter
        if (selectedTag) {
            base = base.filter(e => (e.tags || []).includes(selectedTag));
        }

        // Sort
        base = [...base].sort((a, b) => {
            const da = new Date(a.date || a.timestamp || 0).getTime();
            const db = new Date(b.date || b.timestamp || 0).getTime();
            return sortOrder === 'newest' ? db - da : da - db;
        });

        setFilteredEntries(base);
    }, [currentTab, entries, searchQuery, selectedMood, selectedTag, sortOrder]);

    const clearAllFilters = () => {
        setSearchQuery('');
        setSelectedMood('');
        setSelectedTag('');
        setSortOrder('newest');
    };

    const hasActiveFilters = searchQuery.trim() || selectedMood || selectedTag || sortOrder !== 'newest';

    const handleTabChange = (tab: TabType) => {
        router.push(`/journal?tab=${tab}&page=1`);
    };

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(page));
        router.push(`/journal?${params.toString()}`);
    };

    // Invalidate cache and trigger refresh (debounced)
    const invalidateCache = () => {
        console.log('[Cache] Invalidating cache');
        try {
            clearJournalCache();
        } catch (err) {
            console.warn('[Cache] Failed to clear journal store cache', err);
        }
    };
    
    // Refresh entries after actions (with debounce)
    const refreshEntries = async () => {
        // Invalidate cache to force refetch
        invalidateCache();
    };

    // Handle favorite toggle with optimistic update
    const handleToggleFavorite = async (journalId: string, newValue: boolean) => {
        // Optimistic update
        const previousEntries = entries;
        const previousStats = stats;
        
        setEntries(prev => prev.map(entry => 
            entry.journalId === journalId 
                ? { ...entry, isFavorite: newValue }
                : entry
        ));
        
        setStats(prev => ({
            ...prev,
            favorites: newValue ? prev.favorites + 1 : prev.favorites - 1
        }));
        
        try {
            const response = await fetch('/api/journals/toggle', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    journal_id: journalId,
                    field: 'is_favorite',
                    value: newValue,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle favorite');
            }
            
            // Success - keep optimistic update
        } catch (error: any) {
            // Rollback on error
            console.error('Failed to toggle favorite:', error);
            setEntries(previousEntries);
            setStats(previousStats);
            alert('Failed to update favorite status. Please try again.');
        }
    };

    // Handle archive toggle with optimistic update
    const handleToggleArchive = async (journalId: string, newValue: boolean) => {
        // Optimistic update
        const previousEntries = entries;
        const previousStats = stats;
        
        setEntries(prev => prev.map(entry => 
            entry.journalId === journalId 
                ? { ...entry, isArchived: newValue }
                : entry
        ));
        
        setStats(prev => ({
            ...prev,
            archived: newValue ? prev.archived + 1 : prev.archived - 1
        }));
        
        try {
            const response = await fetch('/api/journals/toggle', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    journal_id: journalId,
                    field: 'is_archived',
                    value: newValue,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle archive');
            }
            
            // Success - keep optimistic update
        } catch (error: any) {
            // Rollback on error
            console.error('Failed to toggle archive:', error);
            setEntries(previousEntries);
            setStats(previousStats);
            alert('Failed to update archive status. Please try again.');
        }
    };

    // Handle delete (single item)
    const handleDelete = async (journalId: string) => {
        setSelectedIds(new Set([journalId]));
        setShowDeleteModal(true);
    };

    // Handle bulk delete confirmation
    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        try {
            const journalIds = Array.from(selectedIds);
            const response = await fetch('/api/journal?permanent=true', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ journal_ids: journalIds }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete journals');
            }

            // Remove from local state
            setEntries(prev => prev.filter(entry => !selectedIds.has(entry.journalId)));

            // Update stats
            const deletedCount = selectedIds.size;
            setStats(prev => ({
                ...prev,
                total: prev.total - deletedCount,
            }));

            // Reset selection
            setSelectedIds(new Set());
            setSelectionMode(false);
            setShowDeleteModal(false);
        } catch (error) {
            console.error('Error deleting journals:', error);
            alert('Failed to delete journals');
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle selection mode
    const handleToggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedIds(new Set());
    };

    // Toggle individual selection
    const handleToggleSelection = (journalId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(journalId)) {
                newSet.delete(journalId);
            } else {
                newSet.add(journalId);
            }
            return newSet;
        });
    };

    // Select all visible entries
    const handleSelectAll = () => {
        if (selectedIds.size === filteredEntries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEntries.map(e => e.journalId)));
        }
    };

    const tabs = [
        { 
            id: 'all' as TabType, 
            label: 'All Journals', 
            icon: Library,
            count: totalFromApi > 0 ? totalFromApi - stats.archived : stats.total - stats.archived,
        },
        { 
            id: 'favorites' as TabType, 
            label: 'Favorites', 
            icon: Star,
            count: stats.favorites,
        },
        { 
            id: 'archived' as TabType, 
            label: 'Archived', 
            icon: Archive,
            count: stats.archived,
        },
    ];

    const journalBackdrop = isDarkMode
        ? `radial-gradient(circle at 18% 10%, rgba(214, 128, 77, 0.2), transparent 42%),
           radial-gradient(circle at 82% 2%, rgba(123, 188, 175, 0.18), transparent 38%),
           linear-gradient(165deg, rgba(16, 13, 10, 0.98) 0%, rgba(27, 21, 15, 0.96) 45%, rgba(19, 15, 10, 0.99) 100%)`
          : `radial-gradient(circle at 20% 12%, rgba(241, 193, 178, 0.2), transparent 42%),
              radial-gradient(circle at 78% 6%, rgba(166, 210, 199, 0.2), transparent 34%),
              linear-gradient(168deg, #fff8f4 0%, #f9f0e7 46%, #f3e8dd 100%)`;

    return (
        <Layout>
            <div
                className="journal-shell relative left-1/2 right-1/2 -my-6 w-screen -translate-x-1/2 overflow-hidden pb-24"
                style={{ background: journalBackdrop, color: elementColors.text, fontFamily: 'var(--font-family)' }}
            >
                <div className="pointer-events-none absolute inset-0 z-0">
                    <div className="journal-float-a absolute -left-14 top-10 h-64 w-64 rounded-full bg-[#eec6b2]/24 blur-3xl" />
                    <div className="journal-float-b absolute right-0 top-0 h-80 w-80 rounded-full bg-[#e8d4c5]/22 blur-3xl" />
                    <div className="journal-float-c absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-[#bbddd2]/22 blur-3xl" />
                    <div className="journal-grid absolute inset-0 opacity-28" />
                    <div className="journal-noise absolute inset-0 opacity-24 mix-blend-multiply" />
                    <div className="journal-vignette absolute inset-0" />
                </div>


                <main className="relative z-10 mx-auto w-full max-w-[1240px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
                    {/* Header */}
                    <section className="relative mb-5 overflow-hidden rounded-[30px] border border-black/10 bg-[#fff8f3]/92 px-5 py-5 shadow-[0_16px_38px_rgba(53,36,24,0.14)] backdrop-blur-xl sm:px-7 sm:py-6">
                        <div className="absolute inset-0 journal-hero-grain opacity-25" />
                        <div className="absolute -left-16 bottom-3 h-24 w-56 rounded-full bg-[#e8ccb8]/28 blur-2xl" />
                        <div className="absolute right-10 top-7 h-20 w-48 rounded-full bg-[#beded2]/26 blur-2xl" />

                        <div className="inline-flex items-center gap-2 rounded-full border border-[#c49e90]/45 bg-[#f8e4da]/86 px-3 py-1 text-xs font-semibold text-[#7c4f45]">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            Journal Workspace
                        </div>

                        <h1 className="mt-4 text-[36px] leading-[0.98] tracking-[0.015em] text-[#3f2c24] sm:text-[48px]" style={{ fontFamily: 'var(--journal-heading-font)' }}>
                            My Journals
                        </h1>
                        <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[#6a4d43]" style={{ fontFamily: 'var(--journal-body-font)', letterSpacing: '0.015em' }}>
                            View, organize, and protect your entries with a calmer, consistent reflection interface.
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-[#d6bfb2]/60 bg-[#fffdfb]/90 p-3 shadow-sm">
                                <p className="text-xs text-[#7f5f55]">Total Entries</p>
                                <p className="mt-1 text-sm font-semibold text-[#3a2a24]">{totalFromApi > 0 ? totalFromApi : stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-[#d6bfb2]/60 bg-[#fffdfb]/90 p-3 shadow-sm">
                                <p className="text-xs text-[#7f5f55]">Active</p>
                                <p className="mt-1 text-sm font-semibold text-[#3a2a24]">{totalFromApi > 0 ? totalFromApi - stats.archived : stats.total - stats.archived}</p>
                            </div>
                            <div className="rounded-2xl border border-[#d6bfb2]/60 bg-[#fffdfb]/90 p-3 shadow-sm">
                                <p className="text-xs text-[#7f5f55]">Favorites</p>
                                <p className="mt-1 text-sm font-semibold text-[#3a2a24]">{stats.favorites}</p>
                            </div>
                            <div className="rounded-2xl border border-[#d6bfb2]/60 bg-[#fffdfb]/90 p-3 shadow-sm">
                                <p className="text-xs text-[#7f5f55]">Archived</p>
                                <p className="mt-1 text-sm font-semibold text-[#3a2a24]">{stats.archived}</p>
                            </div>
                        </div>
                    </section>

                    {/* Tabs Navigation */}
                    <section className="mb-5 overflow-hidden rounded-[26px] border border-[#d4bdb0]/55 bg-[#fff8f2]/88 p-3.5 shadow-[0_12px_28px_rgba(79,57,39,0.1)] sm:p-4">
                        <div className="mb-3 journal-section-label">
                            <span>Browse + Organize</span>
                        </div>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <nav className="flex flex-wrap gap-3" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = currentTab === tab.id;
                            
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`
                                        flex items-center gap-2 rounded-xl py-2.5 px-3.5 border font-medium text-sm
                                        transition-colors duration-200
                                        ${isActive
                                            ? 'border-[#bd9d8f] bg-[#f8e8de] text-[#7b4e44]'
                                            : 'border-transparent text-[#6a4f42] hover:border-[#c9b0a1]/45 hover:bg-[#fdf4ec]'
                                        }
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{tab.label}</span>
                                    <span
                                        className={`
                                            ml-2 py-0.5 px-2.5 rounded-full text-xs font-semibold
                                            ${isActive
                                                ? 'bg-[#fbe9dd] text-[#8a584d]'
                                                : 'bg-[#f1e7df] text-[#6f574e]'
                                            }
                                        `}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                            </nav>
                        
                            {/* Selection Mode Toggle */}
                            <button
                                onClick={handleToggleSelectionMode}
                                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors min-w-[120px]"
                                style={{
                                    backgroundColor: selectionMode ? '#8a5a4a' : '#fff8ef',
                                    color: selectionMode ? '#ffffff' : '#5f4539',
                                    borderColor: selectionMode ? '#8a5a4a' : '#c6aa9b',
                                }}
                            >
                                {selectionMode ? (
                                    <>
                                        <X className="w-4 h-4" />
                                        <span>Cancel</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare className="w-4 h-4" />
                                        <span>Select</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* Search & Filter Bar */}
                    <section className="mb-5 overflow-visible rounded-[24px] border border-[#d4bdb0]/55 bg-[#fff8f2]/88 p-3.5 shadow-[0_8px_20px_rgba(79,57,39,0.08)] sm:p-4">
                        <div className="flex flex-col gap-3">
                            {/* Top row: search + sort */}
                            <div className="flex gap-2">
                                {/* Search input */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a07b6a] pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search journals…"
                                        className="w-full rounded-xl border border-[#d4bdb0]/70 bg-[#fffdfb] py-2.5 pl-9 pr-4 text-sm text-[#3a2a24] placeholder-[#b09080] outline-none transition-colors focus:border-[#bd9d8f] focus:ring-2 focus:ring-[#e8ccb8]/40"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a07b6a] hover:text-[#6a4030] transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Sort toggle */}
                                <button
                                    onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
                                    title={sortOrder === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
                                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                                        sortOrder !== 'newest'
                                            ? 'border-[#bd9d8f] bg-[#f8e8de] text-[#7b4e44]'
                                            : 'border-[#d4bdb0]/70 bg-[#fffdfb] text-[#6a4f42] hover:border-[#bd9d8f] hover:bg-[#fdf4ec]'
                                    }`}
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                                </button>
                            </div>

                            {/* Bottom row: mood pills + tag dropdown + clear */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9a6f5e] mr-1">Filter:</span>

                                {/* Mood pills */}
                                {allMoods.length > 0 && allMoods.slice(0, 6).map(mood => (
                                    <button
                                        key={mood}
                                        onClick={() => setSelectedMood(m => m === mood ? '' : mood)}
                                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                                            selectedMood === mood
                                                ? 'border-[#bd9d8f] bg-[#f8e8de] text-[#7b4e44]'
                                                : 'border-[#d9c8be]/70 bg-[#fffdfb] text-[#6a4f42] hover:border-[#bd9d8f] hover:bg-[#fdf4ec]'
                                        }`}
                                    >
                                        {mood}
                                    </button>
                                ))}

                                {/* Tag dropdown */}
                                {allTags.length > 0 && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowTagDropdown(v => !v)}
                                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                                selectedTag
                                                    ? 'border-[#bd9d8f] bg-[#f8e8de] text-[#7b4e44]'
                                                    : 'border-[#d9c8be]/70 bg-[#fffdfb] text-[#6a4f42] hover:border-[#bd9d8f] hover:bg-[#fdf4ec]'
                                            }`}
                                        >
                                            <span>{selectedTag ? `#${selectedTag}` : 'Tag'}</span>
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        {showTagDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowTagDropdown(false)} />
                                                <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[140px] rounded-xl border border-[#d4bdb0]/70 bg-[#fffdfb] shadow-lg py-1">
                                                    <button
                                                        onClick={() => { setSelectedTag(''); setShowTagDropdown(false); }}
                                                        className="w-full px-3 py-1.5 text-left text-xs text-[#9a6f5e] hover:bg-[#fdf0e8] transition-colors"
                                                    >All tags</button>
                                                    {allTags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            onClick={() => { setSelectedTag(tag); setShowTagDropdown(false); }}
                                                            className={`w-full px-3 py-1.5 text-left text-xs capitalize transition-colors hover:bg-[#fdf0e8] ${
                                                                selectedTag === tag ? 'font-semibold text-[#7b4e44]' : 'text-[#4a3428]'
                                                            }`}
                                                        >#{tag}</button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Clear filters */}
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="ml-auto flex items-center gap-1 rounded-full border border-[#d9c8be]/70 bg-[#fff4ed] px-2.5 py-1 text-xs font-medium text-[#8a5a48] transition-colors hover:border-[#bd9d8f] hover:bg-[#f8e8de]"
                                    >
                                        <X className="w-3 h-3" />
                                        Clear
                                    </button>
                                )}

                                {/* Results count */}
                                <span className="ml-auto text-xs text-[#a07b6a]">
                                    {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Bulk Action Toolbar */}
                    {selectionMode && selectedIds.size > 0 && (
                        <div className="mb-5 rounded-2xl border border-[#e0b58b]/65 bg-[#fff0de]/90 p-3.5 shadow-sm sm:p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="font-medium text-[#583c25]">
                                        {selectedIds.size} selected
                                    </span>
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-sm text-[#8e4f31] hover:underline"
                                    >
                                        {selectedIds.size === filteredEntries.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete {selectedIds.size > 1 ? `${selectedIds.size} journals` : 'journal'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <section className="min-h-[420px] overflow-hidden rounded-[30px] border border-[#d8c2b5]/55 bg-[#fff8f2]/90 p-3 shadow-[0_12px_28px_rgba(79,57,39,0.1)] sm:p-5">
                    {isLoading ? (
                        <div className="journal-skeleton-list" aria-label="Loading journal entries">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="journal-skeleton-card"
                                    style={{ animationDelay: `${i * 80}ms` }}
                                >
                                    <div className="journal-skeleton-line" style={{ width: '55%', height: '14px', marginBottom: '10px' }} />
                                    <div className="journal-skeleton-line" style={{ width: '90%', height: '11px', marginBottom: '6px' }} />
                                    <div className="journal-skeleton-line" style={{ width: '75%', height: '11px', marginBottom: '14px' }} />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div className="journal-skeleton-line" style={{ width: '52px', height: '20px', borderRadius: '999px' }} />
                                        <div className="journal-skeleton-line" style={{ width: '68px', height: '20px', borderRadius: '999px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center text-red-500">
                                <p>{error}</p>
                            </div>
                        </div>
                    ) : encryptionStatus?.status === 'needs_unlock' ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <BookMarked className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                <h3 className="text-lg font-medium mb-2" style={{ color: elementColors.text }}>
                                    Unlock your encrypted journals
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    Please sign out and sign back in to access entries on this device.
                                </p>
                            </div>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                {currentTab === 'favorites' ? (
                                    <>
                                        <Star className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                        <h3 className="text-lg font-medium mb-2" style={{ color: elementColors.text }}>
                                            No Favorite Journals Yet
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                                            Star your favorite journal entries to see them here
                                        </p>
                                    </>
                                ) : currentTab === 'archived' ? (
                                    <>
                                        <ArchiveX className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                        <h3 className="text-lg font-medium mb-2" style={{ color: elementColors.text }}>
                                            No Archived Journals
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                                            Archive journals to keep them out of sight
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <NotebookPen className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                        <h3 className="text-lg font-medium mb-2" style={{ color: elementColors.text }}>
                                            No Journal Entries Yet
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                                            Start documenting your thoughts and memories
                                        </p>
                                        <Link
                                            href="/journal/new"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
                                            style={{ backgroundColor: elementColors.button }}
                                        >
                                            <NotebookPen className="w-4 h-4" />
                                            Create Your First Entry
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                        <div key={`page-${currentPage}-${currentTab}`} className="journal-cards-enter">
                        <JournalCardWithActions 
                            entries={filteredEntries} 
                            onToggleFavorite={handleToggleFavorite}
                            onToggleArchive={handleToggleArchive}
                            onDelete={handleDelete}
                            showArchived={currentTab === 'archived'}
                            selectionMode={selectionMode}
                            selectedIds={selectedIds}
                            onToggleSelection={handleToggleSelection}
                        />
                        </div>

                        {/* ── Pagination Bar ── */}
                        {totalPages > 1 && (
                            <div className="mt-8 flex flex-col items-center gap-3">
                                {/* Page info */}
                                <p className="text-xs text-[#9a7060]">
                                    Page <span className="font-semibold text-[#6a3e2e]">{currentPage}</span> of <span className="font-semibold text-[#6a3e2e]">{totalPages}</span>
                                    <span className="ml-2 text-[#b09080]">· {totalFromApi} entries total</span>
                                </p>

                                {/* Controls */}
                                <div className="flex items-center gap-1.5">
                                    {/* Prev */}
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4bdb0]/70 bg-[#fffdfb] text-[#6a4f42] shadow-sm transition-all hover:border-[#bd9d8f] hover:bg-[#fdf4ec] disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>

                                    {/* Page numbers with ellipsis */}
                                    {(() => {
                                        const pages: (number | '...')[] = [];
                                        if (totalPages <= 7) {
                                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                                        } else {
                                            pages.push(1);
                                            if (currentPage > 3) pages.push('...');
                                            const start = Math.max(2, currentPage - 1);
                                            const end = Math.min(totalPages - 1, currentPage + 1);
                                            for (let i = start; i <= end; i++) pages.push(i);
                                            if (currentPage < totalPages - 2) pages.push('...');
                                            pages.push(totalPages);
                                        }
                                        return pages.map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-xs text-[#a08070]">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => handlePageChange(p as number)}
                                                    className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-sm font-medium shadow-sm transition-all ${
                                                        p === currentPage
                                                            ? 'border-[#b8897a] bg-[#f4ddd3] text-[#6a3525] shadow-[0_2px_6px_rgba(180,120,90,0.18)]'
                                                            : 'border-[#d4bdb0]/70 bg-[#fffdfb] text-[#6a4f42] hover:border-[#bd9d8f] hover:bg-[#fdf4ec]'
                                                    }`}
                                                    aria-label={`Go to page ${p}`}
                                                    aria-current={p === currentPage ? 'page' : undefined}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        );
                                    })()}

                                    {/* Next */}
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4bdb0]/70 bg-[#fffdfb] text-[#6a4f42] shadow-sm transition-all hover:border-[#bd9d8f] hover:bg-[#fdf4ec] disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                    </section>
                </main>

                {/* Floating Action Button */}
                <div className="fixed bottom-6 right-4 z-50 sm:bottom-8 sm:right-6">
                    <Link
                        href="/journal/new"
                        className="group flex items-center gap-2 rounded-full border border-black/10 px-6 py-3 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                        style={{ backgroundColor: elementColors.button, color: '#ffffff' }}
                    >
                        <NotebookPen className="w-5 h-5 transition-transform group-hover:rotate-6" />
                        <span className="font-medium">New Entry</span>
                    </Link>
                </div>

                <style jsx global>{`
                    @font-face {
                        font-family: 'Hydrogen Whiskey';
                        src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
                        font-display: swap;
                    }

                    @font-face {
                        font-family: 'Terminal Grotesque';
                        src: url('/fonts/terminal-grotesque.ttf') format('opentype');
                        font-display: swap;
                    }

                    :root {
                        --journal-heading-font: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
                        --journal-body-font: 'Avenir Next', 'Segoe UI', 'Trebuchet MS', sans-serif;
                    }

                    @keyframes journalCardEnter {
                        from { opacity: 0; transform: translateY(14px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }

                    .journal-cards-enter {
                        animation: journalCardEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
                    }

                    @keyframes journalSkeletonPulse {
                        0%   { opacity: 1; }
                        50%  { opacity: 0.45; }
                        100% { opacity: 1; }
                    }

                    @keyframes journalSkeletonShimmer {
                        0%   { background-position: -400px 0; }
                        100% { background-position: 400px 0; }
                    }

                    .journal-skeleton-list {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        padding: 4px 0;
                    }

                    .journal-skeleton-card {
                        border-radius: 18px;
                        border: 1px solid rgba(212, 189, 176, 0.5);
                        background: rgba(255, 250, 246, 0.9);
                        padding: 18px 20px;
                        animation: journalSkeletonPulse 1.6s ease-in-out infinite;
                    }

                    .journal-skeleton-line {
                        border-radius: 6px;
                        background: linear-gradient(
                            90deg,
                            rgba(210, 188, 172, 0.35) 0%,
                            rgba(240, 224, 213, 0.7) 40%,
                            rgba(210, 188, 172, 0.35) 80%
                        );
                        background-size: 800px 100%;
                        animation: journalSkeletonShimmer 1.6s linear infinite;
                    }

                    @keyframes journalFloatA {
                        0%, 100% { transform: translateY(0px) translateX(0px); }
                        50% { transform: translateY(-18px) translateX(8px); }
                    }

                    @keyframes journalFloatB {
                        0%, 100% { transform: translateY(0px) translateX(0px); }
                        50% { transform: translateY(14px) translateX(-12px); }
                    }

                    @keyframes journalFloatC {
                        0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
                        50% { transform: translateY(-10px) translateX(12px) scale(1.06); }
                    }

                    @keyframes journalGrid {
                        0% { transform: translate3d(0, 0, 0); }
                        100% { transform: translate3d(-34px, -34px, 0); }
                    }

                    .journal-float-a {
                        animation: journalFloatA 10s ease-in-out infinite;
                    }

                    .journal-float-b {
                        animation: journalFloatB 14s ease-in-out infinite;
                    }

                    .journal-float-c {
                        animation: journalFloatC 18s ease-in-out infinite;
                    }

                    .journal-grid {
                        background-image:
                            linear-gradient(to right, rgba(137, 94, 60, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(137, 94, 60, 0.1) 1px, transparent 1px);
                        background-size: 38px 38px;
                        mask-image: radial-gradient(circle at 50% 38%, black 30%, transparent 84%);
                        animation: journalGrid 42s linear infinite;
                    }

                    .journal-noise {
                        background-image: radial-gradient(rgba(120, 85, 47, 0.08) 0.5px, transparent 0.5px);
                        background-size: 5px 5px;
                    }

                    .journal-hero-grain {
                        background-image: radial-gradient(rgba(112, 79, 47, 0.09) 0.6px, transparent 0.6px);
                        background-size: 5px 5px;
                    }

                    .journal-section-label {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        color: #7a5537;
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        opacity: 0.88;
                        padding: 0 8px;
                        height: 22px;
                        border-radius: 999px;
                        border: 1px solid rgba(151,107,67,0.24);
                        background: rgba(255, 246, 232, 0.68);
                    }

                    .journal-vignette {
                        background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0) 46%, rgba(89,57,28,0.09) 120%);
                    }
                `}</style>
            </div>

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    if (!isDeleting) {
                        setSelectedIds(new Set());
                    }
                }}
                onConfirm={handleDeleteConfirm}
                count={selectedIds.size}
                isDeleting={isDeleting}
            />
        </Layout>
    );
};

// Main component with Suspense boundary
export default function JournalsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(160deg,#fff7f2_0%,#f6ece3_55%,#efe3d7_100%)]">
                <div className="text-center rounded-3xl border border-[#dcc8bb] bg-[#fff8f3]/90 px-8 py-10 shadow-[0_14px_32px_rgba(74,52,37,0.12)]">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#e6d3c6] border-t-[#8f6344]"></div>
                    <p className="mt-4 text-sm font-medium tracking-[0.08em] text-[#7a5442] uppercase">Loading journals</p>
                </div>
            </div>
        }>
            <JournalsPageContent />
        </Suspense>
    );
}
