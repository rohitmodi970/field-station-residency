// components/ProgressIndicator.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  currentSection: number;
  totalSections: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  currentSection, 
  totalSections 
}) => {
  return (
    <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
      <div className="px-4 py-2 bg-black/30 backdrop-blur-md rounded-full">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSections }).map((_, index) => (
            <motion.div
              key={index}
              className={`h-2 w-2 rounded-full ${
                index < currentSection 
                  ? 'bg-indigo-500' 
                  : index === currentSection 
                    ? 'bg-white' 
                    : 'bg-white/30'
              }`}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ 
                scale: index === currentSection - 1 ? 1.2 : 1,
                opacity: index <= currentSection - 1 ? 1 : 0.5 
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;