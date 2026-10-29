'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FastForward, Rewind, Volume2 } from 'lucide-react';

interface RetroTVProps {
  mainVideoSrc?: string;
  staticAudioSrc?: string; // Path to your static noise sound file
}

export default function UltimateRetroTV({ 
 mainVideoSrc = '/video/shri_intro.mp4',
  staticAudioSrc = '/video/Video_Revision_and_Cinematic_Ending.mp4' 
}: RetroTVProps) {
  // States: 'off' | 'on' | 'static'
  const [powerState, setPowerState] = useState<'off' | 'on' | 'static'>('off');
  const [isPlaying, setIsPlaying] = useState(false);
  const [channel, setChannel] = useState(3);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const staticAudioRef = useRef<HTMLAudioElement>(null);

  // --- CRITICAL FIX: Force Stop on Power Off ---
  useEffect(() => {
    if (powerState === 'off') {
      // 1. Stop Main Video immediately
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Optional: Reset to start
      }
      // 2. Stop Static Audio immediately
      if (staticAudioRef.current) {
        staticAudioRef.current.pause();
        staticAudioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
  }, [powerState]);

  // --- Sequence Logic ---

  const togglePower = () => {
    if (powerState !== 'off') {
      // Turn Off - The useEffect above handles the actual pausing
      setPowerState('off');
    } else {
      // Turn On
      setPowerState('on');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }, 1200); // Warm-up delay (Tube heating up)
    }
  };

  const handleVideoEnd = () => {
    setPowerState('static');
    setIsPlaying(false);

    // Play Static Sound
    if (staticAudioRef.current) {
        staticAudioRef.current.currentTime = 0;
        staticAudioRef.current.play().catch(() => {});
        staticAudioRef.current.volume = 0.4;
    }

    // Cut to Black after 3 Seconds
    setTimeout(() => {
        // Only turn off if we are still in static mode (user hasn't turned it off manually)
        setPowerState((prev) => prev === 'static' ? 'off' : prev);
    }, 3000);
  };

  const togglePlay = () => {
    if (powerState !== 'on' || !videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (seconds: number) => {
    if (videoRef.current && powerState === 'on') {
        videoRef.current.currentTime += seconds;
    }
  };

  return (
    <div className="min-h-screen  flex flex-col items-center justify-center p-4 overflow-hidden relative selection:bg-none font-sans">
      
      {/* Audio Element for Static Noise */}
      <audio ref={staticAudioRef} src={staticAudioSrc} loop />

      {/* Ambient Lighting (Room Glow) */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vh] bg-amber-100/5 blur-[120px] pointer-events-none transition-opacity duration-1000 ${powerState === 'off' ? 'opacity-0' : 'opacity-100'}`} />

      {/* --- THE TV CHASSIS --- */}
      <div className="relative group perspective-[2000px]">
        
        {/* 1. Antennas */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-40 z-0">
            <motion.div drag dragConstraints={{ left:0,right:0,top:0,bottom:0 }} className="absolute left-8 bottom-0 w-2 h-56 bg-gradient-to-r from-gray-400 to-gray-200 origin-bottom -rotate-[25deg] rounded-full shadow-xl cursor-grab active:cursor-grabbing border-l border-black/20">
                 <div className="w-4 h-4 bg-gray-300 rounded-full absolute -top-1 -left-[4px] shadow-sm" />
            </motion.div>
            <motion.div drag dragConstraints={{ left:0,right:0,top:0,bottom:0 }} className="absolute right-8 bottom-0 w-2 h-56 bg-gradient-to-r from-gray-400 to-gray-200 origin-bottom rotate-[25deg] rounded-full shadow-xl cursor-grab active:cursor-grabbing border-l border-black/20">
                 <div className="w-4 h-4 bg-gray-300 rounded-full absolute -top-1 -left-[4px] shadow-sm" />
            </motion.div>
        </div>

        {/* 2. Main Cabinet (Walnut Veneer) */}
        <div 
          className="relative w-[900px] h-[580px] rounded-[2.5rem] p-8 z-10 flex shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)]"
          style={{
            backgroundColor: '#382212',
            backgroundImage: `url("https://www.transparenttextures.com/patterns/wood-pattern.png"), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.4) 100%)`,
            boxShadow: `
              inset 0 1px 2px rgba(255,255,255,0.3), 
              inset 0 -10px 20px rgba(0,0,0,0.8),
              0 30px 60px rgba(0,0,0,1)
            `
          }}
        >
          {/* Bevel details */}
          <div className="absolute inset-0 rounded-[2.5rem] border-t border-white/10 border-b-[3px] border-black/60 pointer-events-none" />

          {/* --- LEFT: The CRT Screen Housing --- */}
          <div className="flex-1 bg-[#121212] rounded-[2rem] p-6 relative shadow-[inset_0_2px_15px_rgba(0,0,0,1)] border-b border-white/5 overflow-hidden">
             
             {/* The Screen Bezel (Deep Plastic) */}
             <div className="w-full h-full bg-[#050505] rounded-[2rem] relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,1)] border-[6px] border-[#1a1a1a]">
                
                {/* 1. CONTENT LAYER */}
                <div className="relative w-full h-full overflow-hidden rounded-[1.8rem]">
                    
                    {/* VIDEO PLAYER (Visible when ON) */}
                    <video
                        ref={videoRef}
                        src={mainVideoSrc}
                        className={`w-full h-full object-cover scale-[1.1] transition-opacity duration-200 ${powerState === 'on' ? 'opacity-100' : 'opacity-0'}`}
                        style={{ filter: 'contrast(1.1) saturation(1.15) sepia(0.1)' }}
                        onEnded={handleVideoEnd}
                    />

                    {/* STATIC NOISE (Visible when ENDED) */}
                    {powerState === 'static' && (
                        <div className="absolute inset-0 z-20">
                            {/* CSS-based High Quality Noise */}
                            <div className="w-full h-full opacity-100 mix-blend-normal relative overflow-hidden bg-black">
                                <svg className="w-full h-full absolute inset-0 opacity-100 scale-150 animate-scramble">
                                    <filter id="noise">
                                        <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="5" stitchTiles="stitch" />
                                        <feColorMatrix type="saturate" values="0" />
                                    </filter>
                                    <rect width="100%" height="100%" filter="url(#noise)" />
                                </svg>
                                {/* Rolling bars for realism */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-[20%] w-full animate-scan" />
                            </div>
                        </div>
                    )}

                    {/* PERMANENT CRT EFFECTS (Scanlines & Vignette) */}
                    <div className="absolute inset-0 z-30 pointer-events-none mix-blend-multiply opacity-50 bg-[url('https://raw.githubusercontent.com/zadvorsky/three.bas/master/examples/effects/scanlines.png')] bg-contain" />
                    <div className="absolute inset-0 z-30 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_90%,black_120%)]" />
                </div>

                {/* 2. POWER OFF ANIMATION (The "Dot") */}
                <AnimatePresence>
                    {powerState === 'off' && (
                        <motion.div 
                            initial={{ scaleX: 1, scaleY: 1, opacity: 1, background: '#fff' }}
                            animate={{ scaleX: [1, 1, 0.005, 0], scaleY: [1, 0.005, 0.005, 0], opacity: [1, 1, 1, 0] }}
                            transition={{ duration: 0.6, times: [0, 0.2, 0.6, 1], ease: "easeInOut" }}
                            className="absolute inset-0 z-50 pointer-events-none mix-blend-normal bg-white"
                        />
                    )}
                </AnimatePresence>

                {/* 3. GLASS REFLECTION (The "Cinematic" Layer) */}
                <div className="absolute inset-0 z-40 pointer-events-none rounded-[2rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]">
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12 opacity-40" />
                    <div className="absolute top-4 left-6 w-32 h-20 bg-white/10 blur-2xl rounded-[100%] opacity-30 rotate-[-20deg]" />
                </div>

                {/* 4. OSD Channel */}
                <AnimatePresence>
                    {powerState === 'on' && (
                         <motion.div 
                            initial={{ opacity: 1, scale: 1.1 }} animate={{ opacity: 0, scale: 1 }} transition={{ delay: 2.5, duration: 1 }}
                            className="absolute top-8 right-10 z-30 font-mono text-[#0f0] text-5xl font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,1)] mix-blend-screen opacity-80"
                         >
                            CH 0{channel}
                         </motion.div>
                    )}
                </AnimatePresence>
             </div>
          </div>

          {/* --- RIGHT: Control Panel (Speaker & Wood) --- */}
          <div className="w-[240px] pl-8 flex flex-col relative">
            
            {/* Panel Background with darker stain */}
            <div className="absolute inset-0 bg-[#2a1a0e] rounded-r-[2.5rem] -z-10 border-l border-black/50 shadow-inner" />

            {/* A. Top Dials */}
            <div className="flex flex-col items-center gap-6 mt-6 mb-8">
                 <div className="relative group">
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[#c4b5a3] text-[10px] font-bold tracking-[0.2em] uppercase opacity-60">UHF</span>
                    <RotaryDial value={channel} onChange={() => setChannel(c => c >= 13 ? 2 : c + 1)} />
                 </div>
                 <div className="relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[#c4b5a3] text-[9px] font-bold tracking-[0.2em] uppercase opacity-60">Volume</span>
                    <SmallKnob />
                 </div>
            </div>

            {/* B. Speaker Grille (Fabric Texture) */}
            <div className="w-full flex-1 mb-8 pr-6 relative rounded-lg overflow-hidden border border-white/5 shadow-inner bg-[#1a120b]">
                {/* Fabric Pattern */}
                <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(45deg,#000_2px,transparent_3px),repeating-linear-gradient(-45deg,#3d2e1f_2px,transparent_3px)] bg-[length:8px_8px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
            </div>

            {/* C. Mechanical Buttons */}
            <div className="bg-[#1f150f] p-4 rounded-xl border-t border-white/5 border-b border-black/80 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col gap-3 items-center mx-2 mb-2">
                 
                 <div className="w-full flex justify-between items-center mb-1">
                    {/* Active Light */}
                    <div className={`w-3 h-3 rounded-full border border-black/50 shadow-[0_0_8px_currentColor] transition-all duration-300 ${powerState !== 'off' ? 'bg-red-500 text-red-500' : 'bg-[#3d1212] text-transparent'}`} />
                    <RetroButton onClick={togglePower} label="POWER" color="red" />
                 </div>

                 <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

                 <div className="grid grid-cols-2 gap-3 w-full">
                    <RetroButton onClick={() => seek(-5)} label="REW" />
                    <RetroButton onClick={() => seek(5)} label="FFWD" />
                 </div>
                 <RetroButton onClick={togglePlay} label={isPlaying ? "PAUSE" : "PLAY"} fullWidth />
            </div>

          </div>
        </div>

        {/* Reflection on the 'Table' */}
        <div className="absolute -bottom-20 left-20 right-20 h-24 bg-gradient-to-b from-black/80 to-transparent blur-3xl rounded-[100%]" />
      </div>

      {/* CSS Animations for Static & Scan */}
      <style jsx global>{`
        @keyframes scramble {
          0% { transform: translate(0,0) scale(1.5); }
          10% { transform: translate(-5%,-5%) scale(1.5); }
          20% { transform: translate(-10%,5%) scale(1.5); }
          30% { transform: translate(5%,-10%) scale(1.5); }
          40% { transform: translate(-5%,15%) scale(1.5); }
          50% { transform: translate(-10%,5%) scale(1.5); }
          60% { transform: translate(15%,0) scale(1.5); }
          70% { transform: translate(0,10%) scale(1.5); }
          80% { transform: translate(-15%,0) scale(1.5); }
          90% { transform: translate(10%,5%) scale(1.5); }
          100% { transform: translate(5%,0) scale(1.5); }
        }
        .animate-scramble {
          animation: scramble 0.2s steps(4) infinite;
        }
        @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(500%); }
        }
        .animate-scan {
            animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
}


