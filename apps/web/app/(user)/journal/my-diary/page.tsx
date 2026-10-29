"use client"

import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "@/components/layout/Layout";
import PageFlipBook from "@/components/Journal/PageFlipBook";
import DiaryStudio, { 
  BackgroundOption, CoverStyle, DiaryFont, CoverWidget, DEFAULT_WIDGETS 
} from "@/components/Journal/DiaryStudio";
import { getAllJournalEntriesWithStatus } from "@/utilities/journal-data";
import Link from "next/link";
import { BookOpen, Zap } from "lucide-react";
import { JournalEntry } from "@/components/Journal/types";
import { createClient } from '@/utils/supabase/client';
import type { EncryptionReadinessResult } from '@/utils/encryption';

// Helper function to convert Tailwind direction to CSS direction
const tailwindToCssDirection = (tailwindDirection: string): string => {
  const directionMap: { [key: string]: string } = {
    "to-r": "to right",
    "to-l": "to left",
    "to-t": "to top",
    "to-b": "to bottom",
    "to-tr": "to top right",
    "to-tl": "to top left",
    "to-br": "to bottom right",
    "to-bl": "to bottom left"
  };
  return directionMap[tailwindDirection] || "to right";
};

const DEFAULT_PAGE_BG: BackgroundOption = {
  type: "gradient",
  name: "Sunset",
  value: "linear-gradient(to bottom right, #fed7aa, #fda4af)",
  className: "bg-gradient-to-br from-orange-200 to-rose-300"
};

const DEFAULT_BOOK_BG = {
  type: 'preset',
  value: 'linear-gradient(135deg, hsl(var(--background)), hsl(var(--card)))'
};

const DEFAULT_COVER: CoverStyle = {
  id: 'leather',
  name: 'Classic Leather',
  variant: 'leather'
};

const DEFAULT_FONT: DiaryFont = {
  id: 'default',
  name: 'Default',
  family: 'inherit',
  category: 'sans-serif'
};

const normalizeCoverWidgets = (widgets: CoverWidget[] | null | undefined, showUsername = true): CoverWidget[] => {
  const list = Array.isArray(widgets) ? widgets.map(widget => ({ ...widget })) : [];
  const hasDiaryTitle = list.some(widget => widget.type === 'diary-title');
  const hasDisplayName = list.some(widget => widget.type === 'display-name');
  const hasUsername = list.some(widget => widget.type === 'username');

  if (!hasDiaryTitle) {
    list.unshift({ id: 'w-title', type: 'diary-title', label: 'Diary Title', enabled: true });
  }

  if (!hasDisplayName) {
    list.splice(1, 0, { id: 'w-display-name', type: 'display-name', label: 'Display Name', enabled: true });
  }

  if (!hasUsername) {
    list.splice(2, 0, { id: 'w-username', type: 'username', label: 'Username', enabled: showUsername });
  }

  return list;
};

