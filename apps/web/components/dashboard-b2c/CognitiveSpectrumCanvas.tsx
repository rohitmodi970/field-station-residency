'use client';

import React, { useEffect, useRef } from 'react';

export interface CognitiveStats {
  confidence: number;      // 0 - 100 (affects flow coherence vs turbulence)
  followThrough: number;   // 0 - 100 (affects gravitational center attraction)
  clarity: number;         // 0 - 100 (affects harmonic smoothness / noise octaves)
  growthVelocity: number;  // 0 - 100 (affects particle drift speed & trail energy)
  volume: number;          // 0 - 100 (affects particle density)
  emotionalAgility: number;// 0 - 100 (affects wave modulation & frequency)
}

export type ColorTheme = 'gold' | 'neural' | 'amethyst' | 'aurora';

export interface CognitiveSpectrumCanvasProps {
  stats: CognitiveStats;
  theme?: ColorTheme;
  interactive?: boolean;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

// Ultra-fast smooth 2D value noise for silky 60fps curl-flow field
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Cubic Hermite smoothstep curve
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash(ix, iy);
  const b = hash(ix + 1.0, iy);
  const c = hash(ix, iy + 1.0);
  const d = hash(ix + 1.0, iy + 1.0);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

interface Particle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  speed: number;
  size: number;
  colorR: number;
  colorG: number;
  colorB: number;
  alpha: number;
}

