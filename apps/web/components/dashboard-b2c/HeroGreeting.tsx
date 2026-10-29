"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { Zap, Sun, Sunset, Moon, CloudSun } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroGreetingProps {
  userName: string;
  streakCount?: number;
  totalEntries?: number;
  isNewUser?: boolean;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const greetings: Record<TimeOfDay, string[]> = {
  morning: ['Good morning', 'Rise and shine', 'Hello, sunshine'],
  afternoon: ['Good afternoon', 'Hey there', 'Hope your day is great'],
  evening: ['Good evening', 'Welcome back', 'Time to unwind'],
  night: ['Good night', 'Still up?', 'Burning the midnight oil'],
};

const timeIcons: Record<TimeOfDay, React.ReactNode> = {
  morning: <Sun className="w-6 h-6 sm:w-8 sm:h-8" />,
  afternoon: <CloudSun className="w-6 h-6 sm:w-8 sm:h-8" />,
  evening: <Sunset className="w-6 h-6 sm:w-8 sm:h-8" />,
  night: <Moon className="w-6 h-6 sm:w-8 sm:h-8" />,
};

const subtexts = {
  newUser: "Welcome to your journaling journey. Let's start with how you're feeling.",
  noStreak: "Ready to write something meaningful today?",
  hasStreak: (count: number) => `You're on a ${count}-day streak! Keep the momentum going.`,
  milestone: (entries: number) => `${entries} entries and counting , you're building something beautiful.`,
};

const HeroGreeting: React.FC<HeroGreetingProps> = ({
  userName,
  streakCount = 0,
  totalEntries = 0,
  isNewUser = false,
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  
  useEffect(() => {
    setTimeOfDay(getTimeOfDay());
  }, []);

  const greeting = useMemo(() => {
    const options = greetings[timeOfDay];
    return options[Math.floor(Math.random() * options.length)];
  }, [timeOfDay]);

  const subtext = useMemo(() => {
    if (isNewUser || totalEntries === 0) return subtexts.newUser;
    if (totalEntries > 0 && totalEntries % 50 === 0) return subtexts.milestone(totalEntries);
    if (streakCount > 1) return subtexts.hasStreak(streakCount);
    return subtexts.noStreak;
  }, [isNewUser, streakCount, totalEntries]);

  const gradientVar = `linear-gradient(135deg, rgba(255,247,252,0.98) 0%, rgba(255,231,242,0.94) 52%, rgba(255,212,230,0.9) 100%)`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-(--radius-hero) p-6 sm:p-8 md:p-10 lg:p-12"
      style={{
        background: gradientVar,
        boxShadow: '0 18px 40px rgba(131,42,80,0.16)',
        border: '1px solid rgba(196,88,131,0.22)',
      }}
    >
      {/* Decorative floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-3xl"
            style={{ background: '#ff8db7' }}
        />
        <div 
          className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-15 blur-2xl"
          style={{ background: '#ffc3de' }}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
        {/* Time icon + Greeting */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
            style={{ color: '#8f2a5e' }}
          >
            {timeIcons[timeOfDay]}
          </motion.div>
          
          {streakCount > 1 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs sm:text-sm font-medium"
              style={{ color: '#8f2a5e', border: '1px solid rgba(167,63,104,0.25)', background: 'rgba(255, 241, 248, 0.82)' }}
            >
              <Zap className="w-3.5 h-3.5" />
              {streakCount}-day streak
            </motion.div>
          )}
        </div>

        {/* Main greeting text */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight"
            style={{ 
              color: '#4e1736',
              fontFamily: 'var(--dashboard-heading-font, var(--font-serif))',
              letterSpacing: '0.03em',
            }}
          >
            {greeting}, {userName}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-2 text-sm sm:text-base md:text-lg lg:text-xl max-w-xl lg:max-w-2xl"
            style={{ 
              color: '#7b2d55',
              fontFamily: 'var(--dashboard-body-font, inherit)',
              letterSpacing: '0.02em',
            }}
          >
            {subtext}
          </motion.p>
        </div>
      </div>
    </motion.section>
  );
};

export default HeroGreeting;
