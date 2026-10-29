// /apps/web/components/Navbar/SideNavbar.tsx
"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IoMenu, IoClose } from "react-icons/io5";
import { HiHome, HiUser, HiMail, HiDocumentText, HiSun, HiMoon, HiLogin, HiLogout, HiArchive, HiOutlineChip, HiChevronRight, HiPhotograph, HiViewGrid, HiPencilAlt, HiChartBar, HiDocumentSearch, HiDocumentReport, HiCollection, HiChartPie, HiPresentationChartLine, HiEmojiHappy, HiMicrophone, HiVolumeUp, HiAdjustments, HiCog } from "react-icons/hi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GiNotebook } from "react-icons/gi";
import { GrUserSettings } from "react-icons/gr";
import { ColorOption } from "../../utilities/context/ThemeContext";
import DockItem from "./DockItem";
import SubMenuItem from "./SubMenuItem";
import { logoutWithCleanup } from "@/utils/auth/logout";

interface SideNavbarProps {
  currentTheme: ColorOption;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  session: any;
  pathname: string | null;
  menuItems: {
    name: string;
    href: string;
    icon: string;
    subItems?: {
      name: string;
      href: string;
      icon: string;
    }[];
  }[];
}

const ICON_MAP = {
  HiHome: (size: number) => <HiHome size={size} />,
  HiUser: (size: number) => <HiUser size={size} />,
  HiMail: (size: number) => <HiMail size={size} />,
  HiDocumentText: (size: number) => <HiDocumentText size={size} />,
  HiArchive: (size: number) => <HiArchive size={size} />,
  HiOutlineChip: (size: number) => <HiOutlineChip size={size} />,
  GiNotebook: (size: number) => <GiNotebook size={size} />,
  GrUserSettings: (size: number) => <GrUserSettings size={size} />,
  HiPhotograph: (size: number) => <HiPhotograph size={size} />,
  HiViewGrid: (size: number) => <HiViewGrid size={size} />,
  HiPencilAlt: (size: number) => <HiPencilAlt size={size} />,
  HiChartBar: (size: number) => <HiChartBar size={size} />,
  HiCog: (size: number) => <HiCog size={size} />,
  HiDocumentSearch: (size: number) => <HiDocumentSearch size={size} />,
  HiDocumentReport: (size: number) => <HiDocumentReport size={size} />,
  HiCollection: (size: number) => <HiCollection size={size} />,
  HiChartPie: (size: number) => <HiChartPie size={size} />,
  HiPresentationChartLine: (size: number) => <HiPresentationChartLine size={size} />,
  HiEmojiHappy: (size: number) => <HiEmojiHappy size={size} />,
  HiMicrophone: (size: number) => <HiMicrophone size={size} />,
  HiVolumeUp: (size: number) => <HiVolumeUp size={size} />,
  HiAdjustments: (size: number) => <HiAdjustments size={size} />
};

const getIcon = (iconName: string, size = 24) => {
  return ICON_MAP[iconName as keyof typeof ICON_MAP]?.(size) || <HiHome size={size} />;
};

