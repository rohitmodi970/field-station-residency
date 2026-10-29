// apps/web/components/Navbar/MainNavbar.tsx
"use client"
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SideNavbar from "./SideNavbar";
import RegularNavbar from "./RegularNavbar";

// Pages where authenticated users always see a navbar
const AUTHENTICATED_ALWAYS_SHOW = [
  '/dashboard', '/journal', '/analysis', '/settings',
  '/profile', '/whats-next', '/about', '/contact', '/user'
];

// Pages that should use the side nav layout
const SIDE_NAV_PATHS = ['/journal', '/analysis', '/user', '/dashboard', '/settings', '/whats-next'];

// Pages where navbar is never shown (auth flow pages)
const NAVBAR_HIDDEN_PATHS = ['/login', '/register', '/confirmation', '/terms-and-conditions'];

const MainNavbar = () => {
  const { 
    colorOptions, 
    currentTheme, 
    isDarkMode, 
    toggleDarkMode, 
    setCurrentTheme,
    elementColors,
    pageBackground
  } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  
  // Stable supabase client ref — don't recreate on every render
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  
  // Fetch user session
  useEffect(() => {
    let isMounted = true;
    
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(user);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    fetchUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Memoize whether current page is a specific type
  const pageTypes = useMemo(() => ({
    isJournalPage: pathname?.includes('/journal') ?? false,
    isJournalEntry: pathname?.includes('/journal/new') ?? false,
    isHomePage: pathname === '/',
    isLoginPage: pathname === '/login',
    isLandingPage: pathname === '/landing',
    isTermsPage: pathname === '/terms-and-conditions',
    isConfirmationPage: pathname === '/confirmation',
    isRegisterPage: pathname === '/register',
    isDashboardPage: pathname === '/dashboard' || pathname?.startsWith('/dashboard/'),
    isUserPath: pathname?.startsWith('/user') ?? false,
  }), [pathname]);

  // Determine if we should show the side nav layout
  const useSideNav = useMemo(() => {
    if (!pathname) return false;
    return SIDE_NAV_PATHS.some(path => pathname.startsWith(path));
  }, [pathname]);

  // Determine if navbar should be visible at all
  const showNavbar = useMemo(() => {
    if (!pathname) return false;
    
    // Never show on auth-flow pages
    if (NAVBAR_HIDDEN_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
      return false;
    }
    
    // Must be logged in
    if (!user) return false;
    
    // Home page for authenticated users
    if (pathname === '/') return true;
    
    // Check against all known authenticated paths
    if (AUTHENTICATED_ALWAYS_SHOW.some(path => pathname.startsWith(path))) {
      return true;
    }
    
    // Check against menu item hrefs as fallback
    const allMenuPaths = [...privateMenuItems, ...sideNavMenuItems].map(item => item.href);
    return allMenuPaths.some(path => path !== '/' && pathname.startsWith(path));
  }, [pathname, user]);

  // Setup scroll listener only for regular navbar
  useEffect(() => {
    if (useSideNav) {
      setIsScrolled(false);
      return;
    }
    
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    // Set initial state
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [useSideNav]);

  // Memoize menu items to prevent unnecessary re-renders
  const sideNavMenuItems = useMemo(() => [
    {
      name: 'Dashboard',
      href: user ? '/dashboard' : '/',
      icon: 'HiHome',
    },
    {
      name: 'Journal',
      href: '/journal',
      icon: 'GiNotebook',
      subItems: [
        {
          name: 'Create Entry',
          href: '/journal/new',
          icon: 'HiPencilAlt',
        },
        {
          name: 'Diary View',
          href: '/journal/my-diary',
          icon: 'HiCollection',
        },
        {
          name: 'Journals List',
          href: '/journal',
          icon: 'HiDocumentText',
        },
        {
          name: 'All Entries',
          href: '/journal/gallery',
          icon: 'HiDocumentText',
        },
        {
          name: 'Gallery',
          href: '/journal/quilted-gallery',
          icon: 'HiPhotograph',
        },
      ],
    },
    {
      name: 'Insights',
      href: '/analysis',
      icon: 'HiChartPie',
      subItems: [
        {
          name: 'Emotional Quotient',
          href: '/analysis/advanced',
          icon: 'HiDocumentReport',
        },
        // {
        //   name: 'Pattern Recognition',
        //   href: '/analysis/entries',
        //   icon: 'HiDocumentSearch',
        // },
        {
          name: 'Tone & Energy',
          href: '/analysis/audio-analysis',
          icon: 'HiVolumeUp',
        },
      ],
    },
    {
      name: 'Account',
      href: '/settings',
      icon: 'HiUser',
    },
    {
      name: "What's Next",
      href: '/whats-next',
      icon: 'HiOutlineChip',
    },
  ], [user]);

  // Memoize public and private menu items
  const publicMenuItems = useMemo(() => [
    { name: "Home", href: "/", icon: "HiHome" },
    { name: "Landing", href: "/landing", icon: "HiOutlineZap" },
    { name: "About", href: "/about", icon: "HiUser" },
    { name: "Contact", href: "/contact", icon: "HiMail" },
  ], []);

  const privateMenuItems = useMemo(() => [
    { name: "Dashboard", href: "/dashboard", icon: "HiHome" },
    { name: "New Entry", href: "/journal/new", icon: "GiNotebook" },
    { name: "All Journals", href: "/journal/journals", icon: "HiDocumentText" },
    { name: "Journal", href: "/journal/my-diary", icon: "HiDocumentText" },
    { name: "Analysis", href: "/analysis", icon: "HiChartPie" },
    { name: "Profile", href: "/profile", icon: "HiUser" },
  ], []);

  // Don't render anything while loading or when navbar shouldn't show
  if (loading || !showNavbar) {
    return null;
  }

  // Create session object compatible with existing navbar components
  const session = user ? {
    user: {
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    }
  } : null;

  // Determine which navbar to show
  return useSideNav ? (
    <SideNavbar
      currentTheme={currentTheme}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode} 
      session={session}
      pathname={pathname}
      menuItems={sideNavMenuItems}
    />
  ) : (
    <RegularNavbar
      currentTheme={currentTheme}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
      pathname={pathname}
      menuItems={session ? privateMenuItems : publicMenuItems}
      isScrolled={isScrolled}
      colorOptions={colorOptions}
      setCurrentTheme={setCurrentTheme}
      session={session}
    />
  );
};

export default MainNavbar;