"use client";

import { ReactNode } from "react";
import { useTheme } from "@/utilities/context/ThemeContext";

interface LayoutProps {
  children: ReactNode;
  backgroundClass?: string;
  backgroundStyle?: React.CSSProperties;
}

const Layout = ({ children, backgroundClass = "", backgroundStyle = {} }: LayoutProps) => {
  const { pageBackground, elementColors, isDarkMode, currentFont } = useTheme();
  
  // Combine custom styles with theme background
  const combinedStyle: React.CSSProperties = {
    ...(pageBackground?.includes('gradient') || pageBackground?.includes('url(')
      ? { backgroundImage: pageBackground, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' as const }
      : { backgroundColor: pageBackground }),
    color: elementColors.text,
    fontFamily: 'var(--font-family)',
    ...backgroundStyle,
  };

  return (
    <div 
      className={`min-h-screen flex flex-col transition-colors duration-200 ${backgroundClass}`}
      style={combinedStyle}
    >
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;