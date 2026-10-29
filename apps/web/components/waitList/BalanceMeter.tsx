import { motion, AnimatePresence } from 'framer-motion';
import { ProgressRing } from './ProgressRing';
import { InfinitySymbol } from './InfinitySymbol';
import { BalanceStats } from '@/types/checklist';
import { Zap } from 'lucide-react';

interface BalanceMeterProps {
  stats: BalanceStats;
  onCelebrate?: () => void;
}

export const BalanceMeter = ({ stats, onCelebrate }: BalanceMeterProps) => {
  const { workProgress, personalProgress, isBalanced, balanceThreshold } = stats;

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-display text-foreground">Balance Meter</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isBalanced 
              ? "You showed up for both worlds" 
              : `Reach ${balanceThreshold}% in both lanes`}
          </p>
        </div>
        <AnimatePresence>
          {isBalanced && (
            <motion.button
              onClick={onCelebrate}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full bg-celebration/20 text-celebration"
            >
              <Zap className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-around gap-4">
        <div className="text-center">
          <ProgressRing progress={workProgress} variant="work" size={80} />
          <p className="text-sm font-medium text-work mt-2">Work</p>
        </div>

        <div className="flex flex-col items-center">
          <InfinitySymbol isActive={isBalanced} size={80} />
          <AnimatePresence>
            {isBalanced && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs font-medium text-balance mt-2"
              >
                Balanced ✨
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center">
          <ProgressRing progress={personalProgress} variant="personal" size={80} />
          <p className="text-sm font-medium text-personal mt-2">Personal</p>
        </div>
      </div>

      {/* Balance Tips */}
      <AnimatePresence>
        {!isBalanced && Math.abs(workProgress - personalProgress) > 30 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border/50"
          >
            <p className="text-sm text-muted-foreground">
              {workProgress > personalProgress 
                ? "💡 Consider adding a personal task to restore balance"
                : "💡 A work task could help you feel more accomplished"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
