"use client"
import React, { useEffect, useState } from "react";
import { IoMenu, IoClose } from "react-icons/io5";
import { HiHome, HiUser, HiMail, HiDocumentText, HiSun, HiMoon, HiLogin, HiLogout, HiArchive } from "react-icons/hi";
import { useTheme } from "@/utilities/context/ThemeContext";
import { createClient } from "@/utils/supabase/client";
import { logoutWithCleanup } from "@/utils/auth/logout";
import { usePathname, useRouter } from "next/navigation";

// Define menu item interface
interface MenuItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const Navbar: React.FC = () => {
  const { currentTheme, isDarkMode, toggleDarkMode, elementColors } = useTheme();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  // Check if current page is a journal page
  const isJournalPage = pathname?.includes('/journal/new');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const menuItems: MenuItem[] = [
    { name: "Home", href: "/", icon: <HiHome className="w-5 h-5" /> },
    { name: "About", href: "https://force-about-page.vercel.app/", icon: <HiUser className="w-5 h-5" /> },
    { name: "Contact", href: "/contact", icon: <HiMail className="w-5 h-5" /> },
    { name: "Journal", href: "/journal/new", icon: <HiDocumentText className="w-5 h-5" /> },
  ];

  async function handleAuth() {
    if (user) {
      await logoutWithCleanup();
      router.push('/');
    } else {
      router.push('/login');
    }
  }

  // Create dock items using Hi icons instead of Vsc
  const dockItems = [
    { 
      icon: <HiHome size={24} />, 
      label: 'Home', 
      onClick: () => router.push("/"),
      className: pathname === "/" ? "active-dock-item" : ""
    },
    { 
      icon: <HiArchive size={24} />, 
      label: 'Journal', 
      onClick: () => router.push("/journal/new"),
      className: pathname?.includes("/journal/new") ? "active-dock-item" : ""
    },
    { 
      icon: <HiUser size={24} />, 
      label: 'Profile', 
      onClick: () => router.push("/about"),
      className: pathname === "/about" ? "active-dock-item" : ""
    },
    { 
      icon: isDarkMode ? <HiSun size={24} /> : <HiMoon size={24} />, 
      label: isDarkMode ? 'Light Mode' : 'Dark Mode', 
      onClick: toggleDarkMode 
    },
    { 
      icon: user ? <HiLogout size={24} /> : <HiLogin size={24} />, 
      label: user ? 'Logout' : 'Login', 
      onClick: handleAuth 
    },
  ];

