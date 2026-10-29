"use client"
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MoreHorizontal, Link2, Users, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChecklistItem as ItemType } from '@/types/checklist';

interface ChecklistItemProps {
  item: ItemType;
  onToggle: (id: string) => void;
  onEdit?: (item: ItemType) => void;
  index: number;
}

export const ChecklistItemRow = ({ item, onToggle, onEdit, index }: ChecklistItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        'group relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
        item.lane === 'work' 
          ? 'bg-work-soft/50 border-work/10 hover:border-work/30' 
          : 'bg-personal-soft/50 border-personal/10 hover:border-personal/30',
        item.completed && 'opacity-60'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id)}
        className={cn(
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200',
          item.completed 
            ? item.lane === 'work' ? 'bg-work border-work' : 'bg-personal border-personal'
            : item.lane === 'work' ? 'border-work/40 hover:border-work' : 'border-personal/40 hover:border-personal'
        )}
      >
        <AnimatePresence>
          {item.completed && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Check className={cn(
                'w-4 h-4',
                item.lane === 'work' ? 'text-work-foreground' : 'text-personal-foreground'
              )} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium text-foreground transition-all duration-200',
          item.completed && 'line-through text-muted-foreground'
        )}>
          {item.title}
        </p>
        
        {/* Meta info */}
        <div className="flex items-center gap-3 mt-1">
          {item.timeEstimate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {item.timeEstimate}m
            </span>
          )}
          {item.linkedNodes.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="w-3 h-3" />
              {item.linkedNodes.length} linked
            </span>
          )}
          {item.sharedWith.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              {item.sharedWith.length}
            </span>
          )}
        </div>
      </div>

      {/* Chakra indicators */}
      {item.linkedNodes.length > 0 && (
        <div className="flex -space-x-1">
          {item.linkedNodes.slice(0, 3).map((node) => (
            <div
              key={node.id}
              className="w-3 h-3 rounded-full border-2 border-card"
              style={{ backgroundColor: node.color || 'hsl(var(--primary))' }}
              title={node.name}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="flex items-center gap-1"
      >
        <button 
          onClick={() => onEdit?.(item)}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.div>
    </motion.div>
  );
};
