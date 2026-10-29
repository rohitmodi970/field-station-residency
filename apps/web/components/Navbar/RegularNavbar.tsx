// apps/web/components/Navbar/RegularNavbar.tsx
"use client"
import React, { useState, useEffect, useCallback, useRef } from "react";
import { IoMenu, IoClose } from "react-icons/io5";
import { HiHome, HiUser, HiMail, HiDocumentText, HiSun, HiMoon, HiOutlineChip } from "react-icons/hi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Palette } from "lucide-react";
import { GiNotebook } from "react-icons/gi";
import { GrUserSettings } from "react-icons/gr";
import { logoutWithCleanup } from "@/utils/auth/logout";
import { motion, AnimatePresence } from "framer-motion";

// Define props interface for regular navbar
interface RegularNavbarProps {
  currentTheme: {
    name: string;
    primary: string;
    hover: string;
    active: string;
    light: string;
  };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  pathname: string | null;
  menuItems: {
    name: string;
    href: string;
    icon: string;
  }[];
  isScrolled: boolean;
  colorOptions: Array<{
    name: string;
    primary: string;
    hover: string;
    active: string;
    light: string;
  }>;
  setCurrentTheme: (theme: any) => void;
  session: any;
}

// Icon size map — use fixed classes so Tailwind JIT can compile them
const ICON_SIZE_CLASSES: Record<number, string> = {
  4: "w-4 h-4",
  5: "w-5 h-5",
  6: "w-6 h-6",
};

