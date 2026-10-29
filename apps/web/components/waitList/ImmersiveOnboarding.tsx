"use client"
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Zap, Eye, Leaf, Scale, Check, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
interface ImmersiveOnboardingProps {
  isOpen: boolean;
  onComplete: (data: OnboardingData) => void;
  initialEmail?: string;
  step: number;
  onStepChange: (step: number) => void;
  totalSteps?: number;
}

interface OnboardingData {
  energy: string;
  commitment: boolean;
  reflection: string;
  email: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: { x: number; y: number };
  opacity: number;
}

// Interactive particle system
const InteractiveBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number | null>(null);
if (typeof window !== "undefined") {
  const css = `
    @font-face {
      font-family: 'Hydrogen Whiskey';
      src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
      font-display: swap;
    }
    @font-face {
        font-family: 'Terminal Grotesque';
        src: url('/fonts/terminal-grotesque.ttf') format('opentype');
        font-display: swap;
    }
    .font-hydrogen-whiskey { font-family: 'Hydrogen Whiskey', serif !important; }
    .font-terminal-grotesque { font-family: 'Terminal Grotesque', sans-serif !important; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-generated", "fonts-custom");
  style.appendChild(document.createTextNode(css));
  if (!document.querySelector('[data-generated="fonts-custom"]')) {
      document.head.appendChild(style);
  }
}

  const colors = [
    'rgba(255, 200, 210, 0.5)', // soft pink
    'rgba(255, 220, 225, 0.4)', // lighter pink
    'rgba(245, 190, 200, 0.5)', // blush
    'rgba(255, 210, 220, 0.4)', // rose
    'rgba(240, 200, 210, 0.5)', // dusty rose
  ];

  const initParticles = useCallback((width: number, height: number) => {
    const newParticles: Particle[] = [];
    const count = Math.min(80, Math.floor((width * height) / 15000));
    
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 100 + 50,
        //@ts-ignore
        color: colors[Math.floor(Math.random() * colors.length)],
        velocity: { 
          x: (Math.random() - 0.5) * 0.5, 
          y: (Math.random() - 0.5) * 0.5 
        },
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
    particles.current = newParticles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches?.[0];
      if (touch) {
        mousePos.current = { x: touch.clientX, y: touch.clientY }; 
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((particle) => {
        // Mouse interaction - particles are attracted/repelled by cursor
        const dx = mousePos.current.x - particle.x;
        const dy = mousePos.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 300;

        if (distance < maxDistance) {
          const force = (maxDistance - distance) / maxDistance;
          particle.velocity.x += (dx / distance) * force * 0.02;
          particle.velocity.y += (dy / distance) * force * 0.02;
        }

        // Apply velocity with damping
        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;
        particle.velocity.x *= 0.98;
        particle.velocity.y *= 0.98;

        // Add slight drift
        particle.velocity.x += (Math.random() - 0.5) * 0.1;
        particle.velocity.y += (Math.random() - 0.5) * 0.1;

        // Wrap around edges
        if (particle.x < -particle.size) particle.x = canvas.width + particle.size;
        if (particle.x > canvas.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = canvas.height + particle.size;
        if (particle.y > canvas.height + particle.size) particle.y = -particle.size;

        // Draw particle as soft gradient blob
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ filter: 'blur(40px)' }}
    />
  );
};

// Floating interactive orbs that follow mouse with spring physics
const MouseFollowOrb = ({ 
  offsetX = 0, 
  offsetY = 0, 
  size = 200, 
  color = 'harmony',
  delay = 0
}: { 
  offsetX?: number; 
  offsetY?: number; 
  size?: number; 
  color?: string;
  delay?: number;
}) => {
  const mouseX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const mouseY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

  const springConfig = { damping: 25, stiffness: 50, mass: 1 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const transformedX = useTransform(x, (val) => val + offsetX - size / 2);
  const transformedY = useTransform(y, (val) => val + offsetY - size / 2);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 1 }}
      className={cn(
        "absolute rounded-full blur-3xl pointer-events-none",
        color === 'harmony' && "bg-harmony/30",
        color === 'clarity' && "bg-clarity/30",
        color === 'growth' && "bg-growth/30",
        color === 'warm' && "bg-personal/25",
        color === 'purple' && "bg-purple-500/20",
      )}
      style={{ 
        x: transformedX, 
        y: transformedY,
        width: size, 
        height: size 
      }}
    />
  );
};

// Animated flowing lines
const FlowingLines = () => {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
      {[...Array(5)].map((_, i) => (
        <motion.path
          key={i}
          d={`M 0,${30 + i * 15} Q ${25 + i * 5},${20 + i * 10} 50,${35 + i * 12} T 100,${25 + i * 15}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          className="text-foreground"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: [0, 1, 1, 0],
            opacity: [0, 0.5, 0.5, 0]
          }}
          transition={{ 
            duration: 8 + i * 2,
            delay: i * 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ 
            pathOffset: i * 0.1,
          }}
        />
      ))}
    </svg>
  );
};

