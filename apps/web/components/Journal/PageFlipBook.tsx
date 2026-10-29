"use client"
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { JournalEntry } from "./types";
import JournalPage from "./JournalPage";
import AestheticDiaryPage from "./AestheticDiaryPage";
import { Button } from "@/components/ui/button2";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "@/utilities/context/ThemeContext";
import type { CoverStyle, DiaryFont, CoverWidget } from "./DiaryStudio";

// Dynamically import HTMLFlipBook with no SSR to avoid hydration issues
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { 
  ssr: false,
  loading: () => null // We render our own skeleton based on dynamic dimensions
});

// Aspect ratio for "diary pages" — 550:733 ≈ 0.75
const ASPECT_RATIO = 550 / 733;
const DESKTOP_WIDTH = 550;
const DESKTOP_HEIGHT = 733;
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

/** Calculate responsive book dimensions from viewport. */
function calcBookSize(viewportW: number, viewportH: number) {
  const isMobile = viewportW < MOBILE_BREAKPOINT;
  const isTablet = viewportW >= MOBILE_BREAKPOINT && viewportW < TABLET_BREAKPOINT;

  if (isMobile) {
    // Use almost full viewport width, leave 32px total horizontal padding
    const w = Math.min(viewportW - 32, 420);
    const h = Math.round(w / ASPECT_RATIO);
    // Ensure height doesn't exceed available viewport (leave room for nav controls)
    const maxH = viewportH - 200;
    if (h > maxH) {
      const adjustedH = maxH;
      const adjustedW = Math.round(adjustedH * ASPECT_RATIO);
      return { width: adjustedW, height: adjustedH, isMobile: true, isTablet: false };
    }
    return { width: w, height: h, isMobile: true, isTablet: false };
  }

  if (isTablet) {
    const w = Math.min(viewportW - 80, 500);
    const h = Math.round(w / ASPECT_RATIO);
    return { width: w, height: h, isMobile: false, isTablet: true };
  }

  return { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, isMobile: false, isTablet: false };
}

interface PageFlipBookProps {
  entries: JournalEntry[];
  onEntriesRefresh?: () => void;
  bookBackground?: { type: string; value: string };
  coverStyle?: CoverStyle;
  diaryFont?: DiaryFont;
  widgets?: CoverWidget[];
  diaryTitle?: string;
  diaryDisplayName?: string;
  showUsername?: boolean;
}

// No decoration types needed — removed thought/decorative pages