const RegularNavbar: React.FC<RegularNavbarProps> = ({
  currentTheme,
  isDarkMode,
  toggleDarkMode,
  pathname,
  menuItems,
  isScrolled,
  colorOptions = [],
  setCurrentTheme,
  session
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showThemeSelector, setShowThemeSelector] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const themeSelectorRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
    setShowThemeSelector(false);
    setShowUserMenu(false);
  }, [pathname]);

  // Click outside handler — stable callback, uses refs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showThemeSelector && themeSelectorRef.current && !themeSelectorRef.current.contains(target)) {
        setShowThemeSelector(false);
      }
      if (showUserMenu && userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeSelector, showUserMenu]);

  // Close dropdowns on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowThemeSelector(false);
        setShowUserMenu(false);
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAuth = useCallback(async () => {
    if (session) {
      await logoutWithCleanup();
    } else {
      router.push('/login');
    }
  }, [session, router]);

  // Get the appropriate icon component — fixed size classes
  const getIcon = (iconName: string, size = 5) => {
    const sizeClass = ICON_SIZE_CLASSES[size] || "w-5 h-5";
    const icons: Record<string, React.ReactNode> = {
      HiHome: <HiHome className={sizeClass} />,
      HiUser: <HiUser className={sizeClass} />,
      HiMail: <HiMail className={sizeClass} />,
      HiDocumentText: <HiDocumentText className={sizeClass} />,
      HiOutlineChip: <HiOutlineChip className={sizeClass} />,
      GiNotebook: <GiNotebook className={sizeClass} />,
      GrUserSettings: <GrUserSettings className={sizeClass} />,
    };
    return icons[iconName] || <HiHome className={sizeClass} />;
  };

  // Check active state — handle both exact and prefix matching
  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Regular navbar classes
  const navbarClasses = `fixed top-6 left-1/2 transform -translate-x-1/2 z-50 backdrop-blur-lg shadow-md rounded-3xl transition-all duration-300 ${
    isScrolled
      ? `${isDarkMode ? "bg-gray-800/80" : "bg-gray-200/80"} w-[60vw] py-2`
      : `${isDarkMode ? "bg-gray-900/80" : "bg-white/80"} w-[90vw] max-w-7xl py-5 px-2.5`
  }`;

  const activeNavItemClasses = "flex items-center px-4 py-2 rounded-md font-medium transition-all duration-300";

  // Dynamic styles based on theme
  const textGradientStyle = {
    backgroundImage: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.hover})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent'
  };

  const buttonGradientStyle = {
    backgroundImage: `linear-gradient(to right, ${currentTheme.primary}, ${currentTheme.active})`,
  };

  const buttonHoverGradientStyle = {
    backgroundImage: `linear-gradient(to right, ${currentTheme.active}, ${currentTheme.primary})`,
  };

  // Theme selector popup styles
  const themeSelectorStyle = {
    backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
    color: isDarkMode ? "#F9FAFB" : "#1F2937",
    borderColor: isDarkMode ? "#374151" : "#E5E7EB",
  };

  return (
    <nav className={navbarClasses} role="navigation" aria-label="Main navigation">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold" style={textGradientStyle}>
              Force
            </Link>
          </div>
          <div className="hidden md:flex space-x-2">
            {menuItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${activeNavItemClasses} ${
                    active
                      ? ''
                      : `hover:opacity-80 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`
                  }`}
                  style={active ? {
                    backgroundColor: currentTheme.light,
                    color: currentTheme.primary
                  } : {}}
                  title={item.name}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={`${isScrolled ? 'mr-0' : 'mr-2'}`}>{getIcon(item.icon)}</span>
                  <span className={`transition-all duration-300 ${isScrolled ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center ml-4 gap-2">
            {/* Theme Selector Button */}
            <div className="relative" ref={themeSelectorRef}>
              <button
                onClick={() => {
                  setShowThemeSelector(!showThemeSelector);
                  setShowUserMenu(false);
                }}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-200"
                }`}
                style={{
                  backgroundColor: showThemeSelector
                    ? (isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)")
                    : "transparent",
                  color: currentTheme.primary
                }}
                aria-label="Theme options"
                aria-expanded={showThemeSelector}
                title="Theme options"
              >
                <Palette className="w-5 h-5" />
              </button>

              {/* Theme Selector Popup */}
              <AnimatePresence>
                {showThemeSelector && (
                  <motion.div
                    className="absolute right-0 top-12 w-64 p-4 rounded-lg shadow-lg z-10 border"
                    style={themeSelectorStyle}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h3 className="text-sm font-medium mb-3">Theme Colors</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {colorOptions.map((color) => (
                        <button
                          key={color.name}
                          onClick={() => setCurrentTheme(color)}
                          className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                            currentTheme.name === color.name ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: color.primary }}
                          aria-label={`Select ${color.name} theme`}
                          aria-pressed={currentTheme.name === color.name}
                        />
                      ))}
                    </div>

                    <h3 className="text-sm font-medium mb-3">Display Mode</h3>
                    <button
                      onClick={() => {
                        toggleDarkMode();
                        setShowThemeSelector(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-md w-full transition-colors"
                      style={{
                        backgroundColor: isDarkMode ? currentTheme.primary : 'transparent',
                        color: isDarkMode ? 'white' : (isDarkMode ? "#F9FAFB" : "#1F2937"),
                        border: isDarkMode ? 'none' : '1px solid #E5E7EB'
                      }}
                    >
                      {isDarkMode ? (
                        <>
                          <HiMoon className="w-4 h-4" />
                          <span>Dark Mode</span>
                        </>
                      ) : (
                        <>
                          <HiSun className="w-4 h-4" />
                          <span>Light Mode</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dark Mode Quick Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <HiSun className="w-5 h-5" /> : <HiMoon className="w-5 h-5" />}
            </button>

            {/* User Profile Dropdown */}
            {session?.user ? (
              <div className="relative" ref={userDropdownRef}>
                <button 
                  onClick={() => {
                    setShowUserMenu(!showUserMenu);
                    setShowThemeSelector(false);
                  }}
                  className={`flex items-center gap-2 transition-all duration-300 font-medium rounded-lg text-sm ${
                    isScrolled ? 'p-2 rounded-full' : 'px-4 py-2 rounded-lg'
                  }`}
                  style={{
                    backgroundColor: currentTheme.light,
                    color: currentTheme.primary
                  }}
                  type="button"
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                >
                  {isScrolled ? (
                    <HiUser className="w-5 h-5" />
                  ) : (
                    <>
                      <span>{session.user.name}</span>
                      <svg className="w-2.5 h-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/>
                      </svg>
                    </>
                  )}
                </button>

                {/* Dropdown menu */}
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      className={`absolute right-0 top-12 z-10 divide-y rounded-lg shadow-lg w-44 ${
                        isDarkMode ? "bg-gray-700 divide-gray-600" : "bg-white divide-gray-100"
                      }`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="px-4 py-3 text-sm" style={{ color: isDarkMode ? "#FFFFFF" : "#111827" }}>
                        <div>{session.user.name}</div>
                        <div className="font-medium truncate">{session.user.email}</div>
                      </div>
                      <ul className={`py-2 text-sm ${isDarkMode ? "text-gray-200" : "text-gray-700"}`} role="menu">
                        <li role="none">
                          <Link href="/dashboard" className={`px-4 py-2 flex items-center gap-2 ${
                            isDarkMode ? "hover:bg-gray-600 hover:text-white" : "hover:bg-gray-100"
                          }`} role="menuitem" onClick={() => setShowUserMenu(false)}>
                            <HiDocumentText className="w-4 h-4" />
                            <span>Dashboard</span>
                          </Link>
                        </li>
                        <li role="none">
                          <Link href="/profile" className={`px-4 py-2 flex items-center gap-2 ${
                            isDarkMode ? "hover:bg-gray-600 hover:text-white" : "hover:bg-gray-100"
                          }`} role="menuitem" onClick={() => setShowUserMenu(false)}>
                            <HiUser className="w-4 h-4" />
                            <span>Profile</span>
                          </Link>
                        </li>
                        <li role="none">
                          <Link href="/settings" className={`px-4 py-2 flex items-center gap-2 ${
                            isDarkMode ? "hover:bg-gray-600 hover:text-white" : "hover:bg-gray-100"
                          }`} role="menuitem" onClick={() => setShowUserMenu(false)}>
                            <GrUserSettings className="w-4 h-4" />
                            <span>Settings</span>
                          </Link>
                        </li>
                      </ul>
                      <div className="py-2">
                        <button 
                          onClick={handleAuth}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            isDarkMode ? "text-gray-200 hover:bg-gray-600 hover:text-white" : "text-gray-700 hover:bg-gray-100"
                          }`}
                          role="menuitem"
                        >
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={handleAuth}
                className={`transition-all duration-300 text-white font-semibold shadow-md hover:shadow-lg ${
                  isScrolled ? 'p-2 rounded-full' : 'px-4 py-2 rounded-full'
                }`}
                style={buttonGradientStyle}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundImage = buttonHoverGradientStyle.backgroundImage;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundImage = buttonGradientStyle.backgroundImage!;
                }}
                title="Login / Signup"
              >
                {isScrolled ? <HiUser className="w-5 h-5" /> : "Login / Signup"}
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 rounded-md ${
              isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-200 text-gray-700"
            }`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <IoClose className="w-6 h-6" /> : <IoMenu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className={`md:hidden mt-2 py-2 rounded-lg shadow-lg overflow-hidden ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              }`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {menuItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-4 py-2 ${
                      isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"
                    } ${active ? "font-medium" : ""}`}
                    style={active ? { color: currentTheme.primary } : {}}
                    onClick={() => setIsOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="mr-3">{getIcon(item.icon)}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {/* User name display in mobile menu */}
              {session?.user?.name && (
                <div className="px-4 py-2 mb-1" style={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>
                  <span>Signed in as:</span>
                  <div className="font-medium mt-1" style={{ color: currentTheme.primary }}>
                    {session.user.name}
                  </div>
                </div>
              )}

              {/* Theme Options Section */}
              {session && (
                <div className="px-4 py-2 border-t border-b my-2" style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
                  <h3 className="text-sm font-medium mb-2" style={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>Theme Colors</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {colorOptions.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setCurrentTheme(color)}
                        className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                          currentTheme.name === color.name ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color.primary }}
                        aria-label={`Select ${color.name} theme`}
                        aria-pressed={currentTheme.name === color.name}
                      />
                    ))}
                  </div>

                  <h3 className="text-sm font-medium mb-2" style={{ color: isDarkMode ? "#9CA3AF" : "#4B5563" }}>Display Mode</h3>
                  <button
                    onClick={toggleDarkMode}
                    className="flex items-center gap-2 px-3 py-2 rounded-md w-full mb-2 transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? currentTheme.primary : 'transparent',
                      color: isDarkMode ? 'white' : "#1F2937",
                      border: isDarkMode ? 'none' : '1px solid #E5E7EB'
                    }}
                  >
                    {isDarkMode ? (
                      <>
                        <HiMoon className="w-4 h-4" />
                        <span>Dark Mode</span>
                      </>
                    ) : (
                      <>
                        <HiSun className="w-4 h-4" />
                        <span>Light Mode</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Auth Button in Mobile Menu */}
              <div className="px-4 pt-2 pb-1">
                <button
                  onClick={() => {
                    handleAuth();
                    setIsOpen(false);
                  }}
                  className="w-full text-center py-2 rounded-full text-white font-semibold"
                  style={buttonGradientStyle}
                >
                  {session ? "Logout" : "Login / Signup"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default RegularNavbar;