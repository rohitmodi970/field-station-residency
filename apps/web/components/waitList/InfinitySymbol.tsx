import { motion } from 'framer-motion';

interface InfinitySymbolProps {
  isActive?: boolean;
  size?: number;
}

export const InfinitySymbol = ({ isActive = false, size = 64 }: InfinitySymbolProps) => {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0, opacity: 0 }}
      animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0.3 }}
      transition={{ 
        type: 'spring', 
        stiffness: 200, 
        damping: 15,
        delay: isActive ? 0.2 : 0 
      }}
    >
      <svg
        width={size}
        height={size * 0.5}
        viewBox="0 0 100 50"
        className={isActive ? 'animate-infinity-pulse' : ''}
      >
        <defs>
          <linearGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(210 50% 50%)" />
            <stop offset="50%" stopColor="hsl(160 45% 45%)" />
            <stop offset="100%" stopColor="hsl(15 70% 55%)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <motion.path
          d="M25,25 C25,10 40,10 50,25 C60,40 75,40 75,25 C75,10 60,10 50,25 C40,40 25,40 25,25"
          fill="none"
          stroke="url(#infinityGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          filter={isActive ? "url(#glow)" : ""}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      </svg>
      {isActive && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        >
          <div className="w-2 h-2 rounded-full bg-celebration" />
        </motion.div>
      )}
    </motion.div>
  );
};
