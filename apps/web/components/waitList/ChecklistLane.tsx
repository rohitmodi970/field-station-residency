"use client"
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Briefcase, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChecklistItem, Lane } from '@/types/checklist';
import { ChecklistItemRow } from './ChecklistItem';

interface ChecklistLaneProps {
  lane: Lane;
  items: ChecklistItem[];
  onToggleItem: (id: string) => void;
  onAddItem: (lane: Lane, title: string) => void;
  onEditItem?: (item: ChecklistItem) => void;
}

export const ChecklistLane = ({ 
  lane, 
  items, 
  onToggleItem, 
  onAddItem,
  onEditItem 
}: ChecklistLaneProps) => {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const laneConfig = {
    work: {
      title: 'Work',
      icon: Briefcase,
      emptyText: "No work tasks yet—try adding your most important deliverable",
      placeholder: "Add a work task...",
      colorClass: 'text-work',
      bgClass: 'bg-work-soft',
      borderClass: 'border-work/20',
    },
    personal: {
      title: 'Personal',
      icon: Heart,
      emptyText: "No personal tasks—what would bring you joy today?",
      placeholder: "Add a personal task...",
      colorClass: 'text-personal',
      bgClass: 'bg-personal-soft',
      borderClass: 'border-personal/20',
    },
  };

  const config = laneConfig[lane];
  const Icon = config.icon;

  const handleAddItem = () => {
    if (newItemTitle.trim()) {
      onAddItem(lane, newItemTitle.trim());
      setNewItemTitle('');
      setIsAdding(false);
    }
  };

  const completedCount = items.filter(i => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex-1 rounded-2xl p-5 border',
        config.bgClass,
        config.borderClass
      )}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg bg-card/80', config.colorClass)}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className={cn('font-semibold', config.colorClass)}>{config.title}</h3>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{items.length} complete
            </p>
          </div>
        </div>

        {/* Mini progress */}
        <div className="w-12 h-1.5 rounded-full bg-card/60 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', lane === 'work' ? 'bg-work' : 'bg-personal')}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onToggle={onToggleItem}
              onEdit={onEditItem}
              index={index}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && !isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-muted-foreground text-sm"
          >
            {config.emptyText}
          </motion.div>
        )}
      </div>

      {/* Add Item */}
      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder={config.placeholder}
              className="input-force flex-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewItemTitle('');
                }
              }}
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemTitle.trim()}
              className={cn(
                'px-4 py-2 rounded-xl font-medium text-sm transition-all',
                newItemTitle.trim() 
                  ? 'btn-force-primary' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Add
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAdding(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all',
              'hover:bg-card/50 text-muted-foreground hover:text-foreground',
              lane === 'work' ? 'border-work/20 hover:border-work/40' : 'border-personal/20 hover:border-personal/40'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add a task you'll show up for</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
