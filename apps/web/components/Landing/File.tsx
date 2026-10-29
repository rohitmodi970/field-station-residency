"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { X } from "lucide-react";
import { SmallCard } from "./SmallCard";
import IPodPlayer from "./IPodPlayer";
import UltimateRetroTV from "@/components/Landing/VideoPlayer"; 
import Postcard from "./Cover";
import PostcardSpread from "./PostcardSpread";

// --- TypeScript Declaration for Lordicon ---
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        trigger?: string;
        stroke?: string;
        colors?: string;
        state?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

// --- 3D TILT WRAPPER COMPONENT ---
const TiltWrapper = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;
    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  const handleMouseLeave = () => {
    x.set(0); y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="perspective-1000"
    >
      {children}
    </motion.div>
  );
};

// --- DATA ARRAYS WITH RESPONSIVE SCALING ---
const getResponsivePositions = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isTablet = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
  const scale = isMobile ? 0.4 : isTablet ? 0.7 : 1;
  
  return {
    cardsData: [
      { id: "card-1-left-top", type: "small", src: "/landing/file/IMG1.jpg", title: "trip to abc", x: -380 * scale, y: -100 * scale, rotate: -35.502, delay: 0.1, zIndex: 20, scale: 1 * scale, width: 123 * scale, height: 149 * scale },
      { id: "card-2-left-bottom", type: "small", src: "/landing/file/IMG6.jpg", title: "moon", x: -520 * scale, y: 180 * scale, rotate: -6, delay: 0.2, zIndex: 25, scale: 1.1 * scale, width: 250 * scale, height: 180 * scale },
      { id: "card-4-right-top", type: "small", src: "/landing/file/IMG13.jpg", title: "sunset", x: 460 * scale, y: -200 * scale, rotate: 8, delay: 0.15, zIndex: 20, scale: 0.95 * scale, width: 264 * scale, height: 157 * scale },
      { id: "card-5-right-bottom", type: "small", src: "/landing/file/IMG8.jpg", title: "dock day", x: 400 * scale, y: 100 * scale, rotate: 15, delay: 0.25, zIndex: 25, scale: 1.1 * scale, width: 250 * scale, height: 280 * scale },
      { 
        id: "card-6-postcard", 
        type: "postcard", 
        src: "/landing/file/img6.jpg", 
        logoSrc: "/logo2.png", 
        x: -350 * scale, 
        y: -300 * scale, 
        rotate: -10, 
        delay: 0.35, 
        zIndex: 22, 
        scale: 0.4 * scale 
      },
    ],
    iconsData: [
      { id: "camera", src: "/landing/file/camera.png", x: -180 * scale, y: -280 * scale, rotate: -25, delay: 0.4, width: 90 * scale },
      { id: "video", src: "/landing/file/dslr.png", x: 200 * scale, y: -250 * scale, rotate: 15, delay: 0.45, width: 100 * scale },
      { id: "mic", src: "/landing/file/mic.png", x: 0, y: -50 * scale, rotate: 12, delay: 0.5, width: 70 * scale },
      { id: "music", src: "/landing/file/music_player.png", x: -220 * scale, y: 80 * scale, rotate: -15, delay: 0.55, width: 60 * scale },
      { id: "file", src: "/landing/file/file.png", x: 0, y: -280 * scale, rotate: -5, delay: 0.6, width: 75 * scale },
      { id: "file-open", src: "/landing/file/file-open.png", x: 20 * scale, y: 220 * scale, rotate: -5, delay: 0.6, width: 135 * scale, onClick: true },
      { id: "text-icon", src: "/landing/file/text.png", x: 10 * scale, y: 320 * scale, rotate: 0, delay: 0.7, width: 600 * scale }, 
    ]
  };
};

export default function FileClick() {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [positions, setPositions] = useState(getResponsivePositions());
  
  // Popups State
  const [showPlayer, setShowPlayer] = useState(false);
  const [showTV, setShowTV] = useState(false);
  const [showPostcard, setShowPostcard] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.lordicon.com/lordicon.js";
    script.async = true;
    document.body.appendChild(script);
    
    const handleResize = () => {
      setPositions(getResponsivePositions());
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => { 
      if (document.body.contains(script)) document.body.removeChild(script);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleFolderClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setIsRevealed(!isRevealed);
      setIsAnimating(false);
    }, 1200);
  };
