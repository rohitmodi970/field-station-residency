import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  variant: 'work' | 'personal' | 'balance';
  label?: string;
  showPercentage?: boolean;
}

export const ProgressRing = ({
  progress,
  size = 100,
  strokeWidth = 8,
  variant,
  label,
  showPercentage = true,
}: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const colorClasses = {
    work: 'stroke-work',
    personal: 'stroke-personal',
    balance: 'stroke-balance',
  };

  const bgClasses = {
    work: 'stroke-work-soft',
    personal: 'stroke-personal-soft',
    balance: 'stroke-balance-soft',
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn(bgClasses[variant], 'opacity-40')}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClasses[variant]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <motion.span
            className="text-2xl font-semibold text-foreground font-body"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {Math.round(progress)}%
          </motion.span>
        )}
        {label && (
          <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
};
