"use client"
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, PenLine } from 'lucide-react';
import { InfinitySymbol } from './InfinitySymbol';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Confetti = () => {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: '50%',
          }}
          initial={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            y: [0, -100 - Math.random() * 100, -200],
            x: [0, (Math.random() - 0.5) * 200],
            scale: [1, 1.5, 0.5],
            rotate: [0, Math.random() * 720],
          }}
          transition={{
            duration: 2,
            delay: Math.random() * 0.5,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

export const CelebrationModal = ({ isOpen, onClose }: CelebrationModalProps) => {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setShowNote(false);
      setNote('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-md z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="fixed inset-x-4 top-[15%] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="card-elevated p-8 text-center relative overflow-hidden">
              <Confetti />
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary transition-colors z-10"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Content */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mb-6 flex justify-center"
              >
                <div className="p-4 rounded-full bg-celebration/10">
                  <InfinitySymbol isActive size={100} />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-display text-foreground mb-2">
                  Balance achieved ✨
                </h2>
                <p className="text-muted-foreground mb-6">
                  You showed up for both worlds. That takes intention.
                </p>
              </motion.div>

              <AnimatePresence mode="wait">
                {!showNote ? (
                  <motion.div
                    key="prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <p className="text-sm text-muted-foreground mb-4">
                      Want to celebrate with a note to yourself?
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={onClose} className="btn-force-secondary">
                        Close
                      </button>
                      <button 
                        onClick={() => setShowNote(true)} 
                        className="btn-force-primary"
                      >
                        <PenLine className="w-4 h-4" />
                        Write a note
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="note"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="I'm proud of myself for..."
                      className="input-force resize-none h-24 mb-4"
                      autoFocus
                    />
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => setShowNote(false)} className="btn-force-secondary">
                        Back
                      </button>
                      <button 
                        onClick={onClose} 
                        className="btn-force-primary"
                      >
                        <Zap className="w-4 h-4" />
                        Save & Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
