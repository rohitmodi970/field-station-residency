"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Sun, CloudRain, Wind } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import type { DashboardInsights, MentalWeatherInsight } from "@/lib/dashboard/insights";

interface MentalWeatherData {
  pattern: "calm" | "shifting" | "stormy" | "clearing" | "bright";
  intensity: number;
  forecast: string;
  analysis?: string;
}

const WEATHER_CONFIG = {
  calm: {
    icon: Sun,
    color: "#2f9e6b",
    light: "#e6fbf0",
    label: "Calm & Centered",
    gradient: "from-emerald-50 to-green-100",
  },
  shifting: {
    icon: Wind,
    color: "#c0a892",
    light: "#f5ede2",
    label: "Changing mood",
    gradient: "from-amber-50 to-orange-50",
  },
  stormy: {
    icon: CloudRain,
    color: "#8b7d7a",
    light: "#e8e6e4",
    label: "Heavy thoughts",
    gradient: "from-slate-100 to-gray-100",
  },
  clearing: {
    icon: Sun,
    color: "#d4b896",
    light: "#fef5e0",
    label: "Clearing phase",
    gradient: "from-yellow-50 to-amber-50",
  },
  bright: {
    icon: Sun,
    color: "#d4a574",
    light: "#fff9e6",
    label: "Clear minded",
    gradient: "from-yellow-100 to-amber-50",
  },
};

type MentalWeatherForecastProps = {
  isNewUserContext?: boolean;
  insight?: MentalWeatherInsight | null;
  analysisOverride?: string | null;
  dashboardInsights?: DashboardInsights | null;
};

const MIN_MEANINGFUL_ENTRIES = 5;