// --- REALISTIC SUB-COMPONENTS ---

const RetroButton = ({ onClick, label, color = 'wood', fullWidth }: any) => {
    return (
        <motion.button
            onClick={onClick}
            whileTap={{ y: 3, scale: 0.98 }}
            className={`
                relative h-11 ${fullWidth ? 'w-full' : 'w-full'} 
                rounded-md flex items-center justify-center gap-2
                bg-gradient-to-b from-[#463629] to-[#241a13]
                shadow-[0_5px_0_#120c09,0_8px_10px_rgba(0,0,0,0.5)]
                active:shadow-[0_0_0_#120c09,inset_0_2px_5px_rgba(0,0,0,0.8)]
                active:translate-y-[5px]
                transition-all border-t border-white/10
                group overflow-hidden
            `}
        >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20" />
            <span className="text-[10px] font-bold text-[#b09b85] tracking-[0.1em] group-hover:text-white drop-shadow-md z-10">{label}</span>
        </motion.button>
    )
}

const RotaryDial = ({ value, onChange }: any) => {
    return (
        <motion.div 
            onClick={onChange}
            whileTap={{ rotate: 30 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-[#291e17] to-[#0f0b08] shadow-[0_10px_20px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.1)] flex items-center justify-center cursor-pointer border-[2px] border-[#3d2e24] relative"
        >
            {/* Ridges */}
            {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute w-1 h-3 bg-[#1a120e] top-1 rounded-full origin-center shadow-[0_1px_0_rgba(255,255,255,0.1)]" style={{ transform: `rotate(${i * 30}deg) translateY(-2px)` }} />
            ))}
            
            {/* Inner Cap */}
            <div className="w-12 h-12 rounded-full bg-[#140f0c] flex items-center justify-center shadow-[inset_0_2px_5px_black] relative z-10 border border-white/5">
                <div className="w-full h-[2px] bg-[#d6c4b0] absolute rotate-45 opacity-60" />
                <span className="text-[#d6c4b0] font-mono font-bold text-lg drop-shadow-[0_2px_2px_black] z-10">{value}</span>
            </div>
        </motion.div>
    )
}

const SmallKnob = () => (
    <motion.div whileTap={{ rotate: 10 }} className="w-10 h-10 rounded-full bg-[#1f1611] shadow-[0_5px_10px_rgba(0,0,0,0.5)] border border-[#3d2e24] flex items-center justify-center cursor-pointer">
        <div className="w-1 h-4 bg-[#8a7560] rounded-full" />
    </motion.div>
)