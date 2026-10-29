import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface Question6Props {
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question6: React.FC<Question6Props> = ({
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  // Initialize state from localStorage if available
  const [scaleValue, setScaleValue] = useState<string>(() => {
    const saved = localStorage.getItem('question6Scale');
    return saved || "";
  });
  
  const [textResponse, setTextResponse] = useState<string>(() => {
    const saved = localStorage.getItem('question6Text');
    return saved || "";
  });
  
  const [error, setError] = useState<boolean>(false);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('question6Scale', scaleValue);
  }, [scaleValue]);

  useEffect(() => {
    localStorage.setItem('question6Text', textResponse);
  }, [textResponse]);

  // Animation variants for motion effects
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 } 
    }
  };

  const handleScaleChange = (value: string) => {
    setScaleValue(value);
    handleInputChange(question + " (scale)", value);
    setError(false);
  };

  const handleTextChange = (value: string) => {
    setTextResponse(value);
    handleInputChange(question, value);
    setError(false);
  };

  const handleContinue = () => {
    if (!textResponse.trim()) {
      setError(true);
      return;
    }
    goToNextSection();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center py-16 relative"
    >
      <div className="max-w-lg w-full p-10 rounded-3xl shadow-xl relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5">
        <div className="relative z-10">
          <div className="absolute top-5 right-5 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 leading-tight">{question}</h2>
          <motion.p 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-gray-600 mb-8"
          >
            Mind-body connection is a powerful aspect of self-awareness that brings your creative energy out !
          </motion.p>

          <motion.div 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            <div className="relative">
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={scaleValue}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleScaleChange(e.target.value)}
              />

              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>Morning</span>
                <span>Afternoon</span>
                <span>Evening</span>
                <span>Night</span>
              </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-xl mt-6">
              <textarea
                rows={4}
                placeholder="Describe your experience in more detail... (required)"
                className={`w-full bg-white rounded-lg border ${error ? 'border-red-500 ring-2 ring-red-300' : 'border-gray-200'} p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleTextChange(e.target.value)}
                value={textResponse}
              ></textarea>
              {error && (
                <p className="text-red-500 text-sm mt-2">Please share your experience before continuing</p>
              )}
            </div>
          </motion.div>

          <div className="flex justify-between mt-8">
            <button 
              onClick={goToPrevSection} 
              className="px-5 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <button 
              onClick={handleContinue} 
              className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition shadow-md flex items-center gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Question6;
