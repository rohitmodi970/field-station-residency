'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FastForward, Rewind, ChevronRight, Battery } from 'lucide-react';

interface IPodPlayerProps {
  audioSrc?: string;
}

type ViewState = 'menu' | 'player';

export default function IPodPlayer({ audioSrc = '/music/The_Blaze.mp3' }: IPodPlayerProps) {
  const [view, setView] = useState<ViewState>('player');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(454); 
  const [selectedIndex, setSelectedIndex] = useState(0); // For menu navigation
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const menuItems = ['Now Playing', 'Music', 'Settings', 'Shuffle Songs', 'Backlight'];

  // --- Logic ---

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleMenuClick = () => {
    setView(view === 'menu' ? 'player' : 'menu');
  };

  const handleCenterClick = () => {
    if (view === 'menu') {
      if (selectedIndex === 0) setView('player');
      // Other menu items are visual only for this demo
    } else {
      togglePlay();
    }
  };

  const handleWheelScroll = (direction: 'next' | 'prev') => {
    if (view === 'menu') {
      if (direction === 'next') setSelectedIndex((prev) => (prev + 1) % menuItems.length);
      else setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
    } else {
      // In player mode, wheel could adjust volume (simulated here) or skip
      if (audioRef.current) {
        audioRef.current.currentTime += direction === 'next' ? 5 : -5;
      }
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration) setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen  p-8 font-sans selection:bg-transparent">
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* --- DEVICE BODY --- */}
      {/* Uses gradients and multiple shadows to create a metallic, rounded physical object */}
      <div 
        className="relative w-[370px] h-[620px] rounded-[3.5rem] p-6 flex flex-col justify-between overflow-hidden"
        style={{ 
          background: 'linear-gradient(145deg, #6b5d3d 0%, #4a402a 100%)',
          boxShadow: `
            inset 2px 2px 5px rgba(255,255,255,0.2), 
            inset -2px -2px 5px rgba(0,0,0,0.5),
            20px 20px 60px rgba(0,0,0,0.6),
            -5px -5px 20px rgba(255,255,255,0.02)
          `
        }} 
      >
        {/* Metallic Bevel Highlight */}
        <div className="absolute inset-0 rounded-[3.5rem] border border-white/10 pointer-events-none" />

        {/* --- SCREEN AREA --- */}
        <div className="relative group">
           {/* Screen Frame (Inset Shadow) */}
          <div className="bg-black w-full h-[290px] rounded-xl overflow-hidden relative border-[3px] border-[#382f1e] shadow-[inset_0_4px_10px_rgba(0,0,0,1)]">
            
            {/* Screen Content Wrapper */}
            <div className="relative z-10 w-full h-full bg-gradient-to-b from-[#222] to-[#111] text-white overflow-hidden">
                
                {/* Top Status Bar */}
                <div className="h-6 w-full bg-gradient-to-b from-white/20 to-transparent flex justify-between items-center px-2 text-[10px] font-medium border-b border-white/10">
                    <div className="flex items-center gap-1"><Play size={8} fill="white"/></div>
                    <div>12:42 PM</div>
                    <div><Battery size={12} fill="white" /></div>
                </div>

                <AnimatePresence mode="wait">
                  {view === 'menu' ? (
                    <motion.div 
                      key="menu"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="w-full h-full bg-white text-black flex"
                    >
                      <div className="w-1/2 p-2 border-r border-gray-300">
                         <h3 className="font-bold text-sm mb-1 px-1 border-b border-gray-300">iPod</h3>
                         <ul>
                            {menuItems.map((item, idx) => (
                              <li 
                                key={item} 
                                className={`flex justify-between items-center px-1 py-0.5 text-xs font-medium cursor-pointer ${selectedIndex === idx ? 'bg-blue-600 text-white' : ''}`}
                                onClick={() => setSelectedIndex(idx)}
                              >
                                {item}
                                <ChevronRight size={10} />
                              </li>
                            ))}
                         </ul>
                      </div>
                      <div className="w-1/2 relative bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          {/* Menu Static Preview Image */}
                          <div className="opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                             <SpotifyIcon size="large" />
                          </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="player"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="w-full h-full p-5 flex flex-col"
                    >
                      {/* Album View */}
                      <div className="flex flex-row gap-4 items-center mt-2">
                        <div className="w-32 h-32 rounded-sm shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 shrink-0">
                          <PixelGradientArt />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h2 className="text-2xl font-bold truncate leading-tight">Force</h2>
                          <p className="text-sm text-gray-400 font-medium truncate">LAOLU</p>
                          <p className="text-xs text-gray-500 truncate mt-1">The Blaze - HEAVEN</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mt-auto pb-2">
                         <div className="w-full h-2 bg-[#333] rounded-sm mb-1 relative overflow-hidden shadow-inner border border-white/5">
                            <motion.div 
                              className="absolute top-0 left-0 h-full bg-gradient-to-b from-blue-300 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                              style={{ width: `${(currentTime / duration) * 100}%` }}
                            />
                         </div>
                         <div className="flex justify-between text-[10px] font-mono text-gray-400">
                            <span>{formatTime(currentTime)}</span>
                            <span>-{formatTime(duration - currentTime)}</span>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>

            {/* Glass Reflection Overlay */}
            <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12 pointer-events-none z-20" />
            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-30 pointer-events-none rounded-xl" />
          </div>
        </div>

        {/* --- CONTROLS AREA --- */}
        <div className="flex-1 flex items-center justify-center relative">
          
          {/* Wheel Container */}
          <div className="relative">
             {/* Main Wheel Surface */}
             <div 
               className="w-64 h-64 rounded-full relative flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.3)] z-10 active:scale-[0.99] transition-transform duration-100"
               style={{ 
                 background: 'conic-gradient(from 180deg, #b39c6b 0%, #a08a5a 50%, #b39c6b 100%)', // Subtle textural gradient
               }}
             >
                {/* Physical Wheel Texture (Noise/Matte) overlay */}
                <div className="absolute inset-0 rounded-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                
                {/* Buttons mapped to Wheel Positions */}
                <WheelButton position="top" label="MENU" onClick={handleMenuClick} />
                
                <WheelButton position="bottom" onClick={togglePlay}>
                    <div className="flex gap-1 items-center transform translate-y-1 opacity-80">
                      {isPlaying ? <Pause size={18} fill="#3f3218" strokeWidth={0} /> : <Play size={18} fill="#3f3218" strokeWidth={0} />}
                    </div>
                </WheelButton>

                <WheelButton position="left" onClick={() => handleWheelScroll('prev')}>
                    <Rewind size={18} fill="#3f3218" strokeWidth={0} className="opacity-80" />
                </WheelButton>

                <WheelButton position="right" onClick={() => handleWheelScroll('next')}>
                    <FastForward size={18} fill="#3f3218" strokeWidth={0} className="opacity-80" />
                </WheelButton>

                {/* Center Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCenterClick}
                  className="w-24 h-24 rounded-full z-20 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #594d33, #2a2110)', // Concave look
                    boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.1), 0 1px 2px rgba(255,255,255,0.1)'
                  }}
                >
                    {/* Inner highlight for concave effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-black/20 to-transparent pointer-events-none" />
                </motion.button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Sub Components ---

const WheelButton = ({ 
  position, 
  children, 
  label, 
  onClick 
}: { 
  position: 'top' | 'bottom' | 'left' | 'right'; 
  children?: React.ReactNode; 
  label?: string;
  onClick: () => void;
}) => {
  const positionClasses = {
    top: 'top-4 left-1/2 -translate-x-1/2 pb-4',
    bottom: 'bottom-4 left-1/2 -translate-x-1/2 pt-4',
    left: 'left-4 top-1/2 -translate-y-1/2 pr-4',
    right: 'right-4 top-1/2 -translate-y-1/2 pl-4'
  };

  return (
    <motion.button 
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering wheel drag if we added it later
        onClick();
      }}
      whileTap={{ scale: 0.85, color: '#000' }}
      className={`absolute ${positionClasses[position]} text-[#3f3218] font-bold text-[13px] tracking-tighter z-20 w-16 h-16 flex items-center justify-center`}
    >
      {label || children}
    </motion.button>
  );
};

const PixelGradientArt = () => (
  <div className="w-full h-full grid grid-cols-4 grid-rows-4">
    <div className="bg-[#a3c94f]"></div><div className="bg-[#8bb556]"></div><div className="bg-[#6b9e6e]"></div><div className="bg-[#4a8282]"></div>
    <div className="bg-[#f2e62e]"></div><div className="bg-[#cddb36]"></div><div className="bg-[#a3c94f]"></div><div className="bg-[#8bb556]"></div>
    <div className="bg-[#f7b51b]"></div><div className="bg-[#f5cf25]"></div><div className="bg-[#f2e62e]"></div><div className="bg-[#cddb36]"></div>
    <div className="bg-[#ea8c15]"></div><div className="bg-[#f7b51b]"></div><div className="bg-[#f5cf25]"></div><div className="bg-[#f2e62e]"></div>
  </div>
);

const SpotifyIcon = ({ size = 'normal' }: { size?: 'normal' | 'large' }) => {
  const dim = size === 'large' ? 'w-16 h-16' : 'w-5 h-5';
  
  return (
  <div className={`${dim} bg-[#1DB954] rounded-full flex items-center justify-center text-black shadow-md`}>
    <svg width={size === 'large' ? 40 : 14} height={size === 'large' ? 40 : 14} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  </div>
)};