export const CognitiveSpectrumCanvas: React.FC<CognitiveSpectrumCanvasProps> = ({
  stats,
  theme = 'gold',
  interactive = true,
  className = '',
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Keep latest stats and theme in refs for requestAnimationFrame loop
  const statsRef = useRef(stats);
  const themeRef = useRef(theme);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1));
    let height = (canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1));
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      height = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      // Reset black background
      ctx.fillStyle = '#0a0705';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    };

    window.addEventListener('resize', handleResize);

    // Initial background fill
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Color palettes generator
    const getPaletteColor = (currentTheme: ColorTheme, progress: number) => {
      if (currentTheme === 'gold') {
        // FORCE Gold Core (amber, champagne, gold, terracotta)
        if (progress < 0.33) return { r: 245, g: 158, b: 11 };  // Amber 500
        if (progress < 0.66) return { r: 251, g: 191, b: 36 };  // Amber 400
        return { r: 255, g: 247, b: 237 };                      // Warm pearl
      } else if (currentTheme === 'neural') {
        // Neural Synapse (cyan, teal, starlight)
        if (progress < 0.33) return { r: 56, g: 189, b: 248 };  // Sky 400
        if (progress < 0.66) return { r: 45, g: 212, b: 191 };  // Teal 400
        return { r: 224, g: 242, b: 254 };                      // Starlight
      } else if (currentTheme === 'amethyst') {
        // Cognitive Depth (violet, magenta, rose)
        if (progress < 0.33) return { r: 168, g: 85, b: 247 };  // Purple 500
        if (progress < 0.66) return { r: 236, g: 72, b: 153 };  // Pink 500
        return { r: 253, g: 230, b: 138 };                      // Gold speckle
      } else {
        // Aurora Spectrum
        if (progress < 0.25) return { r: 52, g: 211, b: 153 };  // Emerald
        if (progress < 0.5) return { r: 56, g: 189, b: 248 };   // Cyan
        if (progress < 0.75) return { r: 192, g: 132, b: 252 }; // Violet
        return { r: 251, g: 191, b: 36 };                       // Amber
      }
    };

    // Calculate particle count dynamically based on screen size and volume stat
    const baseCount = Math.min(
      Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 550),
      2800
    );
    const particleCount = Math.max(
      800,
      Math.floor(baseCount * (0.6 + (statsRef.current.volume / 100) * 0.8))
    );

    // Initialize particles pool
    const particles: Particle[] = [];
    const initParticle = (p?: Partial<Particle>): Particle => {
      const displayW = canvas.offsetWidth;
      const displayH = canvas.offsetHeight;
      const randX = Math.random() * displayW;
      const randY = Math.random() * displayH;
      const progress = Math.random();
      const col = getPaletteColor(themeRef.current, progress);

      return {
        x: p?.x ?? randX,
        y: p?.y ?? randY,
        prevX: p?.x ?? randX,
        prevY: p?.y ?? randY,
        vx: 0,
        vy: 0,
        life: Math.random() * 80 + 40,
        maxLife: Math.random() * 80 + 80,
        speed: Math.random() * 0.8 + 0.6,
        size: Math.random() * 1.5 + 0.6,
        colorR: col.r,
        colorG: col.g,
        colorB: col.b,
        alpha: Math.random() * 0.5 + 0.25,
      };
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push(initParticle());
    }

    let time = 0;

    // Animation Render Loop
    const render = () => {
      const displayW = canvas.offsetWidth;
      const displayH = canvas.offsetHeight;
      const currentStats = statsRef.current;
      const currentTheme = themeRef.current;

      // Extract cognitive parameters
      const confidence = currentStats.confidence / 100;     // 0..1 (order vs chaos)
      const followThrough = currentStats.followThrough / 100; // 0..1 (center gravity)
      const clarity = currentStats.clarity / 100;           // 0..1 (harmonic octaves)
      const growthVelocity = currentStats.growthVelocity / 100; // 0..1 (drift speed)
      const emotionalAgility = currentStats.emotionalAgility / 100;

      // Kinetic speed scaling
      const speedFactor = 0.7 + growthVelocity * 1.5;
      time += 0.003 * speedFactor;

      // Fading trail effect for organic ribbon curves
      // Lower opacity = longer, smoother luminous trails
      ctx.fillStyle = 'rgba(10, 7, 5, 0.12)';
      ctx.fillRect(0, 0, displayW, displayH);

      const centerX = displayW * 0.5;
      const centerY = displayH * 0.5;

      // Scale for vector noise field: high clarity = larger, sweeping harmonic fields
      const noiseScale = 0.0022 - clarity * 0.0009;

      // Render & update particles
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;
        p.prevX = p.x;
        p.prevY = p.y;

        // 1. Calculate Vector Field Angle from Perlin Noise
        const nx = p.x * noiseScale;
        const ny = p.y * noiseScale;
        const n1 = noise2D(nx, ny + time);
        const n2 = noise2D(nx + 10.5, ny + time * 0.8);

        // Angle blending: Confidence creates parallel coherent bands; low confidence creates turbulence
        const baseAngle = n1 * Math.PI * 4;
        const turbulentAngle = n2 * Math.PI * 6;
        const angle = baseAngle * (0.4 + confidence * 0.6) + turbulentAngle * (1 - confidence) * 0.4;

        // Base field velocity
        let targetVx = Math.cos(angle) * p.speed * speedFactor;
        let targetVy = Math.sin(angle) * p.speed * speedFactor;

        // 2. Follow-Through Gravitational Attractor
        // Pulls wandering particles inward into structured orbital bands
        if (followThrough > 0.4) {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const orbitRadius = Math.min(displayW, displayH) * 0.28;
          const distDelta = dist - orbitRadius;

          // Gentle orbital swirl + radial stabilization
          const pullForce = (distDelta / 600) * (followThrough * 0.85);
          targetVx += (dx / (dist + 1)) * pullForce;
          targetVy += (dy / (dist + 1)) * pullForce;

          // Tangential orbital spin
          const tangentX = -dy / (dist + 1);
          const tangentY = dx / (dist + 1);
          targetVx += tangentX * (followThrough * 0.9);
          targetVy += tangentY * (followThrough * 0.9);
        }

        // 3. Emotional Agility Harmonic Pulse
        // Creates undulating wave bands along the Y axis
        if (emotionalAgility > 0.3) {
          const wave = Math.sin(p.x * 0.01 + time * 3) * (emotionalAgility * 1.2);
          targetVy += wave;
        }

        // 4. Interactive Mouse Influence
        if (interactive && mouseRef.current.active) {
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const mDistSq = mdx * mdx + mdy * mdy;
          const maxDist = 140;

          if (mDistSq < maxDist * maxDist && mDistSq > 1) {
            const mDist = Math.sqrt(mDistSq);
            const repel = (1 - mDist / maxDist) * 3.5;
            targetVx += (mdx / mDist) * repel;
            targetVy += (mdy / mDist) * repel;
          }
        }

        // Smooth velocity interpolation (inertia)
        p.vx += (targetVx - p.vx) * 0.08;
        p.vy += (targetVy - p.vy) * 0.08;

        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;

        // 5. Draw Particle Ribbon Path
        const lifeFraction = p.life / p.maxLife;
        const currentAlpha = Math.sin(lifeFraction * Math.PI) * p.alpha;

        ctx.strokeStyle = `rgba(${p.colorR}, ${p.colorG}, ${p.colorB}, ${currentAlpha})`;
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // 6. Reset particles that wander offscreen or expire
        if (
          p.life <= 0 ||
          p.x < -20 ||
          p.x > displayW + 20 ||
          p.y < -20 ||
          p.y > displayH + 20
        ) {
          // Re-spawn near center or along edge depending on followThrough
          const col = getPaletteColor(currentTheme, Math.random());
          p.colorR = col.r;
          p.colorG = col.g;
          p.colorB = col.b;
          p.life = Math.random() * 80 + 50;
          p.maxLife = p.life;

          if (Math.random() < followThrough * 0.7) {
            // Re-spawn in central resonance core
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnR = Math.random() * (Math.min(displayW, displayH) * 0.35);
            p.x = centerX + Math.cos(spawnAngle) * spawnR;
            p.y = centerY + Math.sin(spawnAngle) * spawnR;
          } else {
            p.x = Math.random() * displayW;
            p.y = Math.random() * displayH;
          }
          p.prevX = p.x;
          p.prevY = p.y;
          p.vx = 0;
          p.vy = 0;
        }
      }

      // Center Core Ambient Glow
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        Math.min(displayW, displayH) * 0.4
      );
      if (currentTheme === 'gold') {
        glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.06)');
        glowGrad.addColorStop(1, 'rgba(10, 7, 5, 0)');
      } else if (currentTheme === 'neural') {
        glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
        glowGrad.addColorStop(1, 'rgba(10, 7, 5, 0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.06)');
        glowGrad.addColorStop(1, 'rgba(10, 7, 5, 0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, displayW, displayH);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Mouse & Touch listeners for dynamic canvas interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
          active: true,
        };
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onCanvasReady]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#0a0705] ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};

export default CognitiveSpectrumCanvas;