const JournalPage = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionReadinessResult | null>(null);
  const [showDiaryStudio, setShowDiaryStudio] = useState(false);
  const [entryImages, setEntryImages] = useState<string[]>([]);

  // Page background (layout/outer background)
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>(DEFAULT_PAGE_BG);
  // Book background (diary page bg inside the flipbook)
  const [bookBackground, setBookBackground] = useState(DEFAULT_BOOK_BG);
  // Cover style
  const [coverStyle, setCoverStyle] = useState<CoverStyle>(DEFAULT_COVER);
  // Font
  const [diaryFont, setDiaryFont] = useState<DiaryFont>(DEFAULT_FONT);
  // Cover widgets
  const [coverWidgets, setCoverWidgets] = useState<CoverWidget[]>(DEFAULT_WIDGETS);
  // Diary identity
  const [diaryTitle, setDiaryTitle] = useState('My Reflections');
  const [diaryDisplayName, setDiaryDisplayName] = useState('');
  const [showUsername, setShowUsername] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJournalEntries = async () => {
    try {
      setIsLoading(true);
      const result = await getAllJournalEntriesWithStatus();
      setEncryptionStatus(result.encryptionStatus);
      setEntries(result.entries);

      // Extract all images from entries
      const allImages = result.entries.flatMap(entry =>
        entry.mediaUrl?.image || []
      );
      setEntryImages(allImages);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
      setError('Failed to load journal entries. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      loadJournalEntries();

      // Load saved diary settings from localStorage
      try {
        const savedBg = localStorage.getItem('journalBackground');
        if (savedBg) {
          const parsed = JSON.parse(savedBg);
          if (parsed.type === "customGradient" && parsed.value) {
            setSelectedBackground({
              ...parsed,
              value: { color1: parsed.value.color1 || "#FFFFFF", color2: parsed.value.color2 || "#EEEEEE", direction: parsed.value.direction || "to-r" }
            });
          } else {
            setSelectedBackground(parsed as BackgroundOption);
          }
        }
        const savedBookBg = localStorage.getItem('journalBookBackground');
        if (savedBookBg) setBookBackground(JSON.parse(savedBookBg));
        const savedCover = localStorage.getItem('journalCoverStyle');
        if (savedCover) setCoverStyle(JSON.parse(savedCover));
        const savedFont = localStorage.getItem('journalDiaryFont');
        if (savedFont) setDiaryFont(JSON.parse(savedFont));
        const savedWidgets = localStorage.getItem('journalCoverWidgets');
        if (savedWidgets) setCoverWidgets(normalizeCoverWidgets(JSON.parse(savedWidgets), localStorage.getItem('journalShowUsername') !== 'false'));
        const savedTitle = localStorage.getItem('journalDiaryTitle');
        if (savedTitle) setDiaryTitle(savedTitle);
        const savedDisplayName = localStorage.getItem('journalDiaryDisplayName');
        if (savedDisplayName !== null) setDiaryDisplayName(savedDisplayName);
        const savedShowUsername = localStorage.getItem('journalShowUsername');
        if (savedShowUsername !== null) setShowUsername(savedShowUsername !== 'false');
      } catch (e) {
        console.error('Failed to parse saved diary settings', e);
      }

      await loadSettingsFromDb();

      if (isActive) {
        setSettingsLoaded(true);
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(() => {
      void saveSettingsToDb();
    }, 900);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [settingsLoaded, selectedBackground, bookBackground, coverStyle, diaryFont, coverWidgets, diaryTitle, diaryDisplayName, showUsername]);

  // Load selected Google Font whenever diaryFont changes
  useEffect(() => {
    if (diaryFont.id === 'default' || !diaryFont.googleFont) return;
    const fontName = diaryFont.name.replace(/ /g, '+');
    const linkId = `google-font-${diaryFont.id}`;
    if (document.getElementById(linkId)) return; // already loaded
    const link = document.createElement('link');
    link.id = linkId;
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, [diaryFont]);

  /** Load all settings from Supabase diary_settings table */
  const loadSettingsFromDb = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('diary_settings')
        .select('settings')
        .eq('user_id', user.id)
        .single();
      if (error || !data?.settings) return;
      const s = data.settings as Record<string, unknown>;
      if (s.pageBg) {
        const bg = s.pageBg as BackgroundOption;
        if (bg && bg.type) setSelectedBackground(bg);
      }
      if (s.bookBg) setBookBackground(s.bookBg as { type: string; value: string });
      if (s.coverStyle) setCoverStyle(s.coverStyle as CoverStyle);
      if (s.font) setDiaryFont(s.font as DiaryFont);
      if (s.widgets) setCoverWidgets(normalizeCoverWidgets(s.widgets as CoverWidget[], typeof s.showUsername === 'boolean' ? s.showUsername : true));
      if (typeof s.diaryTitle === 'string' && s.diaryTitle) setDiaryTitle(s.diaryTitle);
      if (typeof s.diaryDisplayName === 'string') setDiaryDisplayName(s.diaryDisplayName);
      if (typeof s.showUsername === 'boolean') setShowUsername(s.showUsername);
    } catch {
      // Gracefully ignore — table may not exist yet
    }
  }, []);

  /** Save ALL diary settings to Supabase diary_settings table + localStorage */
  const saveSettingsToDb = useCallback(async () => {
    // Always save to localStorage first (instant)
    localStorage.setItem('journalDiaryTitle', diaryTitle);
    localStorage.setItem('journalDiaryDisplayName', diaryDisplayName);
    localStorage.setItem('journalShowUsername', String(showUsername));

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const settings = {
        pageBg: selectedBackground,
        bookBg: bookBackground,
        coverStyle,
        font: diaryFont,
        widgets: coverWidgets,
        diaryTitle,
        diaryDisplayName,
        showUsername,
      };
      await supabase
        .from('diary_settings')
        .upsert({ user_id: user.id, settings }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('[MyDiary] DB save failed:', err);
      throw err; // re-throw so DiaryStudio save button shows error
    } finally {
      setIsSaving(false);
    }
  }, [selectedBackground, bookBackground, coverStyle, diaryFont, coverWidgets, diaryTitle, diaryDisplayName, showUsername]);

  const handlePageBgSelect = useCallback((background: BackgroundOption) => {
    setSelectedBackground(background);
    localStorage.setItem('journalBackground', JSON.stringify(background));
  }, []);

  const handleBookBgSelect = useCallback((type: string, value: any) => {
    const bg = { type, value };
    setBookBackground(bg);
    localStorage.setItem('journalBookBackground', JSON.stringify(bg));
  }, []);

  const handleCoverSelect = useCallback((style: CoverStyle) => {
    setCoverStyle(style);
    localStorage.setItem('journalCoverStyle', JSON.stringify(style));
  }, []);

  const handleFontSelect = useCallback((font: DiaryFont) => {
    setDiaryFont(font);
    localStorage.setItem('journalDiaryFont', JSON.stringify(font));
  }, []);

  const handleWidgetsChange = useCallback((widgets: CoverWidget[]) => {
    setCoverWidgets(widgets);
    localStorage.setItem('journalCoverWidgets', JSON.stringify(widgets));

    const usernameWidget = widgets.find(widget => widget.type === 'username');
    if (usernameWidget) {
      setShowUsername(usernameWidget.enabled);
      localStorage.setItem('journalShowUsername', String(usernameWidget.enabled));
    }
  }, []);

  const handleDiaryTitleChange = useCallback((title: string) => {
    setDiaryTitle(title);
    localStorage.setItem('journalDiaryTitle', title);
  }, []);

  const handleDiaryDisplayNameChange = useCallback((name: string) => {
    setDiaryDisplayName(name);
    localStorage.setItem('journalDiaryDisplayName', name);
  }, []);

  const handleShowUsernameChange = useCallback((enabled: boolean) => {
    setShowUsername(enabled);
    localStorage.setItem('journalShowUsername', String(enabled));
  }, []);



  // Create background style based on selection
  const getBackgroundStyle = () => {
    if (selectedBackground.type === "image") {
      return {
        backgroundImage: `url(${selectedBackground.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    } else if (selectedBackground.type === "solid") {
      return { backgroundColor: selectedBackground.value };
    } else if (selectedBackground.type === "gradient") {
      return {
        backgroundImage: selectedBackground.value
      };
    } else if (selectedBackground.type === "customGradient") {
      const { color1, color2, direction } = selectedBackground.value;
      const cssDirection = tailwindToCssDirection(direction);
      return {
        backgroundImage: `linear-gradient(${cssDirection}, ${color1}, ${color2})`,
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      };
    }
    return {};
  };



  return (
    <>
    <div className={`transition-[margin] duration-300 ease-in-out overflow-x-hidden ${showDiaryStudio ? 'sm:mr-104' : ''}`}>
    <Layout
      backgroundClass={selectedBackground.type === "gradient" && "className" in selectedBackground
        ? selectedBackground.className
        : ""}
      backgroundStyle={getBackgroundStyle()}
    >

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* <div className="mb-4 sm:mb-8 text-center">
      
          <h1 className="text-2xl sm:text-4xl font-bold font-journal mb-1 sm:mb-2 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">My Journal</h1>
          <p className="text-white/80 font-handwriting text-base sm:text-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            A collection of Journal
          </p>
        </div> */}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm sm:text-base animate-pulse">Loading your journal entries...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-destructive text-sm sm:text-base text-center max-w-md">{error}</p>
            <button
              onClick={loadJournalEntries}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : encryptionStatus?.status === 'needs_unlock' ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary/60" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium mb-1">Unlock your diary to continue</p>
              <p className="text-muted-foreground text-sm">Please sign out and sign back in to view encrypted entries on this device.</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary/60" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium mb-1">No journal entries yet</p>
              <p className="text-muted-foreground text-sm">Start writing your first entry to see it here!</p>
            </div>
            <Link
              href="/journal"
              className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create First Entry
            </Link>
          </div>
        ) : (
          <PageFlipBook 
            entries={entries} 
            onEntriesRefresh={loadJournalEntries}
            bookBackground={bookBackground}
            coverStyle={coverStyle}
            diaryFont={diaryFont}
            widgets={coverWidgets}
            diaryTitle={diaryTitle}
            diaryDisplayName={diaryDisplayName || undefined}
            showUsername={showUsername}
          />
        )}
      </div>

      {/* Bottom action bar */}
      <div className={`fixed bottom-4 sm:bottom-8 left-4 right-4 sm:left-8 z-30 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 pointer-events-none transition-[right] duration-300 ease-in-out ${
        showDiaryStudio ? 'sm:right-110' : 'sm:right-8'
      }`}>
        {/* <Link
          href="/journal"
          className="pointer-events-auto flex items-center justify-center sm:justify-start gap-2 bg-amber-800 hover:bg-amber-700 text-white px-4 py-2 rounded-full shadow-lg transition-colors text-sm sm:text-base"
        >
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Gallery View</span>
        </Link> */}

        <button
          onClick={() => setShowDiaryStudio(!showDiaryStudio)}
          className="pointer-events-auto flex items-center justify-center sm:justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg transition-all hover:shadow-xl text-sm sm:text-base"
        >
          <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Diary Studio</span>
        </button>
      </div>


    </Layout>
    </div>

    {/* Diary Studio — Push Sidebar */}
    <DiaryStudio
      isOpen={showDiaryStudio}
      onClose={() => setShowDiaryStudio(false)}
      onApplyPageBackground={handlePageBgSelect}
      currentPageBackground={selectedBackground}
      onApplyBookBackground={handleBookBgSelect}
      currentBookBackground={bookBackground}
      onApplyCoverStyle={handleCoverSelect}
      currentCoverStyle={coverStyle}
      onApplyFont={handleFontSelect}
      currentFont={diaryFont}
      entryImages={entryImages}
      onApplyWidgets={handleWidgetsChange}
      currentWidgets={coverWidgets}
      diaryTitle={diaryTitle}
      diaryDisplayName={diaryDisplayName}
      onDiaryTitleChange={handleDiaryTitleChange}
      onDiaryDisplayNameChange={handleDiaryDisplayNameChange}
      showUsername={showUsername}
      onShowUsernameChange={handleShowUsernameChange}
      onSaveToCloud={saveSettingsToDb}
      isSaving={isSaving}
    />
    </>
  );
};

export default JournalPage;