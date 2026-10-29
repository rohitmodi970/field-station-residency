import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Brain } from 'lucide-react';

interface Question5Props {
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question5: React.FC<Question5Props> = ({
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  // Initialize state from localStorage if available
  const [selectedPattern, setSelectedPattern] = useState<string | null>(() => {
    const saved = localStorage.getItem('question5Pattern');
    return saved || null;
  });
  
  const [otherPattern, setOtherPattern] = useState<string>(() => {
    const saved = localStorage.getItem('question5OtherPattern');
    return saved || '';
  });
  
  const [error, setError] = useState<boolean>(false);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (selectedPattern) {
      localStorage.setItem('question5Pattern', selectedPattern);
      
      // Update parent component state
      if (selectedPattern === 'Other' && otherPattern) {
        handleInputChange(question, "Other: " + otherPattern);
      } else if (selectedPattern !== 'Other') {
        handleInputChange(question, selectedPattern);
      }
    }
  }, [selectedPattern, otherPattern, question, handleInputChange]);

  // Save other pattern to localStorage
  useEffect(() => {
    localStorage.setItem('question5OtherPattern', otherPattern);
  }, [otherPattern]);

  const handlePatternSelect = (pattern: string) => {
    setSelectedPattern(pattern);
    handleInputChange(question, pattern);
    setError(false);
  };

  const handleOtherPatternChange = (value: string) => {
    setOtherPattern(value);
    setSelectedPattern('Other');
    handleInputChange(question, "Other: " + value);
    setError(false);
  };

  const handleContinue = () => {
    if (!selectedPattern || (selectedPattern === 'Other' && !otherPattern.trim())) {
      setError(true);
      return;
    }
    goToNextSection();
  };

  // Animation variants remain the same
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
      className="min-h-screen flex items-center justify-center py-16 px-4 relative"
    >
      <motion.div
        className="max-w-lg w-full p-8 rounded-2xl shadow-xl h-full relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5"
        variants={itemVariants}
      >
        <div className="relative z-10">
          <motion.div
            className="flex items-center justify-center mb-8"
            variants={itemVariants}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white">
              <Brain className="h-8 w-8" />
            </div>
          </motion.div>

          <motion.h2
            className="text-3xl font-bold mb-6 text-center text-gray-800"
            variants={itemVariants}
          >
            {question} <span className="text-red-500"></span>
          </motion.h2>

          <motion.p
            className="text-gray-600 text-center mb-8"
            variants={itemVariants}
          >
            Understanding our patterns can lead to powerful insights
          </motion.p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm"
            >
              Please select an option to continue
            </motion.div>
          )}

          <motion.div
            className="space-y-4"
            variants={itemVariants}
          >
            {[
              "Work-related stress responses",
              "Decision-making processes",
              "Reactions in relationships",
              "Procrastination habits",
              "Self-talk patterns",
              "Energy management",
              "Creative blocks"
            ].map((pattern, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02, x: 4 }}
                className={`border p-4 rounded-xl cursor-pointer transition-all backdrop-blur-sm bg-white/50 ${
                  selectedPattern === pattern 
                    ? "border-purple-500 bg-purple-50/50" 
                    : "border-gray-100 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
                onClick={() => handlePatternSelect(pattern)}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="pattern"
                    className="form-radio h-5 w-5 text-purple-500"
                    checked={selectedPattern === pattern}
                    onChange={() => handlePatternSelect(pattern)}
                  />
                  <span className="ml-3 text-gray-800">{pattern}</span>
                </label>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="flex justify-between mt-8"
            variants={itemVariants}
          >
            <motion.button
              onClick={goToPrevSection}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </motion.button>

            <motion.button
              onClick={handleContinue}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-lg hover:shadow-lg transition shadow-md flex items-center gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Question5;