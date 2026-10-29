'use client';

import { useRef, useEffect, type HTMLAttributes } from 'react';

export interface SpotlightConfig {
  radius?: number;
  brightness?: number;
  color?: string;
  smoothing?: number;
}

export const useSpotlightEffect = (config: SpotlightConfig) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Only run on desktop screens (>= 768px)
    if (typeof window === 'undefined' || window.innerWidth < 768) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let targetX = -1000;
    let targetY = -1000;
    let currentX = -1000;
    let currentY = -1000;

    const resizeCanvas = () => {
      if (window.innerWidth < 768) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (window.innerWidth < 768) return;
      const rect = canvas.getBoundingClientRect();

      // Only activate when cursor is strictly within the right panel (not on the left canvas/dot side)
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        targetX = -1000;
        targetY = -1000;
        return;
      }

      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      targetX = -1000;
      targetY = -1000;
    };

    const hexToRgb = (hex: string) => {
      const sanitized = hex.replace('#', '');
      const bigint = parseInt(sanitized, 16);
      if (Number.isNaN(bigint)) return '236,230,219';
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `${r},${g},${b}`;
    };

    const smoothing = config.smoothing ?? 0.12;
    const radius = config.radius || 240;
    const rgbColor = hexToRgb(config.color || '#ece6db');
    const brightness = config.brightness ?? 0.12;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (targetX !== -1000 && targetY !== -1000) {
        if (currentX === -1000 || currentY === -1000) {
          currentX = targetX;
          currentY = targetY;
        } else {
          currentX += (targetX - currentX) * smoothing;
          currentY += (targetY - currentY) * smoothing;
        }

        const gradient = ctx.createRadialGradient(
          currentX, currentY, 0,
          currentX, currentY, radius
        );
        gradient.addColorStop(0, `rgba(${rgbColor}, ${brightness})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
      } else {
        currentX = -1000;
        currentY = -1000;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [config.radius, config.brightness, config.color, config.smoothing]);

  return canvasRef;
};

export interface SpotlightProps extends HTMLAttributes<HTMLCanvasElement> {
  config?: SpotlightConfig;
}

export const SpotlightCursor = ({
  config = {},
  className = '',
  ...rest
}: SpotlightProps) => {
  const spotlightConfig: SpotlightConfig = {
    radius: 240,
    brightness: 0.12,
    color: '#ece6db',
    smoothing: 0.12,
    ...config,
  };

  const canvasRef = useSpotlightEffect(spotlightConfig);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 hidden md:block w-full h-full ${className}`}
      {...rest}
    />
  );
};

export default SpotlightCursor;
