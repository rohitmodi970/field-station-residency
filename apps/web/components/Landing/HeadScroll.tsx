'use client';

import React, { useRef, useState } from 'react';
import { useScroll, useTransform, motion, AnimatePresence, MotionValue } from 'framer-motion';
import { LanderCard } from './lander_SmallCard'; 

// --- Types ---
interface TextFrame {
  id: number;
  title: string;
  description?: string;
  position: 'center' | 'top';
  showButton: boolean;
}

interface TreeData {
  id: number;
  imgSrc: string; 
  name: string;
  top: string;   
  left: string;  
  width: string; 
  zIndex: number; 
  content: {
    heading: string;
    description: string;
    src: string; 
  }
}

// --- Fonts ---
// Note: Ensure these fonts are loaded in your project structure or global CSS
if (typeof window !== "undefined") {
  const css = `
    @font-face {
      font-family: 'Hydrogen Whiskey';
      src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
      font-display: swap;
    }
    @font-face {
        font-family: 'Terminal Grotesque';
        src: url('/fonts/terminal-grotesque.ttf') format('opentype');
        font-display: swap;
    }
    .font-hydrogen-whiskey { font-family: 'Hydrogen Whiskey', serif !important; }
    .font-terminal-grotesque { font-family: 'Terminal Grotesque', sans-serif !important; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-generated", "fonts-custom");
  style.appendChild(document.createTextNode(css));
  if (!document.querySelector('[data-generated="fonts-custom"]')) {
      document.head.appendChild(style);
  }
}

// --- Data ---
const textFrames: TextFrame[] = [
  {
    id: 1,
    title: "Your mind is a\n world of its own.\nReturn to it.",
    description: "A calm, intelligent space to help you reclaim your attention and understand your inner world.",
    position: "center",
    showButton: true
  },
  { id: 2, title: "Your attention is the shape of your life.", position: "top", showButton: false },
  { id: 3, title: "But in a world of noise, clarity disappears.", position: "top", showButton: false },
  { id: 4, title: "Force helps you come back to yourself.", position: "top", showButton: false },
];

const treeLayers: TreeData[] = [
  {
    id: 1,
    name: "Purple Tree",
    imgSrc: "/mind_scroll/trees/tree1.png",
    top: '15%', left: '25%', width: '13%', zIndex: 3,
    content: {
      heading: "Deep Reflection",
      description: "Dive into the subconscious layers of your mind. Understand the roots of your thoughts.",
      src: "/landing/lander/cyclone.png"
    }
  },
  {
    id: 2,
    name: "Indigo Tree",
    imgSrc: "/mind_scroll/trees/tree2.png",
    top: '12%', left: '33%', width: '11%', zIndex: 2,
    content: {
      heading: "Intuition",
      description: "Trust the silent voice inside. A space for gut feelings and instant knowing.",
      src: "/landing/lander/brain.png"
    }
  },
  {
    id: 3,
    name: "Cyan Tree",
    imgSrc: "/mind_scroll/trees/tree3.png",
    top: '9%', left: '40%', width: '11%', zIndex: 1,
    content: {
      heading: "Clarity",
      description: "Clear skies for clear thoughts. Remove the fog of daily noise.",
      src: "/landing/lander/diamond.png"
    }
  },
  {
    id: 4,
    name: "Green Tree",
    imgSrc: "/mind_scroll/trees/tree4.png",
    top: '14%', left: '46%', width: '13%', zIndex: 4, 
    content: {
      heading: "Growth",
      description: "Where new ideas take root. Nurture your creativity in a safe environment.",
      src: "/landing/lander/signal.png"
    }
  },
  {
    id: 5,
    name: "Yellow Tree",
    imgSrc: "/mind_scroll/trees/tree5.png",
    top: '14%', left: '57%', width: '9%', zIndex: 1,
    content: {
      heading: "Joy & Energy",
      description: "Recharge your mental battery. Find the sunlight in your thinking.",
      src: "/landing/lander/fingerprint.png"
    }
  },
  {
    id: 6,
    name: "Orange Tree",
    imgSrc: "/mind_scroll/trees/tree6.png",
    top: '14%', left: '67%', width: '10%', zIndex: 2,
    content: {
      heading: "Creativity",
      description: "The spark of invention. Connect dots that others don't see.",
      src: "/landing/lander/wave.png"
    }
  },
  {
    id: 7,
    name: "Red Tree",
    imgSrc: "/mind_scroll/trees/tree7.png",
    top: '18%', left: '77%', width: '10%', zIndex: 3,
    content: {
      heading: "Passion",
      description: "What drives you? Realign with your core motivations and desires.",
      src: "/landing/lander/branch.png"
    }
  },
];

// --- Sub-Components ---

const Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 206 156" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" fill="black" stroke="black" strokeWidth="6"/>
  </svg>
);

const TextFrame = ({ frame, index, total, scrollYProgress }: { frame: TextFrame, index: number, total: number, scrollYProgress: MotionValue<number> }) => {
  let start: number, end: number;
  if (index === 0) {
    start = 0; end = 0.1;
  } else {
    const ZOOM_PERIOD = 0.1;
    const remainingScroll = 1 - ZOOM_PERIOD;
    const stepSize = remainingScroll / (total - 1);
    start = ZOOM_PERIOD + ((index - 1) * stepSize);
    end = start + stepSize;
  }

  const opacity = useTransform(scrollYProgress, [start, start + 0.05, end - 0.05, end], [0, 1, 1, index === total - 1 ? 1 : 0]);
  const y = useTransform(scrollYProgress, [start, end], [30, -30]);

  return (
    <motion.div
      style={{ 
        opacity: index === 0 ? useTransform(scrollYProgress, [0, 0.05, 0.1], [1, 1, 0]) : opacity,
        y: index === 0 ? 0 : y,
        zIndex: 10 + index 
      }}
      className={`absolute inset-0 flex ${index === 0 ? 'items-end justify-center pb-24 sm:pb-8 md:pb-10 lg:pb-12' : frame.position === 'center' ? 'items-center justify-center' : 'items-start justify-center pt-24 sm:pt-16 md:pt-20 lg:pt-24'} pointer-events-none p-4 sm:p-6`}
    >
      <div className={`text-center ${frame.position === 'center' ? 'max-w-xl sm:max-2xl ' : 'max-w-2xl sm:max-w-3xl lg:max-w-4xl'} pointer-events-auto px-4`}>
        <h1 className={`${index === 0 ? 'font-hydrogen-whiskey' : 'font-terminal-grotesque'} font-bold leading-tight tracking-tight ${frame.position === 'center' ? 'text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl mb-4 sm:mb-6 text-white tracking-wide' : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-black'}`}>
          {frame.title}
        </h1>
        {frame.description && <p className={`font-terminal-grotesque text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white/90 max-w-sm sm:max-w-md lg:max-w-lg ${index === 0 ? 'mx-auto' : 'mx-auto'}`}>{frame.description}</p>}
      </div>
    </motion.div>
  );
};