const PageFlipBook = ({ entries, onEntriesRefresh, bookBackground, coverStyle, diaryFont, widgets, diaryTitle, diaryDisplayName, showUsername = true }: PageFlipBookProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const bookRef = useRef<any>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const router = useRouter();

  // Responsive dimensions
  const [bookSize, setBookSize] = useState({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, isMobile: false, isTablet: false });

  // Theme context
  const { currentTheme, isDarkMode, elementColors } = useTheme();

  // Use book background from parent, with fallback
  const currentBackground = bookBackground || {
    type: 'preset',
    value: 'linear-gradient(135deg, hsl(var(--background)), hsl(var(--card)))'
  };

  // User info from Supabase
  const [userInfo, setUserInfo] = useState({
    name: 'Your Name',
    email: 'your.email@example.com',
    username: 'username'
  });

  // Lazy-init Supabase client
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    async function getUserInfo() {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('name, email, username')
            .eq('id', user.id)
            .single();

          if (userData) {
            setUserInfo({
              name: userData.name || 'Your Name',
              email: user.email || 'your.email@example.com',
              username: userData.username || 'username'
            });
          }
        }
      } catch (err) {
        console.error('[PageFlipBook] Failed to fetch user info:', err);
      }
    }
    getUserInfo();
  }, [getSupabase]);

  // Responsive sizing — recalculate on mount and resize
  useEffect(() => {
    setIsClient(true);

    function handleResize() {
      setBookSize(calcBookSize(window.innerWidth, window.innerHeight));
    }

    handleResize(); // initial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Show entries in reverse order (oldest first)
  const orderedEntries = useMemo(
    () => (Array.isArray(entries) ? [...entries].reverse() : []),
    [entries]
  );
  
  const handlePageFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
  }, []);
  
  const nextPage = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext();
  }, []);
  
  const prevPage = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev();
  }, []);

  // Build pages: cover → entries → back (no decorative thought pages)
  const pages = useMemo(() => {
    const result: Array<{ type: 'cover' | 'back' | 'entry'; key: string; entry?: JournalEntry }> = [];

    // Cover page
    result.push({ type: 'cover', key: 'cover' });

    // All entries in order
    orderedEntries.forEach((entry) => {
      result.push({ type: 'entry', key: `entry-${entry.journalId || entry.id}`, entry });
    });

    // Back page
    result.push({ type: 'back', key: 'back' });

    return result;
  }, [orderedEntries]);
  
  const totalPages = pages.length;

  const handlePrevClick = useCallback(() => {
    requestAnimationFrame(prevPage);
  }, [prevPage]);

  const handleNextClick = useCallback(() => {
    requestAnimationFrame(nextPage);
  }, [nextPage]);

  const getBackgroundStyle = useCallback(() => {
    if (currentBackground.type === 'preset') {
      if (currentBackground.value === 'transparent') {
        return { backgroundColor: 'transparent' };
      }
      return { backgroundImage: currentBackground.value };
    } else if (currentBackground.type === 'image') {
      return {
        backgroundImage: `url(${currentBackground.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    }
    return {};
  }, [currentBackground]);

  // Skeleton while SSR / loading
  if (!isClient) {
    return (
      <div className="relative mx-auto my-6 sm:my-10 px-4 flex justify-center">
        <div
          className="bg-linear-to-br from-background to-card animate-pulse rounded-lg"
          style={{ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, maxWidth: '100%' }}
        />
      </div>
    );
  }
  
  const { width: bookW, height: bookH, isMobile } = bookSize;
  const backgroundStyle = getBackgroundStyle();

  return (
    <div className="relative mx-auto my-6 sm:my-10 px-2 sm:px-4">
      <div className="flex justify-center" style={{ perspective: '2000px' }}>
        <HTMLFlipBook
          ref={bookRef}
          width={bookW}
          height={bookH}
          size={isMobile ? "stretch" : "fixed"}
          minWidth={280}
          maxWidth={1000}
          minHeight={Math.round(280 / ASPECT_RATIO)}
          maxHeight={1533}
          maxShadowOpacity={isMobile ? 0.1 : 0.2}
          showCover={true}
          mobileScrollSupport={true}
          onFlip={handlePageFlip}
          className="shadow-xl"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={isMobile ? 600 : 800}
          usePortrait={isMobile}
          startZIndex={0}
          autoSize={isMobile}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={isMobile ? 20 : 30}
          showPageCorners={!isMobile}
          disableFlipByClick={true}
        >
          {pages.map((page) => {
            const isEven = pages.indexOf(page) % 2 === 0;
            const evenOddClass = isEven ? 'even-page' : 'odd-page';
            const backgroundClass = `diary-page ${evenOddClass}`;
            
            return (
              <div key={page.key} className="page-wrapper" style={{
                height: bookH,
                width: bookW,
                fontFamily: diaryFont?.family || 'inherit',
                '--font-journal': diaryFont?.family && diaryFont.family !== 'inherit' ? diaryFont.family : undefined,
                '--font-handwriting': diaryFont?.family && diaryFont.family !== 'inherit' ? diaryFont.family : undefined,
              } as React.CSSProperties}>
                {page.type === 'cover' ? (
                  <AestheticDiaryPage  
                    isEven={isEven} 
                    backgroundClass={backgroundClass} 
                    backgroundStyle={backgroundStyle}
                    pageType="cover"
                    userInfo={{ ...userInfo, diaryTitle, diaryDisplayName, showUsername }}
                    coverStyle={coverStyle}
                    widgets={widgets}
                  />
                ) : page.type === 'back' ? (
                  <AestheticDiaryPage  
                    isEven={isEven} 
                    backgroundClass={backgroundClass} 
                    backgroundStyle={backgroundStyle}
                    pageType="back"
                    userInfo={{
                      ...userInfo,
                      totalEntries: orderedEntries.length,
                      diaryTitle,
                      diaryDisplayName
                    }}
                    coverStyle={coverStyle}
                    widgets={widgets}
                  />
                ) : page.entry ? (
                  <JournalPage 
                    entry={page.entry} 
                    isEven={isEven} 
                    backgroundClass={backgroundClass}
                    backgroundStyle={backgroundStyle}
                    onEntryUpdated={onEntriesRefresh}
                  />
                ) : null}
              </div>
            );
          })}
        </HTMLFlipBook>
      </div>
      {/* dont need it  */}
      {/* Personalized welcome message
      <div className="mt-3 sm:mt-4 text-center">
        <p className="font-journal text-base sm:text-lg text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          Welcome back, {userInfo.name?.split(' ')[0] || 'Friend'}! 
        </p>
        <p className="font-journal text-xs sm:text-sm text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
          Your personal diary awaits...
        </p>
      </div> */}
      
      {/* Navigation buttons — positioned relative to the book container */}
      <div className="flex justify-between items-center absolute left-0 right-0 top-1/2 -translate-y-1/2 px-1 sm:px-4 md:px-8 pointer-events-none">
        <Button
          variant="secondary"
          size="icon"
          onClick={handlePrevClick}
          disabled={currentPage === 0}
          className="pointer-events-auto rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/30 shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:scale-105 z-10 h-8 w-8 sm:h-10 sm:w-10"
          aria-label="Previous page"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          onClick={handleNextClick}
          disabled={currentPage >= totalPages - 2}
          className="pointer-events-auto rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/30 shadow-[0_2px_12px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:scale-105 z-10 h-8 w-8 sm:h-10 sm:w-10"
          aria-label="Next page"
        >
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        </Button>
      </div>
      
      {/* Page counter */}
      <div className="mt-4 sm:mt-6 flex justify-center items-center gap-2 sm:gap-4 flex-wrap px-2">
        <div className="text-center text-xs sm:text-sm font-semibold text-white bg-black/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 backdrop-blur-sm shadow-[0_1px_6px_rgba(0,0,0,0.3)]">
          Page {currentPage + 1} of {totalPages}
        </div>
      </div>
    </div>
  );
};

export default PageFlipBook;