// Single fixed prompt for the reflection step
const reflectionPrompt = "We believe every human has a unique strength or way of seeing the world. What is a quality in you that you want to understand or grow in the coming year?";

export const ImmersiveOnboarding = ({
  isOpen,
  onComplete,
  initialEmail = '',
  step,
  onStepChange,
  totalSteps = 6,
}: ImmersiveOnboardingProps) => {
  const [selectedEnergy, setSelectedEnergy] = useState('');
  const [commitment, setCommitment] = useState(false);
  const [reflection, setReflection] = useState('');
  const [email, setEmail] = useState(initialEmail);

  // Update email if initialEmail prop changes
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      localStorage.setItem('force_reflection_prompt', reflectionPrompt);
    }
  }, [isOpen]);

  const handleComplete = () => {
    onComplete({
      energy: selectedEnergy,
      commitment,
      reflection,
      email,
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(340 30% 95%) 0%, hsl(340 35% 90%) 40%, hsl(340 30% 85%) 70%, hsl(340 25% 80%) 100%)',
      }}
    >
      {/* Interactive particle canvas background */}
      <InteractiveBackground />

      {/* Mouse-following orbs */}
      <MouseFollowOrb offsetX={-150} offsetY={-100} size={350} color="warm" delay={0.2} />
      <MouseFollowOrb offsetX={200} offsetY={100} size={280} color="harmony" delay={0.5} />
      <MouseFollowOrb offsetX={-50} offsetY={200} size={200} color="clarity" delay={0.8} />
      <MouseFollowOrb offsetX={100} offsetY={-150} size={250} color="purple" delay={1.1} />

      {/* Flowing animated lines */}
      <FlowingLines />

      {/* Content container */}
      <div className="relative h-full flex flex-col items-center justify-start md:justify-center px-4 sm:px-6 py-20 md:py-8 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          {/* Screen 1: Entry Ritual */}
          {step === 1 && (
            <motion.div
              key="entry"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-2xl"
            >
              {/* Abstract shape */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-20 h-20 mx-auto mb-20 flex justify-center-safe items-center"
              >
                {/* logo */}
                  <svg 
                    width="206" 
                    height="156" 
                    viewBox="0 0 206 156" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="relative z-10 w-45 h-35 opacity-90 hover:opacity-100 transition-all duration-700 hover:scale-110 animate-float-gentle mx-auto"
                  >
                    <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z" fill="black" stroke="black" strokeWidth="11.6841"/>
                    <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z" fill="black" stroke="black" strokeWidth="11.6841"/>
                    <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" fill="black" stroke="black" strokeWidth="11.6841"/>
                    <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" fill="black" stroke="black" strokeWidth="11.6841"/>
                  </svg>
                
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-terminal-grotesque font-medium text-foreground mb-4 sm:mb-6 leading-tight"
              >
                This is not another
                <br />
                productivity tool.
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-base sm:text-lg md:text-xl text-foreground/70 mb-4 sm:mb-6 font-light max-w-lg mx-auto font-terminal-grotesque"
              >
                Force is a space for people who want to understand their inner world and move through life with more clarity and intention.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="text-base sm:text-lg text-foreground/50 mb-8 sm:mb-12 md:mb-16 font-light font-terminal-grotesque"
              >
                We are currently in private beta. If this resonates, you are welcome to step inside.
              </motion.p>
{/* 

*/}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                onClick={() => onStepChange(Math.min(2, totalSteps))}
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card/90 backdrop-blur-sm text-foreground font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 font-terminal-grotesque"
              >
                Begin
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </motion.button>
            </motion.div>
          )}

          {/* Screen 2: Energy Selection */}
          {step === 2 && (
            <motion.div
              key="energy"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-4xl w-full"
            >
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-3xl md:text-4xl font-terminal-grotesque text-foreground mb-3 sm:mb-4"
              >
                What feels most present for you right now?
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-foreground/60 mb-6 sm:mb-8 md:mb-12 text-base sm:text-lg font-terminal-grotesque font-light"
              >
                There is no right answer. Just choose what feels closest.
              </motion.p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-12">
                {[
                  { value: 'clarity', label: 'Seeking clarity', icon: Eye, description: 'I want to understand my thoughts, patterns, and emotions better.' },
                  { value: 'growth', label: 'Ready for growth', icon: Leaf, description: 'I am ready to become a better version of myself.' },
                  { value: 'stability', label: 'Craving stability', icon: Scale, description: 'I want more grounding and balance in my inner world.' },
                ].map((energy, index) => {
                  const Icon = energy.icon;
                  const isSelected = selectedEnergy === energy.value;
                  
                  return (
                    <motion.button
                      key={energy.value}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.15 }}
                      onClick={() => setSelectedEnergy(energy.value)}
                      className={cn(
                        "group relative p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border-2 transition-all duration-500 text-left overflow-hidden",
                        isSelected 
                          ? "border-card bg-card/80 backdrop-blur-sm shadow-2xl scale-[1.02]"
                          : "border-card/30 bg-card/20 backdrop-blur-sm hover:border-card/60 hover:bg-card/40"
                      )}
                    >
                      {/* Glow effect when selected */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-linear-to-br from-card/50 to-transparent"
                        />
                      )}
                      
                      <div className="relative z-10">
                        <div className={cn(
                          "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 transition-all duration-500",
                          isSelected ? "bg-foreground/10" : "bg-foreground/5"
                        )}>
                          <Icon className={cn(
                            "w-7 h-7 transition-all duration-500",
                            isSelected ? "text-foreground" : "text-foreground/60"
                          )} />
                        </div>
                        
                        <h3 className={cn(
                          "text-xl sm:text-2xl font-terminal-grotesque mb-2 transition-colors duration-500",
                          isSelected ? "text-foreground" : "text-foreground/80"
                        )}>
                          {energy.label}
                        </h3>
                        
                        <p className={cn(
                          "text-sm transition-colors duration-500 font-terminal-grotesque",
                          isSelected ? "text-foreground/70" : "text-foreground/50"
                        )}>
                          {energy.description}
                        </p>
                      </div>

                      {/* Check mark */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-foreground flex items-center justify-center"
                          >
                            <Check className="w-5 h-5 text-card" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: selectedEnergy ? 1 : 0.3 }}
                onClick={() => selectedEnergy && onStepChange(Math.min(3, totalSteps))}
                disabled={!selectedEnergy}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card/90 backdrop-blur-sm text-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed font-terminal-grotesque"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}

          {/* Screen 3: Micro-Commitment */}
          {step === 3 && (
            <motion.div
              key="commitment"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 mx-auto mb-10 rounded-full bg-card/30 backdrop-blur-sm flex items-center justify-center"
              >
                <img src="Logo.png" alt="" width={80} height={80} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl sm:text-3xl md:text-4xl font-terminal-grotesque text-foreground mb-3 sm:mb-4"
              >
                A gentle intention
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-foreground/60 mb-6 sm:mb-8 md:mb-12 text-base sm:text-lg font-terminal-grotesque"
              >
                Not to us. To yourself.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={() => setCommitment(!commitment)}
                className={cn(
                  "group w-full p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-500 text-left",
                  commitment 
                    ? "border-card bg-card/80 backdrop-blur-sm"
                    : "border-card/30 bg-card/20 backdrop-blur-sm hover:border-card/60"
                )}
              >
                <div className="flex items-center gap-5">
                  <motion.div
                    animate={{ 
                      scale: commitment ? 1 : 0.9,
                      backgroundColor: commitment ? 'hsl(var(--foreground))' : 'transparent',
                    }}
                    className={cn(
                      "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                      commitment ? "border-foreground" : "border-foreground/30"
                    )}
                  >
                    <AnimatePresence>
                      {commitment && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check className="w-4 h-4 text-card" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  <div>
                    <p className="text-base sm:text-lg text-foreground font-medium font-terminal-grotesque">
                      I am open to slowing down and paying attention to my inner world.
                    </p>
                  </div>
                </div>
              </motion.button>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex gap-3 sm:gap-4 justify-center mt-6 sm:mt-8 md:mt-12"
              >
                <button
                  onClick={() => onStepChange(2)}
                  className="px-6 py-3 rounded-full text-foreground/60 hover:text-foreground transition-colors font-terminal-grotesque"
                >
                  Back
                </button>
                <button
                  onClick={() => onStepChange(Math.min(4, totalSteps))}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card/90 backdrop-blur-sm text-foreground font-medium shadow-lg transition-all duration-500 font-terminal-grotesque",
                    commitment ? "hover:shadow-xl hover:scale-105" : "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!commitment}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Screen 4: Reflective Moment */}
          {step === 4 && (
            <motion.div
              key="reflection"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-xl w-full"
            >
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-3xl md:text-4xl font-terminal-grotesque text-foreground mb-3 sm:mb-4"
              >
                A moment for your future self
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-foreground/60 mb-6 sm:mb-8 md:mb-10 text-base sm:text-lg leading-relaxed font-terminal-grotesque"
              >
                {reflectionPrompt}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="Write freely. No one else will see this."
                  rows={4}
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-card/30 backdrop-blur-sm border-2 border-card/40 text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-card/80 transition-all duration-300 resize-none text-base sm:text-lg font-terminal-grotesque"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex gap-3 sm:gap-4 justify-center mt-6 sm:mt-8 md:mt-10"
              >
                <button
                  onClick={() => onStepChange(3)}
                  className="px-6 py-3 rounded-full text-foreground/60 hover:text-foreground transition-colors font-terminal-grotesque"
                >
                  Back
                </button>
                <button
                  onClick={() => reflection.trim() && onStepChange(Math.min(5, totalSteps))}
                  disabled={!reflection.trim()}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card/90 backdrop-blur-sm text-foreground font-medium shadow-lg transition-all duration-500 font-terminal-grotesque",
                    reflection.trim() ? "hover:shadow-xl hover:scale-105" : "opacity-50 cursor-not-allowed"
                  )}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Screen 5: Invitation Key (Email) */}
          {step === 5 && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-md w-full"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 mx-auto mb-10 rounded-full bg-card/30 backdrop-blur-sm flex items-center justify-center"
              >
                <Mail className="w-10 h-10 text-foreground/80" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl sm:text-3xl md:text-4xl font-terminal-grotesque text-foreground mb-3"
              >
                You are in the right place.
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-foreground/60 mb-3 sm:mb-4 text-base sm:text-lg font-terminal-grotesque"
              >
                Enter your email to join the Force Early Access waitlist.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-foreground/50 mb-6 sm:mb-8 md:mb-10 text-sm sm:text-base font-terminal-grotesque"
              >
                We invite members on a rolling basis, with care.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mb-6"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-card/30 backdrop-blur-sm border-2 border-card/40 text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-card/80 transition-all duration-300 text-base sm:text-lg text-center font-terminal-grotesque"
                />
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-foreground/40 text-xs sm:text-sm mb-6 sm:mb-8 md:mb-10 font-terminal-grotesque"
              >
                No spam. Just a quiet note when your space is ready.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex gap-4 justify-center"
              >
                <button
                  onClick={() => onStepChange(4)}
                  className="px-6 py-3 rounded-full text-foreground/60 hover:text-foreground transition-colors font-terminal-grotesque"
                >
                  Back
                </button>
                <button
                  onClick={() => email && onStepChange(Math.min(6, totalSteps))}
                  disabled={!email || !email.includes('@')}
                  className={cn(
                    "inline-flex items-center gap-3 px-8 py-4 rounded-full bg-card backdrop-blur-sm text-foreground font-medium shadow-lg transition-all duration-500 font-terminal-grotesque",
                    email && email.includes('@') 
                      ? "hover:shadow-xl hover:scale-105" 
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  Join Early Access
                  <Zap className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Screen 6: Confirmation */}
          {step === 6 && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-center max-w-lg"
            >
              {/* Animated particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      opacity: 0,
                      x: '50%',
                      y: '50%',
                    }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      x: `${50 + (Math.random() - 0.5) * 100}%`,
                      y: `${50 + (Math.random() - 0.5) * 100}%`,
                    }}
                    transition={{ 
                      duration: 3,
                      delay: i * 0.1,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                    className="absolute w-1 h-1 rounded-full bg-card/60"
                  />
                ))}
              </div>

              {/* Breathing dot */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ 
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  default: { delay: 0.2, duration: 0.5 }
                }}
                className="w-4 h-4 mx-auto mb-12 rounded-full bg-card/80"
              />

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl sm:text-4xl md:text-5xl font-terminal-grotesque text-card mb-4 sm:mb-6"
              >
                Your key is on its way.
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-lg sm:text-xl text-card/80 mb-8 sm:mb-12 md:mb-16 leading-relaxed font-terminal-grotesque"
              >
                You're one step closer to building
                <br />
                the life you're meant to live.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={handleComplete}
                className="inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-full bg-card text-foreground font-medium text-base sm:text-lg shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 font-terminal-grotesque"
              >
                Enter Force
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};