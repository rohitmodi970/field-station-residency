"use client"
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle, Mail, Clock, ArrowRight, Play, Pause, Volume2 } from 'lucide-react';

interface FinalWelcomeProps {
  goToPrevSection: () => void;
  onComplete?: () => void;
  userEmail?: string;
  userName?: string;
}

interface Particle {
  width: number;
  height: number;
  x: number;
  y: number;
  animateX: number[];
  animateY: number[];
  opacity: number[];
  duration: number;
}

const FinalWelcome: React.FC<FinalWelcomeProps> = ({
  goToPrevSection,
  onComplete,
  userEmail,
  userName
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [penguinClicked, setPenguinClicked] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionStep, setTransitionStep] = useState(0);
  const [currentPenguinGif, setCurrentPenguinGif] = useState('headphones');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonSoundRef = useRef<HTMLAudioElement | null>(null);

  // Penguin GIF URLs
  const penguinGifs: Record<string, string> = {
    headphones: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHZlanAzcDhhNTVyNTV1azhkendscXY4d2R5dGNqYXdqem5vM2QxbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/awiM51Q3K2l4Joe4xS/giphy.gif',
    sitBack: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHZlanAzcDhhNTVyNTV1azhkendscXY4d2R5dGNqYXdqem5vM2QxbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hS0VSJId1ZUdikCxjV/giphy.gif',
    dancing: 'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2dndTdqc2gycTN3am42c3psbzRhZzl1YWM2dWpoZXBuOTJjb2t4diZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/PJocRhi3sStDOcJI1w/giphy.gif',
    paused: 'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ2NjNmRwNTV0Y2sxazJ6MGhpb2xsMmtkNjNsajJiZjM1MW1lbXhsdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sM0ZUp75O71RlfiBMK/giphy.gif',
    random1: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXNqem5xcXV5cW12aXdiZzJ4M3lqbmZvdzc1eHNidTBqaGJnaWRqdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j94OAr4IEwxkbFLeMJ/giphy.gif',
    random2: 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnNqd3MzNWc2djRsdjE3ZzYxdWpnZnM4a2dwcTJidW10czFubmw3YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ycRdZe3T7z2wKztYw7/giphy.gif',
    serious: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzBsZzV0NTNkaHN5eDAwNW1mMHUxNXV1ZHBkZTV2bXd0ejRmbThpNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/AKqk7lcwQ4bhFOwI8V/giphy.gif',
    chill: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXM3N3dhY2RpdTB3aW9vbXJmOXFtd2N1aHQ1cnl3NXRsMWEzMnBkcCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OgisYjI5Qgq0U9V7qo/giphy.gif'
  };

  const transitionMessages = [
    "Sit back and relax...",
    "Let the music begin...",
    "Enjoy your moment..."
  ];

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.location.href = 'https://www.findmyforce.com/';
    }
  };

  const handlePenguinClick = () => {
    if (penguinClicked) return;
    
    setPenguinClicked(true);
    setShowTransition(true);
    
    // Play button sound
    if (buttonSoundRef.current) {
      buttonSoundRef.current.currentTime = 0;
      buttonSoundRef.current.play().catch(e => console.log('Button sound failed:', e));
    }
    
    // Transition sequence
    setTimeout(() => {
      setTransitionStep(1);
      setCurrentPenguinGif('sitBack');
    }, 500);
    
    setTimeout(() => {
      setTransitionStep(2);
    }, 1500);
    
    setTimeout(() => {
      setTransitionStep(3);
    }, 2500);
    
    // Start music after transition
    setTimeout(() => {
      setShowTransition(false);
      setCurrentPenguinGif('dancing');
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        setIsPlaying(true);
      }
    }, 3000);
  };

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentPenguinGif('paused');
      } else {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        setIsPlaying(true);
        setCurrentPenguinGif('dancing');
      }
    }
  };

  const changePenguinMood = () => {
    if (!isPlaying) return;
    
    const randomGifs = ['random1', 'random2', 'serious', 'chill'];
    const randomGif = randomGifs[Math.floor(Math.random() * randomGifs.length)] || 'dancing';
    setCurrentPenguinGif(randomGif);
    
    // Return to dancing after 3 seconds
    setTimeout(() => {
      if (isPlaying) {
        setCurrentPenguinGif('dancing');
      }
    }, 3000);
  };

  useEffect(() => {
    // Initialize audio
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/success-music.mp3');
      buttonSoundRef.current = new Audio('/button-sound.mp3');
    }
    
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }
    
    if (buttonSoundRef.current) {
      buttonSoundRef.current.volume = 0.5;
    }

    if (typeof window !== 'undefined') {
      const newParticles = Array.from({ length: 25 }).map(() => ({
        width: Math.random() * 6 + 3,
        height: Math.random() * 6 + 3,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        animateX: [
          Math.random() * window.innerWidth,
          Math.random() * window.innerWidth,
          Math.random() * window.innerWidth,
        ],
        animateY: [
          Math.random() * window.innerHeight,
          Math.random() * window.innerHeight,
          Math.random() * window.innerHeight,
        ],
        opacity: [0.1, 0.4, 0.1],
        duration: Math.random() * 25 + 25,
      }));
      setParticles(newParticles);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (buttonSoundRef.current) {
        buttonSoundRef.current = null;
      }
    };
  }, []);

  return (
    <motion.div
      id="finalWelcome"
      className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center text-gray-800 overflow-hidden relative px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Enhanced background elements */}
      <motion.div className="absolute inset-0 z-0">
        <div className="absolute top-20 left-4 md:left-20 w-20 md:w-32 h-20 md:h-32 border-2 border-blue-200 rounded-full opacity-30 backdrop-blur-sm"></div>
        <div className="absolute bottom-32 right-4 md:right-32 w-16 md:w-24 h-16 md:h-24 border-2 border-purple-200 rounded-lg opacity-40 backdrop-blur-sm"></div>
        <div className="absolute top-1/2 left-2 md:left-10 w-12 md:w-16 h-12 md:h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-50 backdrop-blur-sm"></div>

        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute bg-gradient-to-br from-blue-300 to-purple-300 rounded-full opacity-30 backdrop-blur-sm"
            style={{
              width: particle.width,
              height: particle.height,
              x: particle.x,
              y: particle.y,
            }}
            animate={{
              x: particle.animateX,
              y: particle.animateY,
              opacity: particle.opacity,
            }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: particle.duration,
            }}
          />
        ))}
      </motion.div>

      {/* Transition Overlay */}
      <AnimatePresence>
        {showTransition && (
          <motion.div
            className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center text-white">
              <motion.div
                className="mb-8"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <img 
                  src={penguinGifs.sitBack} 
                  alt="Penguin relaxing" 
                  className="w-32 h-32 md:w-48 md:h-48 mx-auto rounded-full border-4 border-white/30 shadow-2xl"
                />
              </motion.div>
              
              <motion.h2
                className="text-2xl md:text-4xl font-bold mb-4"
                key={transitionStep}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                {transitionMessages[transitionStep] || transitionMessages[0]}
              </motion.h2>
              
              <motion.div
                className="w-32 md:w-48 h-2 bg-white/20 rounded-full mx-auto overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Penguin Interactive Element */}
      <motion.div
        className="absolute top-4 md:top-8 right-4 md:right-8 z-20"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 2, type: "spring", stiffness: 200 }}
      >
        <div className="relative">
          <motion.button
            onClick={penguinClicked ? changePenguinMood : handlePenguinClick}
            disabled={penguinClicked}
            className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full shadow-2xl transition-all duration-300 overflow-hidden border-4 ${
              penguinClicked 
                ? 'border-green-400 cursor-default' 
                : 'border-blue-400 hover:border-purple-400 cursor-pointer hover:scale-110'
            }`}
            whileHover={!penguinClicked ? { y: -3, scale: 1.1 } : {}}
            whileTap={!penguinClicked ? { scale: 0.95 } : {}}
          >
            <img 
              src={penguinGifs[currentPenguinGif]} 
              alt="Penguin" 
              className="w-full h-full object-cover"
            />
            
            {/* Overlay effects */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            
            {/* Music indicator */}
            {isPlaying && (
              <motion.div
                className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Volume2 className="h-2 w-2 text-white" />
              </motion.div>
            )}
          </motion.button>
          
          {/* Enhanced Tooltip */}
          <motion.div
            className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: penguinClicked ? 0 : 1, y: 0 }}
            transition={{ delay: 3 }}
          >
            <div className="bg-gradient-to-r from-purple-800 to-blue-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm border border-white/20">
              {penguinClicked ? "Thanks!" : "Click me for music! 🎵"}
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-purple-800 rotate-45"></div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Enhanced Music Control */}
      {penguinClicked && (
        <motion.div
          className="absolute top-4 md:top-8 left-4 md:left-8 z-20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 3.5 }}
        >
          <motion.button
            onClick={toggleMusic}
            className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 backdrop-blur-sm border-2 border-white/20"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying ? <Pause className="h-6 w-6 md:h-7 md:w-7" /> : <Play className="h-6 w-6 md:h-7 md:w-7 ml-1" />}
          </motion.button>
        </motion.div>
      )}

      {/* Enhanced Main content container */}
      <div className="max-w-3xl text-center px-4 md:px-6 z-10 relative w-full">
        {/* Enhanced Success icon */}
        <motion.div
          className="mb-8 md:mb-10"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.2
          }}
        >
          <div className="relative inline-block">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-2xl backdrop-blur-sm border-4 border-white/30">
              <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-white" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full opacity-20 blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut"
              }}
            />
          </div>
        </motion.div>

        {/* Enhanced Brand section */}
        <motion.div
          className="mb-8 md:mb-10"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <img 
              src="/logo2.png" 
              alt="Force logo" 
              className="h-10 w-10 md:h-16 md:w-16 mr-3 md:mr-4"
            />
            <span className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              ORCE
            </span>
          </div>
          <motion.div
            className="h-1 md:h-1.5 w-16 md:w-24 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: "4rem" }}
            transition={{ delay: 0.6, duration: 1 }}
          />
        </motion.div>

        {/* Enhanced Main message */}
        <motion.div
          className="mb-10 md:mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent">
            Thank you{userName ? `, ${userName}` : ''}!
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-3 font-medium">
            Your submission has been received successfully
          </p>
          <p className="text-base md:text-lg text-gray-500">
            We'll review your information and get back to you soon
          </p>
        </motion.div>

        {/* Enhanced Information section */}
        <motion.div
          className="mb-10 md:mb-14 space-y-4 md:space-y-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-xl border border-white/50">
            <div className="flex items-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mr-4 md:mr-6 flex-shrink-0 shadow-lg">
                <Mail className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-1">Check Your Email</h3>
                <p className="text-sm md:text-base text-gray-600 break-words">
                  {userEmail ? `Confirmation sent to ${userEmail}` : 'A confirmation email is on its way'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-xl border border-white/50">
            <div className="flex items-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mr-4 md:mr-6 flex-shrink-0 shadow-lg">
                <Clock className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-1">Response Time</h3>
                <p className="text-sm md:text-base text-gray-600">
                  We typically respond within 24-48 hours
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center mb-20 md:mb-24"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <motion.button
            onClick={handleGoBack}
            className="w-full sm:w-auto px-8 md:px-10 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl backdrop-blur-sm border-2 border-white/20"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Return to Home
            <ArrowRight className="h-5 w-5" />
          </motion.button>
          
          <motion.button
            onClick={goToPrevSection}
            className="w-full sm:w-auto px-6 md:px-8 py-4 text-gray-700 hover:text-gray-900 border-2 border-gray-300 hover:border-gray-400 bg-white/70 backdrop-blur-sm hover:bg-white/90 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </motion.button>
        </motion.div>
      </div>

      {/* Enhanced Status indicator */}
      <motion.div
        className="fixed bottom-6 md:bottom-8 left-1/2 transform -translate-x-1/2 z-30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
      >
        <div className="px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur-sm rounded-full border-2 border-white/50 shadow-xl">
          <div className="flex items-center gap-3 md:gap-4 text-sm md:text-base text-gray-700">
            <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-500" />
            <span className="font-semibold">Submission Complete</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FinalWelcome;