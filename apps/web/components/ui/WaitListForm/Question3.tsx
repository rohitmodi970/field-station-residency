import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface Question3Props {
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question3: React.FC<Question3Props> = ({
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  // Initialize state from localStorage if available
  const [answer, setAnswer] = useState<string>(() => {
    const savedAnswer = localStorage.getItem('question3Answer');
    return savedAnswer || '';
  });
  const [showError, setShowError] = useState(false);

  // Save answer to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('question3Answer', answer);
    // Don't call handleInputChange here - this is what's causing the infinite loop!
  }, [answer]);
  
  // Run this only once on mount to restore the answer in parent component
  useEffect(() => {
    if (answer) {
      handleInputChange(question, answer);
    }
    // We only want this to run once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value);
    // Don't call handleInputChange on every keystroke
    if (e.target.value.trim()) {
      setShowError(false);
    }
  };

  const handleContinue = () => {
    if (!answer.trim()) {
      setShowError(true);
    } else {
      // Update parent state when continuing to next section
      handleInputChange(question, answer);
      goToNextSection();
    }
  };

  // Animation variants
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
        className="max-w-lg w-full p-8 rounded-2xl shadow-xl relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5"
        variants={itemVariants}
      >
        <div className="relative z-10">
          <motion.div
            className="mb-8 text-center"
            variants={itemVariants}
          >
            <h2 className="text-3xl font-bold text-gray-800">{question}</h2>
          </motion.div>

          <motion.div
            className="bg-pink-50 p-6 rounded-xl mb-6"
            variants={itemVariants}
          >
            <textarea
              rows={4}
              placeholder="Share your current growth journey here..."
              className={`w-full bg-white rounded-lg border ${showError ? 'border-red-400' : 'border-gray-200'} p-4 focus:ring-2 focus:ring-pink-500 focus:border-transparent`}
              onChange={handleChange}
              value={answer}
            ></textarea>
            {showError && (
              <p className="text-red-500 text-sm mt-2">Please share your answer before continuing</p>
            )}
          </motion.div>

          <motion.div
            className="space-y-2 mb-8"
            variants={itemVariants}
          >
          </motion.div>

          <motion.div
            className="flex justify-between"
            variants={itemVariants}
          >
            <motion.button
              onClick={() => {
                // Save current answer before going back
                handleInputChange(question, answer);
                goToPrevSection();
              }}
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
              className={`px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg ${
                !answer.trim() ? 'opacity-70' : 'hover:from-pink-600 hover:to-rose-700'
              } transition shadow-md flex items-center gap-2`}
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

export default Question3;