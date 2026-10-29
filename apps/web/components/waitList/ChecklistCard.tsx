import { motion } from 'framer-motion';
import { Calendar, CalendarDays, CalendarRange, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checklist, Period } from '@/types/checklist';

interface ChecklistCardProps {
  checklist: Checklist;
  onClick: () => void;
  index: number;
}

const periodConfig: Record<Period, { icon: typeof Calendar; label: string }> = {
  daily: { icon: Calendar, label: 'Daily' },
  weekly: { icon: CalendarDays, label: 'Weekly' },
  monthly: { icon: CalendarRange, label: 'Monthly' },
};

export const ChecklistCard = ({ checklist, onClick, index }: ChecklistCardProps) => {
  const workItems = checklist.items.filter(i => i.lane === 'work');
  const personalItems = checklist.items.filter(i => i.lane === 'personal');
  
  const workProgress = workItems.length > 0 
    ? (workItems.filter(i => i.completed).length / workItems.length) * 100 
    : 0;
  const personalProgress = personalItems.length > 0 
    ? (personalItems.filter(i => i.completed).length / personalItems.length) * 100 
    : 0;

  const PeriodIcon = periodConfig[checklist.period].icon;
  const isBalanced = workProgress >= 85 && personalProgress >= 85;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="w-full card-elevated p-5 text-left hover:shadow-force-lg transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-display text-foreground group-hover:text-primary transition-colors">
            {checklist.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <PeriodIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{periodConfig[checklist.period].label}</span>
            {checklist.sharedWith.length > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{checklist.sharedWith.length}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-work">Work</span>
            <span className="text-xs text-muted-foreground">
              {workItems.filter(i => i.completed).length}/{workItems.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-work-soft overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-work"
              initial={{ width: 0 }}
              animate={{ width: `${workProgress}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-personal">Personal</span>
            <span className="text-xs text-muted-foreground">
              {personalItems.filter(i => i.completed).length}/{personalItems.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-personal-soft overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-personal"
              initial={{ width: 0 }}
              animate={{ width: `${personalProgress}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Balance indicator */}
      {isBalanced && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 flex items-center justify-center gap-2 py-2 rounded-lg bg-celebration/10 text-celebration"
        >
          <span className="text-sm font-medium">Balanced ✨</span>
        </motion.div>
      )}
    </motion.button>
  );
};