// --- Main Component ---
export default function HeadScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.4]); 
  
  const [activeTreeId, setActiveTreeId] = useState<number | null>(null);
  
  // New state for the indicator text
  const [interactionLabel, setInteractionLabel] = useState<string>("SCROLL");

  // Handler for interacting with trees
  const handleTreeEnter = (id: number) => {
    setActiveTreeId(id);
    setInteractionLabel("EXPLORE"); // Changes "SCROLL" to "EXPLORE"
  };

  const handleTreeLeave = () => {
    setActiveTreeId(null);
    setInteractionLabel("SCROLL"); // Reverts back
  };

  // Toggle for click (mobile friendly)
  const handleTreeClick = (id: number) => {
      if (activeTreeId === id) {
          handleTreeLeave();
      } else {
          handleTreeEnter(id);
      }
  };

  return (
    <main className="bg-[#E8D5C4] font-sans">
      {/* Logo - Fixed position */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 md:top-10 md:left-10 z-50">
        <Logo className="w-8 h-auto sm:w-10 md:w-12" />
      </div>

      <section ref={containerRef} className="relative h-[400vh]">
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#E8D5C4]">
          
          {/* Main Zooming Container */}
          <motion.div
            style={{ scale }}
            className="absolute inset-0 w-full h-full flex items-end justify-center"
          >
            {/* Responsive Container Logic:
               - On Desktop: Max width 1920px, fits nicely.
               - On Mobile/Tablet (default): w-[160%] centers the image and zooms in so the head/trees 
                 are large enough to tap, cutting off the empty sky on the sides.
            */}
            <div className="relative w-[160%] sm:w-full max-w-[1920px] left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mx-auto" style={{ aspectRatio: '16/9' }}>
              
              {/* Background Head Image */}
              <div className="absolute inset-0 w-full h-full">
                <img 
                  src="/mind_scroll/trees/head.png"
                  alt="Mind Base" 
                  className="w-full h-full object-contain object-bottom"
                />
              </div>
              
              {/* Tree Layers - Visible on ALL screens now */}
              <div className="absolute inset-0 w-full h-full overflow-visible" style={{ top: '-10%', height: '120%' }}>
                {treeLayers.map((tree) => {
                  return (
                    <img 
                      key={tree.id}
                      src={tree.imgSrc}
                      alt={tree.name}
                      className="absolute transition-transform duration-300 hover:scale-110 cursor-pointer pointer-events-auto"
                      style={{
                        left: tree.left,
                        top: tree.top,
                        width: tree.width,
                        height: 'auto',
                        zIndex: tree.zIndex,
                        transform: 'translateX(-50%)',
                      }}
                      onMouseEnter={() => handleTreeEnter(tree.id)}
                      onMouseLeave={handleTreeLeave}
                      onClick={(e) => {
                          e.stopPropagation();
                          handleTreeClick(tree.id);
                      }}
                      draggable={false}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Card Popup - Centered */}
          <AnimatePresence>
            {activeTreeId !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[90%] sm:w-[320px] md:w-[360px] lg:w-[386px] px-4 pointer-events-none"
              >
                <div className="pointer-events-auto shadow-2xl rounded-[16px]">
                  <LanderCard 
                    src={treeLayers.find(t => t.id === activeTreeId)?.content.src || ''}
                    heading={treeLayers.find(t => t.id === activeTreeId)?.content.heading || ''}
                    description={treeLayers.find(t => t.id === activeTreeId)?.content.description || ''}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrolling Text Overlays */}
          {textFrames.map((frame, index) => (
            <TextFrame
              key={frame.id}
              frame={frame}
              index={index}
              total={textFrames.length}
              scrollYProgress={scrollYProgress}
            />
          ))}

          {/* Join Waitlist Button - Responsive positioning */}
          <motion.div
            style={{ opacity: useTransform(scrollYProgress, [0, 0.1], [1, 0]) }}
            className="fixed bottom-6 left-6 sm:bottom-10 sm:left-6 md:bottom-12 md:left-12 lg:left-16 z-50"
          >
            <button className="group flex items-center gap-2 sm:gap-3 md:gap-4 hover:gap-4 transition-all duration-300">
              <span className="font-terminal-grotesque text-xs sm:text-sm tracking-tight text-white shadow-black drop-shadow-md">JOIN WAITLIST</span>
              <div className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-full border border-white flex items-center justify-center group-hover:bg-white/10 transition-colors flex-shrink-0 bg-white/5 backdrop-blur-sm">
                <svg width="12" height="16" viewBox="0 0 14 18" fill="none" className="sm:w-[14px] sm:h-[18px]">
                  <path d="M3 1L9.5 10L3 19" stroke="white" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
          </motion.div>

          {/* DYNAMIC SCROLL/HOVER INDICATOR - Visible on all screens now */}
          <motion.div
            style={{ opacity: useTransform(scrollYProgress, [0, 0.1], [1, 0]) }}
            className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 md:bottom-12 md:right-16 z-50 flex flex-col items-center gap-2 md:gap-3 pointer-events-none"
          >
            <div className="flex items-center gap-2 md:gap-3">
              {/* The Text changes based on interactionLabel state */}
              <AnimatePresence mode="wait">
                <motion.span 
                    key={interactionLabel}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="font-terminal-grotesque text-xs sm:text-sm tracking-tight text-white shadow-black drop-shadow-md"
                >
                    {interactionLabel}
                </motion.span>
              </AnimatePresence>
              
              <div className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-full border border-white flex items-center justify-center flex-shrink-0 bg-white/5 backdrop-blur-sm">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="sm:w-[18px] sm:h-[18px]">
                  <path d="M9 1V17" stroke="white" strokeLinecap="round"/>
                  <path d="M1 9H17" stroke="white" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </motion.div>

        </div>
      </section>
    </main>
  );
}