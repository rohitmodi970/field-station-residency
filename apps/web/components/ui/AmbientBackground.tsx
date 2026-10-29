'use client';

import React, { useEffect, useRef } from 'react';

export interface AmbientBackgroundProps {
  /**
   * Intensity of the ambient background gradients.
   * Defaults to 'calm'.
   */
  intensity?: 'calm' | 'subtle' | 'vibrant';
  /**
   * Whether pointer-parallax on desktop is enabled.
   * Can be set to false during transitions (e.g. form -> success).
   */
  interactive?: boolean;
  className?: string;
}

export function AmbientBackground({
  intensity = 'calm',
  interactive = true,
  className = '',
}: AmbientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  // Intensity mappings for opacity
  const opacityMultiplier =
    intensity === 'vibrant' ? 1.4 : intensity === 'subtle' ? 0.7 : 1.0;

  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: fine)');

    if (motionQuery.matches || !pointerQuery.matches || !interactive) {
      // Return early: non-interactive on mobile or when reduced motion is preferred
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrameId: number;

    const handlePointerMove = (e: MouseEvent) => {
      // Normalize to -1 to +1 from viewport center
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const animate = () => {
      // Smooth lerp (linear interpolation with damping factor 0.05)
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate3d(${currentX * -25}px, ${currentY * -20}px, 0)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate3d(${currentX * 30}px, ${currentY * 25}px, 0)`;
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.transform = `translate3d(${currentX * 15}px, ${currentY * -15}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ob-canvas select-none ${className}`}
    >
      <style>{`
        @keyframes ambient-drift-1 {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(15px, -12px, 0) scale(1.03); }
        }
        @keyframes ambient-drift-2 {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-18px, 15px, 0) scale(1.04); }
        }
        @media (pointer: coarse) {
          .orb-passive-1 {
            animation: ambient-drift-1 16s ease-in-out infinite;
          }
          .orb-passive-2 {
            animation: ambient-drift-2 20s ease-in-out infinite;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .orb-passive-1, .orb-passive-2 {
            animation: none !important;
          }
        }
      `}</style>

      {/* Warm atmospheric gradient mesh / soft orbs */}
      <div
        ref={orb1Ref}
        className="orb-passive-1 absolute -top-[18%] -left-[12%] h-[680px] w-[680px] rounded-full blur-[140px] will-change-transform"
        style={{
          backgroundColor: '#9F6958', // ob-clay
          opacity: 0.085 * opacityMultiplier,
        }}
      />

      <div
        ref={orb2Ref}
        className="orb-passive-2 absolute -bottom-[16%] -right-[12%] h-[620px] w-[620px] rounded-full blur-[130px] will-change-transform"
        style={{
          backgroundColor: '#D4A88C', // warm peach / tan
          opacity: 0.095 * opacityMultiplier,
        }}
      />

      <div
        ref={orb3Ref}
        className="absolute top-[35%] left-[25%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] will-change-transform"
        style={{
          backgroundColor: '#F1E1DA', // ob-clay-soft
          opacity: 0.14 * opacityMultiplier,
        }}
      />

      {/* Soft fine grain / paper subtle texture for tactile cream feel */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(42, 33, 28, 0.4) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  );
}

export default AmbientBackground;
