"use client";

import { Inter } from 'next/font/google';
import { ReactNode, Suspense } from 'react';
import { ThemeProvider } from '@/utilities/context/ThemeContext';
import { ThemeBody } from '@/components/ThemeBody';
import localFont from 'next/font/local';
import { Toaster } from '@/components/ui/quilted-gallery/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/quilted-gallery/ui/sonner';
import NavigationLoader from '@/components/NavigationLoader';
import { AuthToastHandler } from '@/components/auth/AuthToastHandler';

// Primary web font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const hydrogen = localFont({
  src: '../public/fonts/Hydrogen_Whiskey.otf',
  variable: '--font-hydrogen',
  display: 'swap',
});

const terminalGrotesqueOpen = localFont({
  src: '../public/fonts/terminal-grotesque_open.otf',
  variable: '--font-terminal-grotesque-open',
  display: 'swap',
});

const terminalGrotesque = localFont({
  src: '../public/fonts/terminal-grotesque.ttf',
  variable: '--font-terminal-grotesque',
  display: 'swap',
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <div
      className={`${inter.variable} ${hydrogen.variable} ${terminalGrotesqueOpen.variable} ${terminalGrotesque.variable}`}
    >
      <ThemeProvider>
        <ThemeBody>
          <NavigationLoader />
          {children}
          <Toaster />
          <SonnerToaster richColors position="bottom-right" />
          <Suspense fallback={null}>
            <AuthToastHandler />
          </Suspense>
        </ThemeBody>
      </ThemeProvider>
    </div>
  );
}