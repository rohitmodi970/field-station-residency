'use client';

import React, { useEffect, useRef } from 'react';
import { useScroll, useTransform, useMotionValueEvent, motion } from 'framer-motion';
import Lenis from 'lenis';
import { MindCardTxt } from './Cards_without_img'; 

export default function MazeScroll() {
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

  return (
    <main className="bg-[#FFC0CB] font-sans">
      
      {/* Scroll Track Container - 1200vh for a long, luxurious scroll */}
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

            {/* CARD 2 - Appears at 35-65% scroll */}
            <motion.div 
              style={{ opacity: card2Opacity, y: card2Y, pointerEvents: card2PointerEvents }}
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
                content="Force helps you zoom out of the complexity to create a space where your attention can settle." 
              />
            </motion.div>

          </div>

        </div>
      </div>

      {/* Footer Section */}
      <div className="h-screen bg-[#2A2A2A] flex items-center justify-center text-white relative z-20">
        <h2 className="text-4xl font-bold">You have arrived.</h2>
      </div>
    </main>
  );
}