const SideNavbar: React.FC<SideNavbarProps> = ({
  currentTheme,
  isDarkMode,
  toggleDarkMode,
  session,
  pathname,
  menuItems
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showAllIcons, setShowAllIcons] = useState<boolean>(false);
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({});
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showMobileToggle, setShowMobileToggle] = useState<boolean>(false);
  
  const router = useRouter();
  const navbarRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Check screen size and set mobile state
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);


  useEffect(() => {
    setShowMobileToggle(true);
  }, []);

  useEffect(() => {
    if (pathname) {
      const initialExpandedMenus = {} as { [key: string]: boolean };
      
      menuItems.forEach(item => {
        if (item.subItems?.some(subItem => pathname.startsWith(subItem.href))) {
          initialExpandedMenus[item.name] = true;
        }
      });
      
      setExpandedMenus(initialExpandedMenus);
    }
  }, [pathname, menuItems]);

  const toggleSubMenu = useCallback((name: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  }, []);

  const isItemActive = useCallback((href: string) => {
    if (!pathname) return false;
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  }, [pathname]);

  const navigateTo = useCallback((href: string) => {
    router.push(href);
    if (isMobile) {
      setIsOpen(false);
    }
  }, [router, isMobile]);

  const dockItems = useMemo(() => menuItems.map(item => ({
    icon: getIcon(item.icon),
    label: item.name,
    onClick: () => {
      if (item.subItems?.length) {
        setIsOpen(true);
        setTimeout(() => toggleSubMenu(item.name), 50);
      } else {
        navigateTo(item.href);
      }
    },
    isActive: isItemActive(item.href) || (item.subItems?.some(subItem => isItemActive(subItem.href)) ?? false),
    hasSubItems: !!item.subItems?.length
  })), [menuItems, isItemActive, navigateTo, toggleSubMenu]);

  const handleLogout = useCallback(async () => {
    await logoutWithCleanup();
  }, []);

  const specialDockItems = useMemo(() => [
    { 
      icon: isDarkMode ? <HiSun size={24} /> : <HiMoon size={24} />, 
      label: isDarkMode ? 'Light Mode' : 'Dark Mode', 
      onClick: toggleDarkMode,
      isActive: false,
      hasSubItems: false
    },
    { 
      icon: session ? <HiLogout size={24} /> : <HiLogin size={24} />, 
      label: session ? 'Logout' : 'Login', 
      onClick: () => {
        if (session) {
          handleLogout();
        } else {
          router.push('/login');
        }
      },
      isActive: false,
      hasSubItems: false
    },
  ], [isDarkMode, toggleDarkMode, session, handleLogout, router]);

  const allDockItems = useMemo(() => [...dockItems, ...specialDockItems], 
    [dockItems, specialDockItems]);

  const handleToggleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prevIsOpen => !prevIsOpen);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) {
      setShowAllIcons(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile && !isOpen) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setShowAllIcons(false);
      }, 1000);
    }
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (isOpen && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setShowAllIcons(true);
    }
  }, [isOpen]);

  const textGradientStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(120deg, ${currentTheme.primary}, ${currentTheme.hover})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }), [currentTheme]);

  const buttonGradientStyle = useMemo(() => ({
    background: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.hover})`,
  }), [currentTheme]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (isOpen && drawerRef.current && !drawerRef.current.contains(event.target as Node) &&
          navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isMobile && e.touches[0]) {
      touchStartRef.current = e.touches[0].clientX;
    }
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !touchStartRef.current || !e.touches[0]) return;
    
    const touchX = e.touches[0].clientX;
    const diff = touchStartRef.current - touchX;
    
    if (diff > 50 && isOpen) {
      setIsOpen(false);
      touchStartRef.current = null;
    }
    
    if (diff < -50 && !isOpen && touchStartRef.current !== null && touchStartRef.current < 50) {
      setIsOpen(true);
      touchStartRef.current = null;
    }
  }, [isOpen, isMobile]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const visibleItems = useMemo(() => showAllIcons 
    ? allDockItems 
    : allDockItems.filter(item => item.isActive),
  [showAllIcons, allDockItems]);

  const dockBgColor = useMemo(() => isDarkMode 
    ? "bg-gray-900/95 backdrop-blur-md" 
    : "bg-white/95 backdrop-blur-md",
  [isDarkMode]);

  const drawerBgColor = useMemo(() => isDarkMode 
    ? "bg-gray-900" 
    : "bg-white",
  [isDarkMode]);

  const textColor = useMemo(() => isDarkMode 
    ? "text-gray-100" 
    : "text-gray-900",
  [isDarkMode]);

  const secondaryTextColor = useMemo(() => isDarkMode 
    ? "text-gray-400" 
    : "text-gray-500",
  [isDarkMode]);

  const drawerVariants = {
    closed: {
      x: "-100%",
      boxShadow: "0px 0px 0px rgba(0, 0, 0, 0)"
    },
    open: {
      x: 0,
      boxShadow: isMobile ? "0px 0px 20px rgba(0, 0, 0, 0.3)" : "5px 0px 15px rgba(0, 0, 0, 0.1)"
    }
  };

  const springTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 1
  };

  const fadeTransition = { 
    duration: 0.2, 
    ease: [0.4, 0, 0.2, 1] as const
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && showMobileToggle && (
        <motion.button
          onClick={handleToggleClick}
          className={`fixed top-4 left-4 z-50 p-3 rounded-full shadow-lg ${dockBgColor} ${textColor} md:hidden`}
          style={{
            background: isDarkMode 
              ? 'linear-gradient(135deg, rgba(31, 41, 55, 0.95), rgba(55, 65, 81, 0.95))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.95))'
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
          aria-controls="sidebar-drawer"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <IoClose className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <IoMenu className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            className="fixed inset-0 bg-opacity-50 z-30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            onClick={() => setIsOpen(false)}
            role="presentation"
          />
        )}
      </AnimatePresence>

      {/* Desktop Dock - Hidden on mobile */}
      {!isMobile && (
        <motion.div
          ref={navbarRef}
          className={`fixed left-6 top-1/2 -translate-y-1/2 h-auto rounded-2xl z-40 transition-all duration-200 ${dockBgColor} shadow-lg shadow-black/5 w-16 overflow-visible hidden md:block`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springTransition}
          role="navigation"
          aria-label="Quick navigation"
        >
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <motion.button
              onClick={handleToggleClick}
              className={`p-3 rounded-full transition-all ${
                isDarkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-200 text-gray-700"
              } ${isOpen ? (isDarkMode ? "bg-gray-800" : "bg-gray-200") : ""}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-expanded={isOpen}
              aria-label="Toggle navigation menu"
              aria-controls="sidebar-drawer"
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IoClose className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IoMenu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item) => (
                <DockItem
                  key={`dock-${item.label}`}
                  icon={item.icon}
                  label={item.label}
                  isActive={item.isActive}
                  onClick={item.onClick}
                  currentTheme={currentTheme}
                  isDarkMode={isDarkMode}
                  hasSubItems={item.hasSubItems}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Sidebar Drawer */}
      <motion.div
        ref={drawerRef}
        id="sidebar-drawer"
        className={`fixed top-0 left-0 z-40 h-screen overflow-y-auto ${
          isMobile ? 'w-80 max-w-[85vw]' : 'w-72'
        } ${drawerBgColor} ${textColor}`}
        style={{
          padding: isMobile ? '1rem' : '1rem',
          paddingTop: isMobile ? '5rem' : '1rem'
        }}
        variants={drawerVariants}
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        transition={springTransition}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation sidebar"
      >
        {/* Header - Desktop only */}
        {!isMobile && (
          <div className="flex justify-between items-center mb-6">
            <motion.h5 
              className="text-xl font-bold"
              style={textGradientStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Force
            </motion.h5>
            <motion.button
              onClick={() => setIsOpen(false)}
              className={`rounded-lg p-1.5 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-200'}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Close navigation menu"
            >
              <IoClose className="w-6 h-6" />
            </motion.button>
          </div>
        )}

        {/* Mobile Header */}
        {isMobile && (
          <div className="mb-6">
            <motion.h5 
              className="text-2xl font-bold text-center"
              style={textGradientStyle}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Force
            </motion.h5>
          </div>
        )}

        {/* User Info */}
        {session && (
          <motion.div 
            className={`flex items-center mb-6 pb-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${
              isMobile ? 'justify-center' : ''
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
              style={{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.hover})` }}
            >
              {session.user?.name?.charAt(0) || "U"}
            </div>
            <div className="ml-3">
              <p className="font-medium text-lg">{session.user?.name || "User"}</p>
              <p className={`text-sm ${secondaryTextColor}`}>{session.user?.email}</p>
            </div>
          </motion.div>
        )}

        {/* Menu Items */}
        <div className="py-4 overflow-y-auto">
          <ul className="space-y-2 font-medium" role="menu">
            {menuItems.map((item, index) => {
              const isActive = isItemActive(item.href) || 
                (item.subItems?.some(subItem => isItemActive(subItem.href)) ?? false);
              const isExpanded = expandedMenus[item.name] || (isActive && item.subItems);
              
              return (
                <motion.li
                  key={`menu-${item.name}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  role="none"
                >
                  {item.subItems ? (
                    <>
                      <motion.button
                        type="button"
                        className={`flex items-center w-full p-4 text-base transition-all duration-100 rounded-lg ${
                          isDarkMode
                            ? isActive ? "bg-gray-800" : "hover:bg-gray-800"
                            : isActive ? "bg-gray-100" : "hover:bg-gray-100"
                        }`}
                        onClick={() => toggleSubMenu(item.name)}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        style={isActive ? { color: currentTheme.primary } : {}}
                        aria-expanded={!!isExpanded}
                        aria-controls={`submenu-${index}`}
                        role="menuitem"
                      >
                        <span className="mr-3">{getIcon(item.icon, isMobile ? 24 : 20)}</span>
                        <span className="flex-1 text-left">{item.name}</span>
                        <motion.span
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <HiChevronRight className="w-5 h-5" />
                        </motion.span>
                      </motion.button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            id={`submenu-${index}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                            role="menu"
                          >
                            <div className="py-2 space-y-1">
                              {item.subItems.map((subItem, subIndex) => (
                                <SubMenuItem
                                  key={`submenu-${item.name}-${subItem.name}`}
                                  item={subItem}
                                  isActive={isItemActive(subItem.href)}
                                  currentTheme={currentTheme}
                                  isDarkMode={isDarkMode}
                                  onClick={() => {
                                    if (isMobile) {
                                      setTimeout(() => setIsOpen(false), 150);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link href={item.href} passHref>
                      <motion.div
                        className={`flex items-center p-4 rounded-lg transition-all duration-100 ${
                          isDarkMode
                            ? isActive ? "bg-gray-800" : "hover:bg-gray-800"
                            : isActive ? "bg-gray-100" : "hover:bg-gray-100"
                        }`}
                        style={isActive ? { color: currentTheme.primary } : {}}
                        whileHover={{ x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        role="menuitem"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          if (isMobile) {
                            setTimeout(() => setIsOpen(false), 150);
                          }
                        }}
                      >
                        <span className="mr-3">{getIcon(item.icon, isMobile ? 24 : 20)}</span>
                        <span className="text-base">{item.name}</span>
                      </motion.div>
                    </Link>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </div>
        
        {/* Footer Actions */}
        <motion.div 
          className={`mt-8 space-y-4 border-t pt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            onClick={toggleDarkMode}
            className={`w-full flex items-center p-4 rounded-lg ${
              isDarkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-700"
            }`}
            whileHover={{ x: 5 }}
            whileTap={{ scale: 0.98 }}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            {isDarkMode ? <HiSun className="w-6 h-6 mr-3" /> : <HiMoon className="w-6 h-6 mr-3" />}
            <span className="text-base">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </motion.button>
          
          {session ? (
            <motion.button
              onClick={handleLogout}
              className="w-full mt-2 px-4 py-4 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 text-base"
              style={buttonGradientStyle}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Logout
            </motion.button>
          ) : (
            <motion.button
              onClick={() => router.push('/login')}
              className="w-full mt-2 px-4 py-4 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 text-base"
              style={buttonGradientStyle}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Login / Signup
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </>
  );
};

export default SideNavbar;
