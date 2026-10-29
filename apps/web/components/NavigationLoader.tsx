'use client';

/**
 * NavigationLoader
 *
 * Debounced navigation indicator:
 * 1. Only displays if a navigation takes longer than 180ms (instant transitions never flash or stall).
 * 2. As soon as pathname changes, hides quickly (60ms) without locking the screen.
 * 3. Non-blocking (pointer-events: none) to prevent tap locking on mobile.
 */

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationLoader() {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const [show, setShow] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pathname changed = URL settled
  useEffect(() => {
    if (pathname === prevPathnameRef.current) return;
    prevPathnameRef.current = pathname;

    // Clear any pending show timer so fast transitions never flash
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }

    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Hide quickly once the new route settles
    hideTimer.current = setTimeout(() => setShow(false), 60);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  // Intercept internal link clicks with a small 180ms debounce
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Skip external, mailto, tel, hash-only, new-tab links
      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        anchor.target === '_blank'
      ) return;

      // Skip modifier-key combos (user wants to open in new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Skip if same page
      const targetPath = (href.split('?')[0] ?? '').split('#')[0] ?? '';
      if (targetPath === window.location.pathname) return;

      // Clear timers
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);

      // Debounce: Only reveal if transition takes > 180ms
      showTimer.current = setTimeout(() => {
        setShow(true);
      }, 180);
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, []);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes nl-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nl-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nl-scale-in {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Non-blocking backdrop with minimal GPU overhead */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'nl-fade-in 0.12s ease-out forwards',
        }}
      >
        {/* Floating Indicator Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '20px 28px',
            borderRadius: 18,
            backgroundColor: 'rgba(23, 19, 17, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
            animation: 'nl-scale-in 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Spinner ring */}
          <div style={{ position: 'relative', width: 36, height: 36 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2.5px solid rgba(255,255,255,0.15)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2.5px solid transparent',
                borderTopColor: '#ffffff',
                borderRightColor: 'rgba(255,255,255,0.4)',
                animation: 'nl-spin 0.7s linear infinite',
              }}
            />
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
            }}
          >
            Loading…
          </span>
        </div>
      </div>
    </>
  );
}
