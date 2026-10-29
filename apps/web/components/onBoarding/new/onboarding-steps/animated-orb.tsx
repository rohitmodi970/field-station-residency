'use client';

import React from 'react';

export default function AnimatedOrb() {
  return (
    <div className="ob-orb-container relative w-48 h-48 md:w-56 md:h-56 select-none">
      <style>{`
        @keyframes ob-orb-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .ob-orb-float {
          animation: ob-orb-float 6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-orb-float {
            animation: none !important;
          }
          .ob-orb-container svg animate {
            display: none !important;
          }
        }
      `}</style>

      {/* Atmospheric warm ambient halo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(225, 175, 155, 0.25) 0%, rgba(240, 205, 190, 0.12) 50%, transparent 80%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(235, 185, 165, 0.2) 20%, transparent 70%)',
        }}
      />

      {/* Main floating SVG Orb */}
      <div className="relative w-full h-full ob-orb-float">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          style={{
            filter: 'drop-shadow(0 16px 36px rgba(159, 105, 88, 0.18))',
          }}
        >
          <defs>
            {/* Main radial gradient - warm peach and soft clay */}
            <radialGradient id="orbBaseWarm" cx="38%" cy="38%">
              <stop offset="0%" stopColor="rgba(255, 248, 242, 0.98)" />
              <stop offset="30%" stopColor="rgba(245, 215, 200, 0.88)" />
              <stop offset="70%" stopColor="rgba(205, 150, 130, 0.70)" />
              <stop offset="100%" stopColor="rgba(159, 105, 88, 0.35)" />
            </radialGradient>

            {/* Primary flowing current - soft clay / terracotta */}
            <linearGradient id="flowClay1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(245, 195, 175, 0.75)" />
              <stop offset="50%" stopColor="rgba(215, 145, 125, 0.50)" />
              <stop offset="100%" stopColor="rgba(159, 105, 88, 0.25)" />
            </linearGradient>

            {/* Secondary flowing current - warm amber/peach */}
            <linearGradient id="flowPeach2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(235, 185, 165, 0.65)" />
              <stop offset="50%" stopColor="rgba(195, 135, 115, 0.40)" />
              <stop offset="100%" stopColor="rgba(245, 205, 190, 0.25)" />
            </linearGradient>

            {/* Soft inner glow */}
            <radialGradient id="innerGlowWarm" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255, 235, 225, 0.55)" />
              <stop offset="100%" stopColor="rgba(225, 175, 155, 0.12)" />
            </radialGradient>

            {/* Gaussian blur filters */}
            <filter id="softBlurWarm">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
            <filter id="flowBlurWarm">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
            </filter>
          </defs>

          {/* Layer 1: Base orb sphere */}
          <circle
            cx="100"
            cy="100"
            r="95"
            fill="url(#orbBaseWarm)"
            opacity="0.95"
          />

          {/* Layer 2: Flowing current paths */}
          <path
            d="M 50,80 Q 80,30 120,60 T 140,120"
            stroke="url(#flowClay1)"
            strokeWidth="8"
            fill="none"
            opacity="0.75"
            strokeLinecap="round"
            filter="url(#flowBlurWarm)"
          >
            <animate
              attributeName="d"
              values="
                M 50,80 Q 80,30 120,60 T 140,120;
                M 45,70 Q 75,35 125,65 T 145,110;
                M 55,90 Q 85,25 115,55 T 135,130;
                M 50,80 Q 80,30 120,60 T 140,120
              "
              dur="8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.55;0.85;0.65;0.55"
              dur="8s"
              repeatCount="indefinite"
            />
          </path>

          {/* Secondary flowing wisp */}
          <path
            d="M 150,120 Q 120,170 80,140 T 60,80"
            stroke="url(#flowPeach2)"
            strokeWidth="7"
            fill="none"
            opacity="0.65"
            strokeLinecap="round"
            filter="url(#flowBlurWarm)"
          >
            <animate
              attributeName="d"
              values="
                M 150,120 Q 120,170 80,140 T 60,80;
                M 155,130 Q 125,165 75,135 T 55,75;
                M 145,110 Q 115,175 85,145 T 65,85;
                M 150,120 Q 120,170 80,140 T 60,80
              "
              dur="10s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.45;0.75;0.55;0.45"
              dur="10s"
              repeatCount="indefinite"
            />
          </path>

          {/* Tertiary flowing element */}
          <ellipse
            cx="100"
            cy="70"
            rx="40"
            ry="25"
            fill="none"
            stroke="url(#flowClay1)"
            strokeWidth="5"
            opacity="0.4"
            filter="url(#flowBlurWarm)"
          >
            <animate
              attributeName="ry"
              values="25;35;25"
              dur="6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="70;80;70"
              dur="6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.55;0.3"
              dur="6s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Layer 3: Inner luminous glow */}
          <circle
            cx="100"
            cy="100"
            r="65"
            fill="url(#innerGlowWarm)"
            opacity="0.65"
          >
            <animate
              attributeName="r"
              values="65;75;65"
              dur="7s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.45;0.75;0.45"
              dur="7s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Layer 4: Floating light sparkles */}
          <circle cx="75" cy="55" r="1.2" fill="rgba(255, 235, 225, 0.85)">
            <animate
              attributeName="cy"
              values="55;45;55"
              dur="5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>

          <circle cx="130" cy="75" r="0.9" fill="rgba(245, 215, 200, 0.75)">
            <animate
              attributeName="cx"
              values="130;145;130"
              dur="6.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur="6.5s"
              repeatCount="indefinite"
            />
          </circle>

          <circle cx="100" cy="40" r="1" fill="rgba(255, 240, 230, 0.85)">
            <animate
              attributeName="cy"
              values="40;28;40"
              dur="4.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.95;0"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </circle>

          <circle cx="65" cy="120" r="0.8" fill="rgba(235, 185, 165, 0.75)">
            <animate
              attributeName="cx"
              values="65;50;65"
              dur="7s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="7s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Layer 5: Subtle surface reflection */}
          <ellipse
            cx="85"
            cy="80"
            rx="28"
            ry="32"
            fill="rgba(255, 255, 255, 0.35)"
            opacity="0.6"
            filter="url(#softBlurWarm)"
          >
            <animate
              attributeName="rx"
              values="28;35;28"
              dur="9s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.55;0.3"
              dur="9s"
              repeatCount="indefinite"
            />
          </ellipse>
        </svg>
      </div>
    </div>
  );
}
