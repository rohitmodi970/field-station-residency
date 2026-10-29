'use client';

import React, { useEffect, useRef, useState } from 'react';

const PAGE_WIDTH = 120;
const PAGE_HEIGHT = 1.4 * PAGE_WIDTH;
const PAGE_COLOR = '#F5E6C8';
const LIGHT_PAGE_COLOR = '#3d3420';
const DARK_PAGE_COLOR = '#b8a67f';
const COVER_COLOR = '#1a0d0f';
const TOTAL_PAGES = 11; // including covers

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

const BookPageTurner: React.FC = () => {
  const [progress, setProgress] = useState(0); // 0 -> TOTAL_PAGES
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAutoPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    const speed = 1.4; // 🔥 faster pages per second

    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const delta = (time - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = time;

      setProgress((prev) => {
        const next = prev + speed * delta;
        // Loop the progress between 0 and TOTAL_PAGES
        return next >= TOTAL_PAGES ? next - TOTAL_PAGES : next;
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
  }, [isAutoPlaying]);

  const handleInteraction = () => {
    setIsAutoPlaying(false);
  };

  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(progress * 1.2));

  return (
    <div
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background:
          'radial-gradient(circle at top, #3b2f2a 0%, #151515 60%)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: `${PAGE_WIDTH * 1.5}px`,
          height: `${PAGE_HEIGHT * 1.3}px`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          perspective: '1400px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: `${PAGE_WIDTH}px`,
            height: `${PAGE_HEIGHT}px`,
            transformStyle: 'preserve-3d',
            transform: 'rotateX(18deg) translateY(10px)',
          }}
        >
          {Array.from({ length: TOTAL_PAGES }).map((_, index) => (
            <Page
              key={index}
              index={index}
              progress={progress}
              isFirst={index === 0}
              isLast={index === TOTAL_PAGES - 1}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: '40px',
          color: '#F5E6C8',
          fontSize: '16px',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          letterSpacing: '0.3em',
          opacity: pulse,
        }}
      >
        LOADING JOURNAL...
      </div>

      <div
        style={{
          marginTop: '10px',
          color: '#b8a67f',
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif',
          opacity: 0.6,
        }}
      >
        Tap / click to pause the animation
      </div>
    </div>
  );
};

interface PageProps {
  index: number;
  progress: number;
  isFirst: boolean;
  isLast: boolean;
}

const Page: React.FC<PageProps> = ({ index, progress, isFirst, isLast }) => {
  const pageNumber = index;

  // distance from the "flip cursor"
  const distance = pageNumber - progress;
  const t = clamp(-distance, 0, 1); // 0 -> not flipping, 1 -> fully flipped
  const eased = easeInOutQuad(t);
  const rotateY = eased * 180;

  // layering logic: first page starts highest, goes lowest after flip
  let zIndex: number;
  if (isFirst) {
    // Cover starts at top (2000), goes to bottom (0) as it flips
    zIndex = Math.round(2000 - (rotateY / 180) * 2000);
  } else {
    // Other pages have standard layering
    zIndex = 1000 - index;
  }

  const pageColor = getPageColor(isFirst || isLast);

  const showLogo = isFirst && rotateY < 80;
  const logoOpacity = isFirst ? clamp(1 - rotateY / 80, 0, 1) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        left: `${index * 1.2}px`,
        top: '0',
        transformStyle: 'preserve-3d',
        transformOrigin: '0% 50%',
        transform: `
          translateZ(${(TOTAL_PAGES - index) * 0.4}px)
          rotateY(${-rotateY}deg)
        `,
        background: pageColor,
        borderRadius: isFirst || isLast ? '10px' : '6px',
        boxShadow:
          '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        zIndex,
      }}
    >
      {/* subtle inner shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isFirst || isLast
            ? 'radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 55%)'
            : 'linear-gradient(to right, rgba(0,0,0,0.22), transparent 40%, rgba(0,0,0,0.18))',
          mixBlendMode: 'soft-light',
          pointerEvents: 'none',
        }}
      />

    {/* cover title - only show on front face */}
        {isFirst && !showLogo && rotateY < 90 && (
          <div
            style={{
            position: 'absolute',
            inset: 0,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#f4e6cf',
            fontFamily:
              '"Cormorant Garamond", "Times New Roman", system-ui, serif',
            }}
          >
            <div>
            <div
              style={{
                fontSize: '10px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              JOURNAL
            </div>
            <div
              style={{
                marginTop: '8px',
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              Quiet Pages
            </div>
            </div>
            <div
            style={{
              fontSize: '9px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.65,
              alignSelf: 'flex-end',
            }}
            >
            LOADING...
            </div>
          </div>
        )}

        {/* middle pages content */}
        {!isFirst && !isLast && (
          <div
            style={{
            position: 'absolute',
            inset: 0,
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            color: LIGHT_PAGE_COLOR,
            fontFamily: 'Georgia, serif',
            }}
          >
            <div
            style={{
              fontSize: '8px',
              opacity: 0.5,
              textAlign: 'right',
            }}
            >
            {index}
            </div>
            <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '6px',
            }}
            >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                height: '4px',
                background: `linear-gradient(to right, ${LIGHT_PAGE_COLOR}22, ${LIGHT_PAGE_COLOR}11)`,
                borderRadius: '2px',
                width: `${70 + Math.random() * 25}%`,
                }}
              />
            ))}
            </div>
          </div>
        )}

        {/* last page subtle pattern */}
        {isLast && (
          <div
            style={{
              position: 'absolute',
              inset: 10,
              border: '1px dashed rgba(0,0,0,0.2)',
              borderRadius: '4px',
              opacity: 0.4,
            }}
          />
        )}

        {/* first page logo */}
        {showLogo && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: logoOpacity,
              transition: 'opacity 0.08s ease',
            }}
          >
            <Logo />
          </div>
        )}
    </div>
  );
};

// ⭐ pages NEVER turn into cover colour now
const getPageColor = (isCover: boolean) => {
  if (isCover) {
    return `linear-gradient(135deg, ${COVER_COLOR}, #261219)`;
  }
  // always the same paper colour, before & after flip
  return PAGE_COLOR;
};

const Logo: React.FC = () => (
  <svg
    width="52"
    height="40"
    viewBox="0 0 206 156"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
  </svg>
);

export default BookPageTurner;