  // Build the navbar classes based on whether it's a journal page
  const navbarClasses = isJournalPage 
    ? `fixed left-4 lg:left-6 top-1/2 -translate-y-1/2 h-[60vh] max-h-[600px] rounded-2xl z-50 transition-all duration-300 ${
        isDarkMode ? "bg-gray-900/95" : "bg-white/95"
      } backdrop-blur-md shadow-xl ${
        isOpen ? "w-64" : "w-16 lg:w-20"
      } overflow-hidden flex flex-col justify-center`
    : `fixed top-4 lg:top-6 left-1/2 transform -translate-x-1/2 z-50 backdrop-blur-lg shadow-lg rounded-full transition-all duration-300 ${
        isScrolled 
          ? `${isDarkMode ? "bg-gray-800/90" : "bg-gray-100/90"} w-[95vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] py-2` 
          : `${isDarkMode ? "bg-gray-900/90" : "bg-white/90"} w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] py-3 sm:py-4 lg:py-5 px-3 sm:px-4`
      }`;

  const activeNavItemClasses = "flex items-center px-4 py-2 rounded-md font-medium";
  const activeClass = `${activeNavItemClasses} bg-primary-light text-primary`;
  const inactiveClass = `${activeNavItemClasses} hover:bg-hover ${isDarkMode ? "text-gray-300" : "text-gray-600"} hover:text-primary transition-colors`;

  // Side navigation specific classes
  const sideNavItemClass = "flex items-center px-4 py-3 hover:bg-hover transition-colors";
  const activeSideNavItem = `${sideNavItemClass} border-l-4 border-primary`;
  const inactiveSideNavItem = `${sideNavItemClass} ${isDarkMode ? "text-gray-300" : "text-gray-600"}`;

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

  // Add custom CSS to fix dock styling
  useEffect(() => {
    // Add necessary CSS for the dock to work properly
    const style = document.createElement('style');
    style.innerHTML = `
      /* Custom dock styling */
      .active-dock-item {
        position: relative;
      }
      .active-dock-item::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 5px;
        height: 5px;
        background-color: ${currentTheme.primary};
        border-radius: 50%;
      }
      
      /* Ensure icons are visible */
      .dock-icon {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        color: ${isDarkMode ? '#f3f4f6' : '#111827'};
      }
      
      /* Remove rotation from icons */
      .vertical-dock .dock-icon svg {
        transform: rotate(90deg);
      }
      
      /* Fix tooltip positioning */
      .vertical-dock .dock-label {
        transform: rotate(90deg) translateX(-50%);
        transform-origin: left center;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [currentTheme.primary, isDarkMode]);

  // Content for the side navigation with Dock
  if (isJournalPage) {
    return (
      <nav className={navbarClasses}>
        <div className="flex flex-col h-full justify-between w-full">
          {/* Top section with logo and toggle */}
          <div className="px-4 pt-4 flex justify-between items-center">
            <span 
              className={`text-2xl font-bold tracking-wider ${!isOpen && "hidden"}`}
              style={textGradientStyle}
            >
              Force
            </span>
            <button
              className={`p-2 rounded-md ${
                isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-200 text-gray-700"
              }`}
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <IoClose className="w-6 h-6" /> : <IoMenu className="w-6 h-6" />}
            </button>
          </div>
          
          {/* Main section with dock or expanded menu */}
          <div className="flex justify-center items-center flex-grow">
            {isOpen ? (
              // Traditional menu for expanded state
              <div className="space-y-2 w-full">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href === "/journal/new" && pathname?.includes('/journal/new'));
                  
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={isActive ? activeSideNavItem : inactiveSideNavItem}
                      style={isActive ? { 
                        borderColor: currentTheme.primary,
                        color: currentTheme.primary
                      } : {}}
                    >
                      <span className="mr-3">{item.icon}</span>
                      <span>{item.name}</span>
                    </a>
                  );
                })}
                <div className="pt-4 px-2">
                  <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center p-2 rounded-full transition-colors"
                    style={{
                      color: isDarkMode ? currentTheme.hover : currentTheme.primary,
                    }}
                    aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {isDarkMode ? <HiSun className="w-5 h-5 mr-2" /> : <HiMoon className="w-5 h-5 mr-2" />}
                    <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                  </button>
                  
                  <button
                    onClick={handleAuth}
                    className="w-full mt-2 px-4 py-2 rounded-full text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300"
                    style={buttonGradientStyle}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundImage = buttonHoverGradientStyle.backgroundImage;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundImage = buttonGradientStyle.backgroundImage;
                    }}
                  >
                    {user ? "Logout" : "Login / Signup"}
                  </button>
                </div>
              </div>
            ) : (
              // Simplified vertical dock for collapsed state
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4 lg:space-y-6">
                  {dockItems.map((item, index) => (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className={`p-2 rounded-lg transition-all hover:scale-110 hover:bg-opacity-20 hover:bg-gray-500 ${
                        item.className || ""
                      }`}
                      style={{
                        color: item.className ? currentTheme.primary : (isDarkMode ? "#f3f4f6" : "#111827")
                      }}
                      aria-label={item.label as string}
                    >
                      <div className="w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center">
                        {item.icon}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom section - empty for balance */}
          <div className="h-4"></div>
        </div>
      </nav>
    );
  }

  // Regular navbar for non-journal pages
  return (
    <nav className={navbarClasses}>
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <span 
              className="text-xl sm:text-2xl font-bold tracking-wider"
              style={textGradientStyle}
            >
              Force
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-1 lg:space-x-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isActive 
                      ? "shadow-sm" 
                      : `hover:bg-opacity-50 ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`
                  }`}
                  style={isActive ? { 
                    backgroundColor: currentTheme.light,
                    color: currentTheme.primary
                  } : { color: isDarkMode ? "#d1d5db" : "#4b5563" }}
                >
                  <span className="mr-2">{item.icon}</span>
                  <span className="hidden lg:inline">{item.name}</span>
                </a>
              );
            })}
          </div>

          {/* Right Section: Dark Mode + Auth */}
          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
                isDarkMode ? "text-yellow-400 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <HiSun className="w-5 h-5" /> : <HiMoon className="w-5 h-5" />}
            </button>

            {/* Auth Button - Hidden on small screens when menu is closed */}
            <button
              onClick={handleAuth}
              className="hidden sm:flex items-center px-3 sm:px-4 py-2 rounded-full text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
              style={buttonGradientStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundImage = buttonHoverGradientStyle.backgroundImage;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundImage = buttonGradientStyle.backgroundImage;
              }}
            >
              {user ? (
                <>
                  <HiLogout className="w-4 h-4 mr-1" />
                  <span className="hidden lg:inline">Logout</span>
                </>
              ) : (
                <>
                  <HiLogin className="w-4 h-4 mr-1" />
                  <span className="hidden lg:inline">Login</span>
                </>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className={`md:hidden p-2 rounded-md transition-colors ${
                isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-200 text-gray-700"
              }`}
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <IoClose className="w-6 h-6" /> : <IoMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isOpen && (
          <div 
            className={`md:hidden mt-3 py-2 rounded-xl shadow-xl backdrop-blur-lg border ${
              isDarkMode ? "bg-gray-800/95 border-gray-700" : "bg-white/95 border-gray-200"
            }`}
          >
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 transition-colors ${
                    isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  } ${isActive ? "font-semibold border-l-4" : ""}`}
                  style={isActive ? { 
                    color: currentTheme.primary,
                    borderColor: currentTheme.primary 
                  } : { color: isDarkMode ? "#d1d5db" : "#4b5563" }}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.name}</span>
                </a>
              );
            })}
            
            {/* Mobile Auth Button */}
            <button
              onClick={() => {
                handleAuth();
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-3 mt-2 text-white font-semibold rounded-lg mx-2"
              style={buttonGradientStyle}
            >
              {user ? (
                <>
                  <HiLogout className="w-5 h-5 mr-3" />
                  <span>Logout</span>
                </>
              ) : (
                <>
                  <HiLogin className="w-5 h-5 mr-3" />
                  <span>Login / Signup</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;