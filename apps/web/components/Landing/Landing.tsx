"use client"
import React, { useState, useEffect, useRef } from 'react'
import OrganicBackground from './OrganicBackground'
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useMotionValueEvent, useScroll } from "framer-motion";
import { Logo } from './OrganicFoot';
import { InnerSelfPatternCard } from "./InnerSelfPatternCard";
import IPodPlayer from "./IPodPlayer";
import UltimateRetroTV from "@/components/Landing/VideoPlayer";
import Postcard from "./Cover";
import PostcardSpread from "./PostcardSpread";
import { SmallCard } from "./SmallCard";
import { X } from "lucide-react";
import Lenis from 'lenis';
import { MindCardTxt } from './Cards_without_img';
import { LanderCard } from './lander_SmallCard';
import LanderScroll from './LanderScroll';
import HeadScroll from './HeadScroll';
import LandingShowcase from './LandingShowcase';
import FileClick from './File';
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

const fonts = {
  heading: "'Hydrogen Whiskey', serif",
  body: "'Open Sans', sans-serif",
};

if (typeof window !== "undefined") {
  const css = `
    @font-face {
      font-family: 'Hydrogen Whiskey';
      src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    .font-hydrogen-whiskey { font-family: 'Hydrogen Whiskey', serif !important; }
    :root { --font-heading: 'Hydrogen Whiskey', serif; --font-body: 'Open Sans', sans-serif; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-generated", "fonts-hydrogen");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
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

// --- DATA ARRAYS ---
const cardsData = [
    { id: "card-1-left-top", type: "small", src: "/landing/file/IMG1.jpg", title: "trip to abc", x: -480, y: -220, rotate: -12, delay: 0.1, zIndex: 20, scale: 1 },
    { id: "card-2-left-bottom", type: "small", src: "/landing/file/IMG13.jpg", title: "moon", x: -520, y: 180, rotate: -6, delay: 0.2, zIndex: 25, scale: 1.1 },
    { id: "card-3-middle", type: "small", src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop", title: "adventure", x: -40, y: -30, rotate: 5, delay: 0.3, zIndex: 30, scale: 0.7 },
    { id: "card-4-right-top", type: "small", src: "/landing/file/IMG6.jpg", title: "sunset", x: 460, y: -200, rotate: 8, delay: 0.15, zIndex: 20, scale: 0.95 },
    { id: "card-5-right-bottom", type: "small", src: "/landing/file/IMG8.jpg", title: "dock day", x: 500, y: 200, rotate: 15, delay: 0.25, zIndex: 25, scale: 1.1 },

    // NEW POSTCARD COMPONENT
    {
        id: "card-6-postcard",
        type: "postcard",
        src: "/landing/file/img6.jpg",
        logoSrc: "/logo2.png",
        x: 250,
        y: 100,
        rotate: -10,
        delay: 0.35,
        zIndex: 22,
        scale: 0.6
    },
];

const iconsData = [
    { id: "camera", src: "/landing/file/camera.png", x: -180, y: -280, rotate: -25, delay: 0.4, width: 90 },
    { id: "video", src: "/landing/file/dslr.png", x: 200, y: -250, rotate: 15, delay: 0.45, width: 100 },
    { id: "mic", src: "/landing/file/mic.png", x: 180, y: 50, rotate: 12, delay: 0.5, width: 70 },
    { id: "music", src: "/landing/file/music_player.png", x: -220, y: 80, rotate: -15, delay: 0.55, width: 60 },
    { id: "file", src: "/landing/file/file.png", x: 0, y: -180, rotate: -5, delay: 0.6, width: 75 },
    { id: "text-icon", src: "/landing/file/text.png", x: 10, y: 320, rotate: 0, delay: 0.7, width: 600 },
];
const Landing = () => {
    const router = useRouter();
    const handleJoinWaitlist = () => {
        router.push('/waitlist');
    };
    const [isRevealed, setIsRevealed] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Popups State
    const [showPlayer, setShowPlayer] = useState(false);
    const [showTV, setShowTV] = useState(false);
    const [showPostcard, setShowPostcard] = useState(false); // New State for Postcard

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://cdn.lordicon.com/lordicon.js";
        script.async = true;
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); };
    }, []);

    const handleFolderClick = () => {
        if (isAnimating || isRevealed) return;
        setIsAnimating(true);
        setTimeout(() => {
            setIsRevealed(true);
            setIsAnimating(false);
        }, 1200);
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    
  // 1. Set up Scroll Tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // --- TIMELINE CONFIGURATION ---
  // Cards now appear DURING video playback
  const VIDEO_END = 1.0;   // Video continues throughout the entire scroll

  // 2. Card Transforms (Opacity & Y-Position)
  
  // Card 1: Appears early in the scroll (during video)
  const card1Opacity = useTransform(scrollYProgress, [0.1, 0.15, 0.3, 0.35], [0, 1, 1, 0]);
  const card1Y = useTransform(scrollYProgress, [0.1, 0.15, 0.3, 0.35], [50, 0, 0, -50]);
  const card1PointerEvents = useTransform(scrollYProgress, (v) => (v > 0.1 && v < 0.35 ? 'auto' : 'none'));

  // Card 2: Appears in the middle of the scroll (during video)
  const card2Opacity = useTransform(scrollYProgress, [0.35, 0.4, 0.6, 0.65], [0, 1, 1, 0]);
  const card2Y = useTransform(scrollYProgress, [0.35, 0.4, 0.6, 0.65], [50, 0, 0, -50]);
  const card2PointerEvents = useTransform(scrollYProgress, (v) => (v > 0.35 && v < 0.65 ? 'auto' : 'none'));

  // Card 3: Appears later in the scroll and stays visible
  const card3Opacity = useTransform(scrollYProgress, [0.65, 0.7, 1], [0, 1, 1]);
  const card3Y = useTransform(scrollYProgress, [0.65, 0.7, 1], [50, 0, 0]);
  const card3PointerEvents = useTransform(scrollYProgress, (v) => (v > 0.65 ? 'auto' : 'none'));


  // 3. Initialize Smooth Scrolling (Lenis)
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  // 4. Video Sync Logic - Video plays throughout entire scroll
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const video = videoRef.current;
    if (video && video.duration) {
      
      // Video now plays throughout the entire scroll (0% to 100%)
      const targetTime = video.duration * latest;

      // Safety check to prevent errors
      if (Number.isFinite(targetTime)) {
        video.currentTime = targetTime;
      }
    }
  });
const [activeView, setActiveView] = useState("connect"); // "connect", "transform", or "discover" 
    return (
        <div className='w-full bg-[#e6dede]'>
            {/* Head scroll */}
            <HeadScroll />
            {/* Lander part 2 */}
            {/* <LanderScroll /> */}
            {/* text  */}
            <section 
      aria-labelledby="patterns-heading" 
      className="relative min-h-[70vh] flex items-center  justify-center bg-[#FDFBF7] overflow-hidden py-20"
    >
      {/* Main Content Wrapper 
         We make this relative so all stickers position themselves based on this box 
      */}
      <div className="relative w-full max-w-5xl px-6">
        
        {/* --- STICKERS LAYER (Absolute Positioning) --- */}
        
        {/* Top Left: Orange Waves */}
        <div className="absolute -top-12 -left-4 md:-top-16 md:left-0 rotate-[-5deg] z-10">
          <img 
            src="/mind_scroll/stickers/top1.png" 
            alt="orange wave" 
            className="w-24 md:w-32 opacity-90" 
          />
        </div>

        {/* Top Center: Blue Diamond (Floating above 'Mental') */}
        <div className="absolute top-[-2rem] left-[45%] md:left-[55%] -translate-x-1/2 rotate-12 z-10">
          <img 
            src="/mind_scroll/stickers/diamond_top2.png" 
            alt="diamond" 
            className="w-16 md:w-20" 
          />
        </div>

        {/* Top Right: Green Line */}
        <div className="absolute -top-10 right-0 md:-top-14 md:right-10 z-10">
          <img 
            src="/mind_scroll/stickers/wave_top3.png" 
            alt="green wave" 
            className="w-24 md:w-32" 
          />
        </div>

        {/* Middle Floating: Lightbulb (Hanging near 'Patterns') */}
       

        {/* Bottom Left: Fire */}
        <div className="absolute bottom-[-2rem] left-10 md:left-20 z-10">
          <img 
            src="/mind_scroll/stickers/fire_bottom.png" 
            alt="fire" 
            className="w-16 md:w-24" 
          />
        </div>

        {/* Bottom Right: Roots */}
        <div className="absolute -bottom-8 right-4 md:right-12 z-10">
          <img 
            src="/mind_scroll/stickers/branch_bottom.png" 
            alt="roots" 
            className="w-20 md:w-28" 
          />
        </div>


        {/* --- TEXT LAYER --- */}
        <header id="patterns-heading" className="relative z-20 text-center">
          <h2 className="font-hydrogen-whiskey font-black text-black text-[60px] leading-[0.95] tracking-wider uppercase drop-shadow-sm">
            
            {/* Line 1 */}
            <span className="block">
              Understand Your Patterns And
            </span>

            {/* Line 2 */}
            <span className="block mt-2 md:mt-4 relative">
              Enter Curated Mental Spaces
              
              {/* Inline Sticker: Purple Swirl (at the end of line 2) */}
              <span className="inline-block align-middle ml-4 mt-2">
                <img 
                  src="/mind_scroll/stickers/cyclone.png" 
                  alt="cyclone" 
                  className="w-12 md:w-16 animate-spin-slow" 
                />
              </span>
            </span>

            {/* Line 3 */}
            <span className="block mt-2 md:mt-4">
              While Building A <br className="md:hidden" /> Mind You Trust
            </span>

          </h2>
        </header>

      </div>
    </section>
            {/* Maze scroll */}
            <div className="">
                <div ref={containerRef} className="relative h-[1200vh]">
                       
                       {/* Sticky Viewport */}
                       <div className="sticky top-0 h-screen w-full overflow-hidden">
                         
                         {/* Background Video Layer */}
                         <div className="absolute inset-0 z-0">
                           <video
                              ref={videoRef}
                                src="/mind_scroll/maze.mp4"
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="auto"
                                style={{ filter: "brightness(1.12)" }}
                           />
                           {/* Overlay to dim video so white text is readable */}
                           <div className="absolute inset-0  pointer-events-none" />
                         </div>
               
                         {/* --- CARDS LAYER --- */}
                         <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                           
                           {/* CARD 1 - Appears at 10-35% scroll */}
                           <motion.div 
                             style={{ opacity: card1Opacity, y: card1Y, pointerEvents: card1PointerEvents }}
                             className="absolute w-full px-4"
                           >
                             <MindCardTxt 
                               heading="Where you witness your own mind." 
                               content="We move through mental mazes all day. Reacting, deciding, drifting, getting lost in noise." 
                               src='/landing/emojis.png'
                             />
                           </motion.div>
               
                           
               
                           {/* CARD 3 - Appears at 65-100% scroll */}
                           <motion.div 
                             style={{ opacity: card3Opacity, y: card3Y, pointerEvents: card3PointerEvents }}
                             className="absolute w-full px-4"
                           >
                             <MindCardTxt 
                               heading="Where you witness your own mind." 
                               content="Force helps you zoom out of the complexity to create a space where your attention can settle, and your consciousness becomes the guide again." 
                             />
                           </motion.div>
               
                         </div>
               
                       </div>
                     </div>
            </div>
            {/* click here  */}
            <FileClick/>
            {/* how it works */}
            <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto py-20 px-4 sm:px-6 lg:px-8 gap-5 text-black w-[90vw]">
                <h1 className="font-hydrogen-whiskey tracking-wider text-7xl ">HOW IT WORKS</h1>
                <span className='font-terminal-grotesque font-bold text-[22px] tracking-wider my-5 mt-10'>Force is a sanctuary for the mind, a space for those who think deeply and who want clarity, emotional steadiness, and a mind that feels like home again. It's not for everyone - only for those who  <span className='text-purple-600'>value depth over distraction.</span>
                </span>
                <div className="mt-6 my-10 w-[80vw]">
                    <LandingShowcase />
                </div>

            </div>

            {/* footer with logo  */}
            <div className="relative min-h-[350vh] w-full overflow-hidden flex flex-col">
      <OrganicBackground />

      {/* Main Content Area - Pushed to bottom, just above footer */}
      <main className="relative z-10 flex-grow flex items-end justify-center px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 md:pb-16">
        <section
          id="hero"
          className="container mx-auto max-w-5xl text-center w-full"
        >
          <div className="w-full mx-auto space-y-6 sm:space-y-8 md:space-y-10">
            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="font-hydrogen-whiskey text-white text-[28px] xs:text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] xl:text-[64px] tracking-wide leading-[1.2] sm:leading-[1.3] md:leading-[1.4] px-2"
              style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
            >
              RETURN TO YOURSELF.
              <br />
              RECLAIM YOUR ATTENTION.
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-terminal-grotesque text-white/80 text-sm sm:text-base md:text-lg lg:text-xl max-w-xl mx-auto leading-relaxed px-4"
            >
              Join a vibrant, intelligent space designed for deep thinkers in the
              age of AI.
            </motion.p>

            {/* Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex justify-center pt-2 sm:pt-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinWaitlist}
                className="group relative touch-manipulation transition-transform duration-200"
                aria-label="Join Waitlist"
              >
                <img
                  src="/joinWaitListButton.png"
                  alt=""
                  className="h-[36px] xs:h-[40px] sm:h-[44px] md:h-[50px] lg:h-[56px] w-auto min-w-[140px] xs:min-w-[150px] sm:min-w-[160px] md:min-w-[176px] cursor-pointer"
                  style={{ imageRendering: "-webkit-optimize-contrast" }}
                />
                <div className="flex items-center justify-center absolute inset-0 text-white font-terminal-grotesque gap-1 xs:gap-1.5 sm:gap-2 pointer-events-none select-none">
                  <span className="inline-flex items-center justify-center whitespace-nowrap text-[10px] xs:text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] font-medium tracking-wide">
                    JOIN WAITLIST
                  </span>
                  <span className="flex-shrink-0">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 38 38"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-[20px] h-[20px] xs:w-[24px] xs:h-[24px] sm:w-[28px] sm:h-[28px] md:w-[32px] md:h-[32px] lg:w-[36px] lg:h-[36px]"
                    >
                      <circle
                        cx="19"
                        cy="19"
                        r="18.5"
                        stroke="white"
                        strokeWidth="1"
                      />
                      <path
                        d="M16 10L22.5 19L16 28"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
              </motion.button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer Section - Full Width at Bottom */}
      <footer className="relative z-20 w-full py-6 sm:py-8 md:py-10 lg:py-12 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-transparent mt-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center space-y-2 sm:space-y-3"
        >
          <Logo />
          <p className="font-terminal-grotesque text-white/50 text-[10px] xs:text-xs sm:text-sm tracking-wide px-4 text-center">
            © 2026 Force. All rights reserved.
          </p>
          <div className="flex items-center gap-4 mt-1">
            <a href="/terms-and-conditions" className="font-terminal-grotesque text-white/40 hover:text-white/70 text-[10px] xs:text-xs sm:text-sm tracking-wide transition-colors">
              Terms
            </a>
            <span className="text-white/30 text-xs">·</span>
            <a href="/privacy-policy" className="font-terminal-grotesque text-white/40 hover:text-white/70 text-[10px] xs:text-xs sm:text-sm tracking-wide transition-colors">
              Privacy Policy
            </a>
          </div>
        </motion.div>
      </footer>
    </div>
        </div>
    )
}

export default Landing
