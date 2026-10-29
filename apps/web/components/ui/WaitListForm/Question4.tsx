import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, MessageCircle } from 'lucide-react';

interface Question4Props {
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question4: React.FC<Question4Props> = ({
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  // Initialize state from localStorage if available
  const [answer, setAnswer] = useState<string>(() => {
    const savedAnswer = localStorage.getItem('question4Answer');
    return savedAnswer || '';
  });
  const [showError, setShowError] = useState(false);

  // Save answer to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('question4Answer', answer);
    // Remove the handleInputChange call from here
  }, [answer]);
  
  // Run this only once on mount to restore the answer in parent component
  useEffect(() => {
    if (answer) {
      handleInputChange(question, answer);
    }
    // We only want this to run once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswer(e.target.value);
    // Remove the handleInputChange call from here too
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
      <div className="max-w-lg w-full relative overflow-hidden rounded-2xl shadow-xl p-0 backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5">
        <div className="relative z-10">
          <motion.div
            className="absolute -top-10 -left-10 w-20 h-20 bg-blue-200 rounded-full opacity-50"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{
              repeat: Infinity,
              duration: 4
            }}
          ></motion.div>

          <motion.div
            className="absolute -bottom-10 -right-10 w-24 h-24 bg-sky-200 rounded-full opacity-50"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{
              repeat: Infinity,
              duration: 5,
              delay: 1
            }}
          ></motion.div>

          <motion.div
            className="p-10 rounded-2xl shadow-xl relative z-10"
            variants={itemVariants}
          >
            <motion.div
              className="mb-8 text-center"
              variants={itemVariants}
            >
              <h2 className="text-3xl font-bold text-center text-gray-800">{question}</h2>
            </motion.div>

            <motion.div
              className="relative mb-2"
              variants={itemVariants}
            >
              <input
                type="text"
                required
                placeholder="Type your question here..."
                className={`w-full p-4 pr-12 border ${showError ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                onChange={handleChange}
                value={answer}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500">
                <MessageCircle className="h-5 w-5" />
              </div>
            </motion.div>
            
            {showError && (
              <p className="text-red-500 text-sm mb-4">Please enter your question before continuing</p>
            )}

            <motion.div
              className="mb-8 bg-blue-50 p-6 rounded-xl"
              variants={itemVariants}
            >
              <p className="text-sm text-blue-700 mb-3 font-medium">Examples of powerful questions:</p>
              <ul className="space-y-2 text-gray-700">
                {[
                  "How can I find more meaning in my daily routine?",
                  "What is the biggest obstacle I'm not facing?",
                  "Where am I not being honest with myself?"
                ].map((example, index) => (
                  <motion.li
                    key={index}
                    className="flex items-center"
                    whileHover={{ x: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                    <span>{example}</span>
                  </motion.li>
                ))}
              </ul>
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
                className={`px-5 py-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white rounded-lg ${
                  !answer.trim() ? 'opacity-70' : 'hover:from-blue-600 hover:to-sky-700'
                } transition shadow-md flex items-center gap-2`}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Question4;