export default function MentalWeatherForecast({ isNewUserContext = false, insight, analysisOverride = null, dashboardInsights = null }: MentalWeatherForecastProps) {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<MentalWeatherData | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [showIntroDetails, setShowIntroDetails] = useState(false);
  const newUserFlag = Boolean(isNewUserContext);
  const sourceEntryCount = dashboardInsights?.sourceEntryCount ?? 0;
  const hasMeaningfulHistory = dashboardInsights ? sourceEntryCount >= MIN_MEANINGFUL_ENTRIES : null;
  const showIntroState = newUserFlag || hasMeaningfulHistory === false;

  const renderRainStreaks = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, index) => (
        <motion.div
          key={`rain-${index}`}
          className="absolute top-[-20%] h-16 w-[2px] rounded-full"
          style={{
            left: `${(index * 7) % 100}%`,
            background: "linear-gradient(180deg, rgba(120,120,120,0.0), rgba(120,120,120,0.35))",
            opacity: 0.45,
          }}
          animate={{ y: ["-10%", "120%"] }}
          transition={{
            duration: 2.2 + (index % 4) * 0.4,
            repeat: Infinity,
            delay: (index % 6) * 0.2,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );

  const renderAtmosphere = () => (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 60%)"
            : "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 60%)",
          opacity: 0.7,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 70% 70%, rgba(214,233,255,0.5), transparent 60%)",
          opacity: 0.6,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? "radial-gradient(circle at 10% 80%, rgba(160,200,220,0.08), transparent 55%)"
            : "radial-gradient(circle at 10% 80%, rgba(160,200,220,0.3), transparent 55%)",
          opacity: 0.6,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? "linear-gradient(180deg, rgba(12,18,26,0.15), rgba(12,18,26,0) 55%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%)",
          opacity: 0.4,
        }}
      />
    </>
  );

  const renderSkyDust = () => (
    <>
      {Array.from({ length: 16 }).map((_, index) => (
        <motion.span
          key={`dust-${index}`}
          className="absolute rounded-full"
          style={{
            top: `${10 + (index * 7) % 60}%`,
            left: `${6 + (index * 13) % 80}%`,
            width: `${4 + (index % 3)}px`,
            height: `${4 + (index % 3)}px`,
            background: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)",
            opacity: 0.5,
          }}
          animate={{ opacity: [0.2, 0.6, 0.2], y: ["0%", "6%", "0%"] }}
          transition={{ duration: 6 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </>
  );

  const renderFloatingClouds = () => (
    <>
      {[
        { top: "8%", left: "6%", width: "34%", height: "22%", delay: 0, size: "lg" },
        { top: "18%", right: "4%", width: "40%", height: "26%", delay: 0.6, size: "lg" },
        { top: "34%", left: "18%", width: "42%", height: "26%", delay: 1.2, size: "lg" },
        { top: "8%", left: "44%", width: "22%", height: "16%", delay: 0.3, size: "sm" },
        { top: "22%", right: "16%", width: "24%", height: "16%", delay: 0.9, size: "sm" },
        { top: "36%", left: "6%", width: "20%", height: "14%", delay: 1.4, size: "sm" },
      ].map((cloud, index) => {
        const isSmall = cloud.size === "sm";
        return (
          <motion.div
            key={`float-cloud-${index}`}
            className="absolute"
            style={{
              top: cloud.top,
              left: cloud.left,
              right: cloud.right,
              width: cloud.width,
              height: cloud.height,
              opacity: isSmall ? 0.98 : 0.92,
            }}
            animate={{ x: ["-10%", "10%", "-10%"], y: ["0%", "5%", "0%"] }}
            transition={{ duration: 14 + index * 2, repeat: Infinity, delay: cloud.delay, ease: "easeInOut" }}
          >
          <div
            className="absolute inset-0"
            style={{
              filter: isDarkMode
                ? "drop-shadow(0 12px 24px rgba(0,0,0,0.35))"
                : "drop-shadow(0 10px 18px rgba(120,140,180,0.35))",
            }}
          >
            <div
              className={`absolute bottom-0 left-[10%] h-[70%] w-[45%] rounded-full ${isSmall ? "blur-lg" : "blur-xl"}`}
              style={{
                background: isDarkMode ? "rgba(255,255,255,0.34)" : "rgba(240,247,255,1)",
                opacity: isDarkMode ? 0.92 : 0.98,
                boxShadow: isDarkMode
                  ? "0 0 14px rgba(255,255,255,0.18)"
                  : "0 0 16px rgba(120,150,210,0.35)",
              }}
            />
            <div
              className={`absolute bottom-[8%] left-[30%] h-[85%] w-[55%] rounded-full ${isSmall ? "blur-lg" : "blur-xl"}`}
              style={{
                background: isDarkMode ? "rgba(255,255,255,0.36)" : "rgba(245,250,255,1)",
                opacity: isDarkMode ? 0.94 : 1,
                boxShadow: isDarkMode
                  ? "0 0 16px rgba(255,255,255,0.18)"
                  : "0 0 18px rgba(120,150,210,0.35)",
              }}
            />
            <div
              className={`absolute bottom-0 right-[6%] h-[65%] w-[40%] rounded-full ${isSmall ? "blur-lg" : "blur-xl"}`}
              style={{
                background: isDarkMode ? "rgba(255,255,255,0.32)" : "rgba(236,245,255,1)",
                opacity: isDarkMode ? 0.9 : 0.96,
                boxShadow: isDarkMode
                  ? "0 0 12px rgba(255,255,255,0.16)"
                  : "0 0 14px rgba(120,150,210,0.32)",
              }}
            />
                {/* subtle SVG overlay to give cloud edges and texture */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                  <defs>
                    <linearGradient id={`cloudEdge-${index}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                      <stop offset="60%" stopColor="rgba(245,250,255,0.85)" />
                      <stop offset="100%" stopColor="rgba(230,240,255,0.6)" />
                    </linearGradient>

                    <filter id={`noise-${index}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feTurbulence baseFrequency="0.9" numOctaves="2" seed={index} result="t" />
                      <feColorMatrix type="saturate" values="0" result="mono" />
                      <feGaussianBlur in="mono" stdDeviation="0.6" result="g" />
                      <feComposite in="g" in2="SourceGraphic" operator="in" result="c" />
                      <feBlend in="SourceGraphic" in2="c" mode="screen" />
                    </filter>

                    <filter id={`soft-${index}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.6" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>

                    <linearGradient id={`sheen-${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
                      <stop offset="50%" stopColor="rgba(255,255,255,0.24)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                    </linearGradient>
                  </defs>

                  {/* textured soft cloud body */}
                  <path d="M10 50 C 30 20, 60 20, 80 50 C 100 20, 140 20, 170 50 L170 68 L10 68 Z" fill={`url(#cloudEdge-${index})`} opacity={0.92} filter={`url(#noise-${index})`} />

                  {/* soft inner shadow */}
                  <path d="M12 56 C 32 30, 62 30, 82 56 C 102 34, 142 34, 168 56 L168 66 L12 66 Z" fill={isDarkMode ? 'rgba(0,0,0,0.06)' : 'rgba(200,220,240,0.06)'} filter={`url(#soft-${index})`} opacity={0.9} />

                  {/* sheen highlight */}
                  <path d="M20 44 C 56 22, 92 22, 128 44" stroke={`url(#sheen-${index})`} strokeWidth="8" strokeLinecap="round" opacity={0.55} fill="none" />

                  {/* fine edge stroke to give definition */}
                  <path d="M10 50 C 30 20, 60 20, 80 50 C 100 20, 140 20, 170 50" stroke={isDarkMode ? 'rgba(0,0,0,0.06)' : 'rgba(90,120,150,0.06)'} strokeWidth="1" fill="none" />
                </svg>
          </div>
          </motion.div>
        );
      })}
    </>
  );

  const renderLightning = () => (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <motion.div
          key={`lightning-flash-${index}`}
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 55% 18%, rgba(255,255,255,0.9), transparent 55%)",
            opacity: 0,
          }}
          animate={{ opacity: [0, 1, 0, 0, 0.7, 0] }}
          transition={{ duration: 4.2 + index * 1.4, repeat: Infinity, delay: index * 1.1, ease: "easeInOut" }}
        />
      ))}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.4), transparent 62%)",
          opacity: 0,
        }}
        animate={{ opacity: [0, 0.4, 0, 0, 0.25, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {Array.from({ length: 2 }).map((_, index) => (
        <motion.svg
          key={`lightning-bolt-${index}`}
          viewBox="0 0 120 260"
          className="absolute top-[-10%] h-[120%] w-24"
          style={{
            left: `${26 + index * 24}%`,
            opacity: 0,
            filter: "drop-shadow(0 0 18px rgba(255,255,255,0.65))",
          }}
          animate={{ opacity: [0, 1, 0, 0, 0.7, 0], y: ["-4%", "0%", "-4%"] }}
          transition={{ duration: 5.4 + index * 0.6, repeat: Infinity, delay: 0.6 + index * 1.6, ease: "easeInOut" }}
        >
          <path
            d="M58 0 L78 58 L56 58 L86 132 L62 132 L92 220 L44 148 L66 148 L36 78 L58 78 Z"
            fill="url(#boltCore)"
          />
          <path
            d="M58 0 L78 58 L56 58 L86 132 L62 132 L92 220 L44 148 L66 148 L36 78 L58 78 Z"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="3"
          />
          <defs>
            <linearGradient id="boltCore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,1)" />
              <stop offset="100%" stopColor="rgba(180,220,255,0.5)" />
            </linearGradient>
          </defs>
        </motion.svg>
      ))}
    </>
  );

  const renderStormVeil = () => (
    <motion.div
      className="absolute inset-0"
      style={{
        background: "radial-gradient(circle at 55% 15%, rgba(120,120,120,0.35), transparent 60%)",
        opacity: 0.6,
      }}
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    />
  );

  const renderRainSheets = () => (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div
          key={`rain-sheet-${index}`}
          className="absolute -top-[40%] h-[160%] w-24"
          style={{
            left: `${index * 18}%`,
            background: "linear-gradient(180deg, rgba(180,200,220,0), rgba(180,200,220,0.25) 50%, rgba(180,200,220,0) 100%)",
            filter: "blur(6px)",
            opacity: 0.35,
          }}
          animate={{ y: ["-10%", "8%", "-10%"], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4 + index * 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </>
  );

  const renderSunRays = () => (
    <motion.div
      className="absolute top-5 right-6 h-32 w-32"
      animate={{ rotate: [0, 18, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute inset-[-18%] rounded-full"
        style={{
          background: `radial-gradient(circle, ${config.color}26 0%, rgba(255,255,255,0) 70%)`,
          filter: "blur(8px)",
        }}
        animate={{ opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 30%, #fff7dc 0%, #f7e3b1 40%, #f0d08a 70%)`,
          filter: "blur(0.6px)",
          opacity: 0.9,
        }}
      />
    </motion.div>
  );

  const renderSunGlints = () => (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <motion.div
          key={`sun-glint-${index}`}
          className="absolute rounded-full"
          style={{
            top: `${10 + index * 12}%`,
            right: `${12 + index * 6}%`,
            width: `${10 + index * 4}px`,
            height: `${10 + index * 4}px`,
            background: "radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0))",
            filter: "blur(3px)",
            opacity: 0.5,
          }}
          animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.3, 1] }}
          transition={{ duration: 5 + index, repeat: Infinity, ease: "easeInOut", delay: index * 0.8 }}
        />
      ))}
    </>
  );

  const renderGrainTexture = () => (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 0.04 : 0.06 }}>
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain"><feTurbulence baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.12" /></feComponentTransfer></filter>
        <rect width="100%" height="100%" filter="url(#grain)" fill={isDarkMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'} />
      </svg>
    </div>
  );

  const renderParticles = () => (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={`p-${i}`}
          className="absolute rounded-full"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            left: `${5 + (i * 7) % 90}%`,
            top: `${10 + (i * 11) % 60}%`,
            background: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)'
          }}
          animate={{ y: ['-6%', '6%', '-6%'], opacity: [0.15, 0.6, 0.15], x: ['0%', '3%', '0%'] }}
          transition={{ duration: 10 + (i % 5) * 1.2, repeat: Infinity, delay: (i % 6) * 0.3 }}
        />
      ))}
    </div>
  );

  const renderMeadow = () => (
    <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none" style={{ zIndex: 2 }}>
      <motion.svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="meadowGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={isDarkMode ? 'rgba(20,34,28,0.0)' : 'rgba(220,250,230,0.0)'} />
            <stop offset="60%" stopColor={isDarkMode ? 'rgba(20,34,28,0.12)' : 'rgba(220,250,230,0.28)'} />
            <stop offset="100%" stopColor={isDarkMode ? 'rgba(20,34,28,0.28)' : 'rgba(200,240,210,0.7)'} />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 40 C 180 10, 360 70, 540 40 C 720 10, 900 70, 1080 40 C 1260 10, 1440 70, 1440 40 L1440 160 L0 160 Z"
          fill="url(#meadowGrad)"
          initial={{ translateY: 6 }}
          animate={{ translateY: [6, 0, 6] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.svg>
    </div>
  );

  const renderBirds = () => (
    <>
      <motion.svg viewBox="0 0 260 120" className="absolute right-6 top-4 h-10 w-28" style={{ opacity: 0.92 }} animate={{ y: [0, -2, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}>
        <defs>
          <linearGradient id="birdStrokeA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(55,90,120,0.95)'} />
            <stop offset="100%" stopColor={isDarkMode ? 'rgba(220,240,255,0.75)' : 'rgba(95,130,160,0.75)'} />
          </linearGradient>
        </defs>
        <path d="M24 74 C 44 54, 70 54, 92 74 C 70 62, 46 62, 24 74 Z" fill="none" stroke="url(#birdStrokeA)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M92 74 C 110 56, 134 56, 154 74 C 134 63, 112 63, 92 74 Z" fill="none" stroke="url(#birdStrokeA)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="89" cy="74" r="1.6" fill={isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(55,90,120,0.9)'} />
      </motion.svg>
      <motion.svg viewBox="0 0 220 100" className="absolute right-20 top-10 h-7 w-20" style={{ opacity: 0.76 }} animate={{ y: [0, 1, 0] }} transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
        <defs>
          <linearGradient id="birdStrokeB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(70,110,140,0.9)'} />
            <stop offset="100%" stopColor={isDarkMode ? 'rgba(220,240,255,0.6)' : 'rgba(95,130,160,0.65)'} />
          </linearGradient>
        </defs>
        <path d="M22 56 C 36 42, 54 42, 70 56 C 54 49, 38 49, 22 56 Z" fill="none" stroke="url(#birdStrokeB)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M70 56 C 82 44, 98 44, 112 56 C 98 50, 84 50, 70 56 Z" fill="none" stroke="url(#birdStrokeB)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
      <motion.svg viewBox="0 0 220 100" className="absolute right-32 top-7 h-6 w-16" style={{ opacity: 0.62 }} animate={{ y: [0, -1, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}>
        <defs>
          <linearGradient id="birdStrokeC" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isDarkMode ? 'rgba(255,255,255,0.82)' : 'rgba(80,120,150,0.82)'} />
            <stop offset="100%" stopColor={isDarkMode ? 'rgba(220,240,255,0.52)' : 'rgba(95,130,160,0.55)'} />
          </linearGradient>
        </defs>
        <path d="M18 52 C 30 40, 46 40, 60 52 C 46 46, 32 46, 18 52 Z" fill="none" stroke="url(#birdStrokeC)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </>
  );

  const renderCloudBank = () => (
    <motion.div
      className="absolute left-[-8%] top-[18%] h-56 w-[116%] pointer-events-none"
      style={{ opacity: 1, overflow: 'visible' }}
      animate={{ x: ['-2%', '3%', '-2%'] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* gentle meadow gradient at the bottom so clouds sit above a soft green field */}
      <div className="absolute inset-x-0 bottom-0 h-28" style={{
        background: isDarkMode
          ? 'linear-gradient(180deg, rgba(12,18,26,0), rgba(12,18,26,0.5))'
          : 'linear-gradient(180deg, rgba(220,250,230,0), rgba(220,250,230,0.6))',
        filter: 'blur(8px)',
        opacity: 0.9,
      }} />

      {/* layered blurred cloud blobs to form a soft bank with no straight baseline */}
      <div className="absolute inset-0">
        <div className="absolute left-[6%] top-[16%] h-28 w-2/3 rounded-full" style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.9), rgba(255,255,255,0.45) 35%, rgba(255,255,255,0.08) 65%, transparent 100%)'
            : 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(245,250,255,0.6) 36%, rgba(240,247,255,0.12) 70%, transparent 100%)',
          filter: 'blur(12px)',
          opacity: isDarkMode ? 0.78 : 0.88,
        }} />
        <div className="absolute left-[30%] top-[22%] h-32 w-1/2 rounded-full" style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.85), rgba(255,255,255,0.4) 34%, rgba(255,255,255,0.06) 68%, transparent 100%)'
            : 'radial-gradient(circle at 50% 40%, rgba(245,250,255,0.9), rgba(245,250,255,0.5) 34%, rgba(240,247,255,0.06) 68%, transparent 100%)',
          filter: 'blur(10px)',
          opacity: isDarkMode ? 0.72 : 0.86,
        }} />
        <div className="absolute left-[48%] top-[18%] h-24 w-2/5 rounded-full" style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.78), rgba(255,255,255,0.36) 36%, rgba(255,255,255,0.04) 70%, transparent 100%)'
            : 'radial-gradient(circle at 30% 40%, rgba(236,245,255,0.9), rgba(236,245,255,0.44) 36%, rgba(240,247,255,0.04) 70%, transparent 100%)',
          filter: 'blur(10px)',
          opacity: isDarkMode ? 0.68 : 0.82,
        }} />
        <div className="absolute left-[12%] top-[28%] h-20 w-1/4 rounded-full" style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.7), rgba(255,255,255,0.32) 34%, rgba(255,255,255,0.02) 66%, transparent 100%)'
            : 'radial-gradient(circle at 40% 40%, rgba(240,247,255,0.9), rgba(240,247,255,0.36) 34%, rgba(240,247,255,0.02) 66%, transparent 100%)',
          filter: 'blur(8px)',
          opacity: isDarkMode ? 0.64 : 0.78,
        }} />
      </div>
    </motion.div>
  );

  const renderCloudBaselineMask = () => {
    const topColor = isDarkMode ? 'rgba(12,18,26,0)' : 'rgba(255,255,255,0)';
    const midColor = isDarkMode ? 'rgba(12,18,26,0.35)' : 'rgba(230,242,255,0.6)';
    const bottomColor = isDarkMode ? 'rgba(12,18,26,0.9)' : 'rgba(255,255,255,0.98)';

    return (
      <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none" aria-hidden>
        <svg viewBox="0 0 1440 200" className="absolute left-0 right-0 bottom-0 w-full h-full" preserveAspectRatio="none" style={{ opacity: 0.95 }}>
          <defs>
            <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={topColor} />
              <stop offset="55%" stopColor={midColor} />
              <stop offset="100%" stopColor={bottomColor} />
            </linearGradient>
          </defs>
          <path
            d="M0 80 C 120 40, 240 120, 360 80 C 480 40, 600 120, 720 80 C 840 40, 960 120, 1080 80 C 1200 40, 1320 120, 1440 80 L1440 200 L0 200 Z"
            fill="url(#baselineGrad)"
            style={{ filter: 'blur(6px)' }}
          />
        </svg>
      </div>
    );
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let next: MentalWeatherData | null = null;
      try {
        if (showIntroState) {
          if (!cancelled) {
            setData(null);
            setAnalysisText(null);
            setExpanding(false);
            setShowIntroDetails(false);
            setLoading(false);
          }
          return;
        }
        if (typeof window !== "undefined" && process.env.NODE_ENV !== "production" && window.location.hostname === "localhost") {
          const debugPattern = new URLSearchParams(window.location.search).get("weather");
          if (debugPattern && ["stormy", "shifting", "calm", "clearing", "bright"].includes(debugPattern)) {
            next = {
              pattern: debugPattern as MentalWeatherData["pattern"],
              intensity: 42,
                forecast: "Storms in motion. Keep your footing with one steady step.",
                analysis: "Short-term turbulence is present — naming it and taking a breath can help you feel steadier.",
            };
          }
        }
        if (!next && insight) {
          next = {
            pattern: insight.pattern,
            intensity: insight.intensity,
            forecast: insight.forecast,
            analysis: insight.analysis || analysisOverride || undefined,
          };
        }
        if (!next && newUserFlag) {
          next = {
            pattern: "calm",
            intensity: 58,
            forecast: "Your space is just opening. Start with one honest line about how today feels.",
            analysis: "You're at the beginning of a new practice — small notes build insight over time. Be kind to yourself.",
          };
        }
        if (!next) {
          const res = await fetch("/api/momentum", { headers: { "Cache-Control": "no-cache" } });
          if (!res.ok) throw new Error("failed");
          const json = await res.json();
          if (json.consistency) {
            const score = json.consistency.score || 50;
            let pattern: MentalWeatherData["pattern"] = "shifting";
            let forecast = "";
            let analysis = "";

            if (score < 20) {
              pattern = "stormy";
              forecast = "There is a lot present. A few steady breaths and a short note can help.";
              analysis = "You might be carrying intense feelings right now - focusing on one small action can help.";
            } else if (score < 40) {
              pattern = "shifting";
              forecast = "Your mind is moving between states. Gentle attention helps settle things.";
              analysis = "Your thoughts are moving; noticing one recurring thread can bring clarity.";
            } else if (score < 60) {
              pattern = "calm";
              forecast = "Mental quiet. Use this space to notice what matters most.";
              analysis = "Things feel steady and manageable - a good moment to notice small wins or set a gentle intention.";
            } else if (score < 80) {
              pattern = "clearing";
              forecast = "Clarity is breaking through. This is a good moment to act.";
              analysis = "You're gaining clarity - consider one clear next step that aligns with your priorities.";
            } else {
              pattern = "bright";
              forecast = "Your mind is bright and open. Paint the picture you want to live.";
              analysis = "High energy and openness - use this momentum to outline a bold, focused action.";
            }

            next = { pattern, intensity: score, forecast, analysis };
          }
        }
      } catch {
        // use default below
      } finally {
        if (!cancelled) {
          setData(
            next ?? {
              pattern: "calm",
              intensity: 58,
              forecast: "A steadier day. Use this moment to name what matters most.",
              analysis: "This feels like a gentle, steady moment — notice what feels nourishing and consider a small, kind next step.",
            }
          );
          setAnalysisText(next?.analysis || analysisOverride || "This feels like a gentle, steady moment — notice what feels nourishing and consider a small, kind next step.");
          setLoading(false);
        }
      }
    }
    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, [analysisOverride, insight, showIntroState]);

  if (loading) return null;

  if (showIntroState) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="min-h-[420px] lg:min-h-[480px] rounded-[30px] border overflow-hidden relative bg-gradient-to-br from-emerald-50 to-green-100"
        style={{ borderColor: "rgba(47,158,107,0.18)", isolation: "isolate", display: 'flex', flexDirection: 'column' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {renderAtmosphere()}
          {renderGrainTexture()}
          {renderSkyDust()}
          {renderFloatingClouds()}
          {renderCloudBaselineMask()}
        </div>

        <div className="p-6 sm:p-7 lg:p-8 relative z-30 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                style={{ color: "#2f9e6b" }}
              >
                <Sun size={32} />
              </motion.div>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#2f9e6b", opacity: 0.95 }}>
                  Mental weather
                </p>
                <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--dashboard-heading-font, serif)", color: "#2f9e6b" }}>
                  We’re still learning your weather
                </h3>
              </div>
            </div>

            <div className="bg-white/95 rounded-2xl px-4 py-3 mb-4 backdrop-blur-sm border shadow-sm" style={{ borderColor: "rgba(47,158,107,0.22)" }}>
              <p className="text-sm leading-relaxed font-semibold" style={{ color: "#1f1f1f", fontFamily: "var(--dashboard-body-font, sans-serif)" }}>
                Write a few more entries and I’ll start showing patterns like calm, shifting, or a midday peak from your own history.
              </p>
            </div>

            <div className="mb-4 rounded-2xl border bg-white/55 px-4 py-3 shadow-[0_8px_22px_rgba(80,110,90,0.08)] backdrop-blur-sm" style={{ borderColor: "rgba(47,158,107,0.18)", minHeight: 96 }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#4b5563", fontFamily: "var(--dashboard-body-font, sans-serif)" }}>
                {showIntroDetails
                  ? "Once there’s enough journal history, this card will reflect your own patterns instead of guessing. Until then, keep writing naturally and the forecast will become more specific over time."
                  : "A full forecast will appear after you’ve shared a bit more of your week."}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowIntroDetails((current) => !current)}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/90"
                  style={{ color: "#2f9e6b" }}
                >
                  {showIntroDetails ? 'Show less' : 'Read a bit more'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: "#2f9e6b" }}>🧘 Sit</div>
            <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: "#2f9e6b" }}>👀 Notice</div>
            <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: "#2f9e6b" }}>💭 Reflect</div>
          </div>
        </div>
      </motion.section>
    );
  }

  if (!data) return null;

  const config = WEATHER_CONFIG[data.pattern];
  const Icon = config.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className={`min-h-[420px] lg:min-h-[480px] rounded-[30px] border overflow-hidden relative bg-gradient-to-br ${config.gradient}`}
      style={{ borderColor: `${config.color}40`, isolation: "isolate", display: 'flex', flexDirection: 'column' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {renderAtmosphere()}
        {renderGrainTexture()}
        {renderParticles()}
        {renderBirds()}
        <div className="absolute inset-x-0 bottom-0 h-[52%] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: isDarkMode
                ? "linear-gradient(180deg, rgba(24,28,40,0.1), rgba(24,28,40,0.35) 70%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.0), rgba(200,214,240,0.35) 70%)",
              opacity: 0.9,
            }}
          />
          {renderSkyDust()}
          {(data.pattern === "clearing" || data.pattern === "bright" || data.pattern === "calm") && (
            <motion.div
              className="absolute inset-x-0 top-0 h-32"
              style={{
                background: isDarkMode
                  ? "radial-gradient(circle at 40% 10%, rgba(120,200,150,0.2), transparent 65%)"
                  : "radial-gradient(circle at 40% 10%, rgba(120,200,150,0.45), transparent 70%)",
                filter: "blur(8px)",
                opacity: 0.8,
              }}
              animate={{ opacity: [0.6, 1, 0.6], y: ["0%", "4%", "0%"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {(data.pattern === "clearing" || data.pattern === "bright" || data.pattern === "calm") && (
            <div className="absolute inset-x-0 bottom-0 h-16">
              <div
                className="absolute inset-0"
                style={{
                  background: isDarkMode
                    ? "linear-gradient(180deg, rgba(60,100,80,0), rgba(60,100,80,0.35) 55%, rgba(60,100,80,0.55))"
                    : "linear-gradient(180deg, rgba(180,220,190,0), rgba(140,200,160,0.5) 55%, rgba(120,180,140,0.75))",
                  filter: "blur(2px)",
                }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-10"
                style={{
                  background: isDarkMode
                    ? "repeating-linear-gradient(90deg, rgba(80,130,100,0.5) 0 2px, rgba(40,90,70,0.2) 2px 5px)"
                    : "repeating-linear-gradient(90deg, rgba(140,200,160,0.55) 0 2px, rgba(110,170,130,0.2) 2px 6px)",
                  opacity: 0.6,
                }}
              />
            </div>
          )}
          <motion.div
            className="absolute inset-x-0 bottom-8 h-20"
            style={{
              background: isDarkMode
                ? "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2), transparent 70%)"
                : "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6), transparent 70%)",
              filter: "blur(6px)",
              opacity: 0.9,
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-x-[-8%] top-[18%] h-12"
            style={{
              background: isDarkMode
                ? "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.2), rgba(255,255,255,0.06))"
                : "linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.6), rgba(255,255,255,0.2))",
              filter: "blur(10px)",
              opacity: 0.6,
            }}
            animate={{ x: ["-6%", "6%", "-6%"], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-x-[-10%] top-[42%] h-16"
            style={{
              background: isDarkMode
                ? "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.16), rgba(255,255,255,0.05))"
                : "linear-gradient(90deg, rgba(255,255,255,0.16), rgba(255,255,255,0.45), rgba(255,255,255,0.16))",
              filter: "blur(12px)",
              opacity: 0.55,
            }}
            animate={{ x: ["4%", "-4%", "4%"], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          {renderFloatingClouds()}
          {renderCloudBank()}
          {renderCloudBaselineMask()}
          {renderMeadow()}
          {data.pattern === "stormy" && renderRainStreaks()}
          {data.pattern === "stormy" && renderRainSheets()}
          {data.pattern === "stormy" && renderLightning()}
          {data.pattern === "stormy" && renderStormVeil()}
          {(data.pattern === "clearing" || data.pattern === "bright" || data.pattern === "calm") && renderSunRays()}
          {(data.pattern === "clearing" || data.pattern === "bright" || data.pattern === "calm") && renderSunGlints()}
        </div>
      </div>

      <div className="p-6 sm:p-7 lg:p-8 relative z-30">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{
              y: data.pattern === "shifting" ? [0, -4, 0] : [0, -2, 0],
              rotate: data.pattern === "shifting" ? [0, -5, 5, 0] : 0,
            }}
            transition={{ duration: data.pattern === "shifting" ? 2.5 : 2, repeat: Infinity }}
            style={{ color: config.color }}
          >
            <Icon size={32} />
          </motion.div>
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: config.color, opacity: 0.95 }}>
              Mental weather
            </p>
            <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--dashboard-heading-font, serif)", color: config.color }}>
              {config.label}
            </h3>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl px-4 py-3 mb-4 backdrop-blur-sm border shadow-sm" style={{ borderColor: `${config.color}45` }}>
          <p className="text-sm leading-relaxed font-semibold" style={{ color: "#1f1f1f", fontFamily: "var(--dashboard-body-font, sans-serif)" }}>
            {data.forecast}
          </p>
        </div>

        <div className="mb-4 rounded-2xl border bg-white/55 px-4 py-3 shadow-[0_8px_22px_rgba(80,110,90,0.08)] backdrop-blur-sm" style={{ borderColor: `${config.color}2f`, minHeight: 96 }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#4b5563", fontFamily: "var(--dashboard-body-font, sans-serif)" }}>
            {analysisText || data.analysis || (expanding ? 'Expanding this thought…' : 'A calm note is forming.')}
          </p>
          {String(analysisText || data.analysis || '').length < 160 && (
            <div className="mt-3">
              <button
                onClick={async () => {
                  if (expanding) return;
                  try {
                    setExpanding(true);
                    const res = await fetch('/api/dashboard/insights?force=1&expand=mentalWeather', { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('failed');
                    const json = await res.json();
                    const expanded = json?.mentalWeather?.analysis || null;
                    if (expanded) {
                      setAnalysisText(String(expanded));
                      setData((d) => d ? { ...d, analysis: String(expanded) } : d);
                    }
                  } catch (e) {
                    console.error('Failed to expand analysis', e);
                  } finally {
                    setExpanding(false);
                  }
                }}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/90"
                style={{ color: config.color }}
              >
                {expanding ? 'Loading…' : 'Read a bit more'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {data.pattern === "stormy" && (
            <>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>💬 Name it</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🌬️ Breathe</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>📝 Write</div>
            </>
          )}
          {data.pattern === "shifting" && (
            <>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🫂 Ground</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🎯 Focus</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🔄 Flow</div>
            </>
          )}
          {data.pattern === "calm" && (
            <>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🧘 Sit</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>👀 Notice</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>💭 Reflect</div>
            </>
          )}
          {(data.pattern === "clearing" || data.pattern === "bright") && (
            <>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🎨 Create</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>⚡ Act</div>
              <div className="rounded-lg px-3 py-2 text-center bg-white/40 text-xs font-semibold" style={{ color: config.color }}>🚀 Move</div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1" aria-hidden />
    </motion.section>
  );
}
