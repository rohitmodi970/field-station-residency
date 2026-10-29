'use client';

import React, { useRef } from 'react';
import { useScroll, useTransform, motion, MotionValue } from 'framer-motion';
// Adjust the import path to point to where you saved your LanderCard component
import { LanderCard } from './lander_SmallCard';

// --- Data Configuration ---
// Added a 'color' property for each step based on your request
const steps = [
  {
    id: 1,
    topTitle: "CLARITY",
    color: "#9371C5", // Purple
    cardHeading: "Where your thoughts turn from fog to form.",
    cardDesc: "Infinite content blurs your own voice. You consume more than you process. Force is a guided reflection.",
    cardImg: "/landing/lander/cyclone.png"
  },
  {
    id: 2,
    topTitle: "FOCUS",
    color: "#3755A4", // Blue
    cardHeading: "Reclaim your attention span.",
    cardDesc: "In a world designed to distract you, choosing where to place your mind is the ultimate power.",
    cardImg: "/landing/lander/brain.png"
  },
  {
    id: 3,
    topTitle: "STRUCTURE",
    color: "#24B6CD", // Light Blue/Teal
    cardHeading: "Building blocks for your mind.",
    cardDesc: "Turn chaotic impulses into structured thinking. Organize your inner world like you organize your outer one.",
    cardImg: "/landing/lander/diamond.png"
  },
  {
    id: 4,
    topTitle: "MEMORY",
    color: "#54984F", // Green
    cardHeading: "Remember what matters.",
    cardDesc: "A safe deposit box for your most important realizations, kept away from the noise of the feed.",
    cardImg: "/landing/lander/signal.png"
  },
  {
    id: 5,
    topTitle: "REFLECTION",
    color: "#EDAC1D", // Yellow/Gold
    cardHeading: "The mirror of the self.",
    cardDesc: "Look back to move forward. See patterns in your thinking that were invisible in the moment.",
    cardImg: "/landing/lander/fingerprint.png"
  },
  {
    id: 6,
    topTitle: "GROWTH",
    color: "#F48D11", // Orange
    cardHeading: "From seed to forest.",
    cardDesc: "Small daily inputs compound into massive personal evolution. Watch your mind grow.",
    cardImg: "/landing/lander/wave.png"
  },
  {
    id: 7,
    topTitle: "PEACE",
    color: "#ED4551", // Red
    cardHeading: "Return to yourself.",
    cardDesc: "The ultimate goal isn't productivity. It's peace. Find the quiet center in the storm.",
    cardImg: "/landing/lander/branch.png"
  },
];

// --- Components ---

const Logo = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 206 156" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" fill="black" stroke="black" strokeWidth="6"/>
    <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" fill="black" stroke="black" strokeWidth="6"/>
  </svg>
);

export default function LanderScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalSlides = steps.length;
  
  // Create a scroll timeline that spans the height of (totalSlides * 100vh)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <main className="bg-[#FFF5EA] font-sans">
      {/* Height = number of slides * 100vh. 
         This creates the "track" for us to scroll down.
      */}
      <div ref={containerRef} style={{ height: `${totalSlides * 100}vh` }} className="relative">
        
        {/* --- STICKY VIEWPORT --- */}
        <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
          
          {/* 1. Background Image (Static) */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
             <img 
               src="/mind_scroll/mind_tree.png" 
               alt="Background" 
               className="w-full h-full object-cover object-bottom opacity-80"
             />
          </div>

          {/* 2. Logo (Static Top Left) */}
          <div className="absolute top-8 left-8 z-50">
            <Logo className="w-12 h-12" />
          </div>

          {/* 3. Top Center Title (Changes with scroll & color) */}
          <div className="absolute top-12 left-0 right-0 z-40 flex justify-center pointer-events-none">
             {steps.map((step, index) => {
               // Calculate range for this specific slide
               const stepSize = 1 / totalSlides;
               const start = index * stepSize;
               const end = start + stepSize;

               return (
                 <FadeItem 
                    key={step.id} 
                    scrollYProgress={scrollYProgress} 
                    range={[start, end]}
                 >
                    {/* Apply the specific color from data */}
                    <h2 
                      style={{ color: step.color }}
                      className="font-extrabold text-5xl  tracking-widest uppercase font-mono transition-colors duration-300"
                    >
                      {step.topTitle}
                    </h2>
                 </FadeItem>
               )
             })}
          </div>

          {/* 4. Center Card (Changes with scroll) */}
          <div className="relative z-50 w-full flex items-center justify-center p-4">
             {steps.map((step, index) => {
               const stepSize = 1 / totalSlides;
               const start = index * stepSize;
               const end = start + stepSize;

               return (
                 <SlideItem 
                    key={step.id} 
                    scrollYProgress={scrollYProgress} 
                    range={[start, end]}
                 >
                    <LanderCard 
                      src={step.cardImg}
                      heading={step.cardHeading}
                      description={step.cardDesc}
                    />
                 </SlideItem>
               )
             })}
          </div>

        </div>
      </div>
      
      
    </main>
  );
}

// --- Helper Components for Animations ---

// 1. Simple Fade In/Out for the Top Title
function FadeItem({ 
  children, 
  scrollYProgress, 
  range 
}: { 
  children: React.ReactNode, 
  scrollYProgress: MotionValue<number>, 
  range: [number, number] 
}) {
  const [start, end] = range;
  
  // Fade in quickly, stay, then fade out
  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.05, end - 0.05, end],
    [0, 1, 1, 0]
  );

  return (
    <motion.div style={{ opacity }} className="absolute">
      {children}
    </motion.div>
  );
}

// 2. Slide Up + Fade Effect for the Cards
function SlideItem({ 
  children, 
  scrollYProgress, 
  range 
}: { 
  children: React.ReactNode, 
  scrollYProgress: MotionValue<number>, 
  range: [number, number] 
}) {
  const [start, end] = range;
  
  // Opacity: 0 -> 1 -> 0
  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [0, 1, 1, 0]
  );

  // Y Movement: Start slightly lower (50px), move to center (0), then move up (-50px)
  const y = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [50, 0, 0, -50]
  );
  
  // Scale: Small pop effect
  const scale = useTransform(
    scrollYProgress,
    [start, start + 0.1, end - 0.1, end],
    [0.95, 1, 1, 0.95]
  );

  // Pointer events: Only allow interaction when fully visible
  const pointerEvents = useTransform(
      scrollYProgress, 
      (v) => (v >= start + 0.05 && v <= end - 0.05) ? 'auto' : 'none'
  );

  return (
    <motion.div 
      style={{ opacity, y, scale, pointerEvents }} 
      className="absolute"
    >
      {children}
    </motion.div>
  );
}