// Load font
if (typeof window !== "undefined") {
  const existingStyle = document.querySelector('[data-generated="fonts-terminal-grotesque"]');
  if (!existingStyle) {
    const css = `
      @font-face {
        font-family: 'Terminal Grotesque';
        src: url('/fonts/terminal-grotesque.ttf') format('opentype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      .font-terminal-grotesque { font-family: 'Terminal Grotesque', serif !important; }
      :root { --font-heading: 'Terminal Grotesque', serif; --font-body: 'Open Sans', sans-serif; }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-generated", "fonts-terminal-grotesque");
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }
}
  return (
    <div className="min-h-screen w-full overflow-hidden relative flex items-center justify-center">
      <div className="relative w-full h-screen flex items-center justify-center">

        {/* --- TRIGGER BUTTON --- */}
        <AnimatePresence>
          {!isRevealed && (
            <motion.div
              className="absolute z-50 flex flex-col items-center justify-center cursor-pointer"
              onClick={handleFolderClick}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(10px)", transition: { duration: 0.5 } }}
              whileHover={{ scale: 1.05 }}
              style={{ bottom: '20%' }}
            >
              <div className="relative flex items-center justify-center">
                {isAnimating ? (
                  <img 
                    src="/landing/file/file-open.png" 
                    alt="Opening..." 
                    className="w-16 sm:w-20 md:w-24 h-full object-contain" 
                  />
                ) : (
                  <img 
                    src="/landing/file/file-closed.png" 
                    alt="Click to open" 
                    className="w-20 sm:w-24 md:w-32 h-full object-contain" 
                  />
                )}
              </div>
                  <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-terminal-grotesque tracking-wider text-2xl leading-relaxed sm:text-3xl sm:leading-relaxed md:text-4xl md:leading-relaxed font-bold text-[#363D01] mt-2 md:mt-4"
                  >
                  Click Here
                  </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- REVEALED CONTENT --- */}
        <AnimatePresence>
          {isRevealed && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 1, duration: 0.8, type: "spring" }}
                className="absolute top-4 left-4 right-4 md:top-8 md:left-auto md:right-8 z-40 w-[calc(100%-2rem)] md:w-[300px] xl:w-[400px]"
              >
                <div className="bg-gray-200 rounded-xl md:rounded-2xl border-b border-[#C9C9C9] shadow-xl p-2.5 md:p-3 lg:p-4 flex items-start gap-2 md:gap-3">
                  <div className="flex gap-1 md:gap-1.5 flex-shrink-0 mt-0.5 md:mt-1">
                    <div className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#FA1828]"></div>
                    <div className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-[#C9C9C9]"></div>
                  </div>
                  <p className="font-terminal-grotesque text-[9px] sm:text-[10px] md:text-xs text-black leading-relaxed font-medium">
                    <span>Drop in voice memos, photos, videos, text, even documents.</span>
                    <span className="block mt-0.5 md:mt-1">Force understands your mind in every medium.</span>
                  </p>
                </div>
              </motion.div>

              {/* Render Cards & Postcards */}
              {positions.cardsData.map((card) => (
                <motion.div
                  key={card.id}
                  className="absolute"
                  style={{ zIndex: card.zIndex }}
                  initial={{ x: 0, y: 600, opacity: 0, scale: 0.3, rotate: Math.random() * 720 - 360 }}
                  animate={{ x: card.x, y: card.y, opacity: 1, scale: card.scale, rotate: card.rotate }}
                  exit={{ x: 0, y: 600, opacity: 0, scale: 0.3, rotate: Math.random() * 360, transition: { duration: 0.6 } }}
                  transition={{ duration: 0.8, delay: card.delay, type: "spring", stiffness: 60, damping: 10 }}
                  whileHover={{ scale: card.scale * 1.15, rotate: Math.random() < 0.5 ? -4 : 4, zIndex: 100, transition: { duration: 0.2 } }}
                >
                  <div className="cursor-pointer drop-shadow-2xl">
                    {card.type === 'postcard' ? (
                      <div
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPostcard(true);
                        }}
                        style={{
                          width: `${typeof card.width === "number" ? card.width : 500}px`,
                          height: "auto",
                        }}
                      >
                        <Postcard imageSrc={card.src} logoSrc={(card as any).logoSrc} />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: `${typeof card.width === "number" ? card.width : 160}px`,
                          height: `${typeof card.height === "number" ? card.height : 'auto'}px`,
                        }}
                        className="overflow-hidden"
                      >
                        <SmallCard src={card.src} title={(card as any).title} customClass="w-full h-full" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Render Icons */}
              {positions.iconsData.map((icon) => (
                <motion.div
                  key={icon.id}
                  className="absolute"
                  style={{ zIndex: 15 }}
                  initial={{ x: 0, y: 800, opacity: 0, scale: 0.2, rotate: Math.random() * 360 }}
                  animate={{ x: icon.x, y: icon.y, opacity: 1, scale: 1, rotate: icon.rotate }}
                  exit={{ x: 0, y: 800, opacity: 0, scale: 0.2, rotate: Math.random() * 360, transition: { duration: 0.5 } }}
                  transition={{ duration: 0.9, delay: icon.delay, type: "spring", damping: 12, stiffness: 80 }}
                  whileHover={{ scale: 1.25, rotate: 0, zIndex: 50, transition: { type: "spring", stiffness: 300 } }}
                  onClick={() => {
                    if (icon.id === "music") setShowPlayer(true);
                    if (icon.id === "video") setShowTV(true);
                    if ((icon as any).onClick) handleFolderClick();
                  }}
                >
                  <img 
                    src={icon.src} 
                    alt={icon.id} 
                    style={{ width: `${icon.width}px` }} 
                    className="drop-shadow-lg cursor-pointer select-none" 
                  />
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* --- 1. FUNKY IPOD PLAYER OVERLAY --- */}
        <AnimatePresence>
          {showPlayer && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            >
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowPlayer(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 lg:top-10 lg:right-10 p-2 md:p-3 bg-white text-black rounded-full shadow-lg z-50 hover:bg-gray-100 cursor-pointer"
              >
                <X size={24} strokeWidth={3} className="md:w-7 md:h-7" />
              </motion.button>

              <motion.div
                initial={{ scale: 0.5, rotateY: -90, y: 200, opacity: 0 }}
                animate={{ scale: 1, rotateY: 0, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, y: -200, opacity: 0, transition: { duration: 0.3 } }}
                transition={{ type: "spring", damping: 15, stiffness: 100, mass: 0.8 }}
                className="relative w-full max-w-md"
              >
                <TiltWrapper>
                  <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
                    <div className="scale-75 sm:scale-90 md:scale-100">
                      <IPodPlayer />
                    </div>
                  </div>
                </TiltWrapper>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 2. RETRO TV OVERLAY --- */}
        <AnimatePresence>
          {showTV && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            >
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowTV(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 lg:top-10 lg:right-10 p-2 md:p-3 bg-white text-black rounded-full shadow-lg z-50 hover:bg-gray-100 cursor-pointer"
              >
                <X size={24} strokeWidth={3} className="md:w-7 md:h-7" />
              </motion.button>

              <motion.div
                initial={{ scale: 0.5, y: 100, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="relative w-full max-w-6xl flex justify-center"
              >
                <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 origin-center">
                  <UltimateRetroTV />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 3. POSTCARD SPREAD OVERLAY --- */}
        <AnimatePresence>
          {showPostcard && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 md:p-4"
            >
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                onClick={() => setShowPostcard(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 lg:top-10 lg:right-10 p-2 md:p-3 bg-white text-black rounded-full shadow-lg z-50 hover:bg-gray-100 cursor-pointer"
              >
                <X size={24} strokeWidth={3} className="md:w-7 md:h-7" />
              </motion.button>

              <motion.div
                initial={{ scale: 0.5, y: 100, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="relative w-full flex justify-center"
              >
                <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto w-full">
                  <div className="w-full max-w-[95vw] lg:max-w-[100vw] mx-auto p-2 md:p-4 flex flex-col gap-2 md:flex-row md:gap-4 lg:gap-6 overflow-y-auto md:overflow-visible max-h-[85vh] md:max-h-none touch-pan-y">
                    <PostcardSpread />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}