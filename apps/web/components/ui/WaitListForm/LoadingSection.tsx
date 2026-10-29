import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Zap, ChevronRight, ArrowLeft } from 'lucide-react';

interface LoadingSectionProps {
  loading: boolean;
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const LoadingSection: React.FC<LoadingSectionProps> = ({
  loading,
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  const [answer, setAnswer] = useState('');
  const [showError, setShowError] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value);
    if (e.target.value.trim()) {
      setShowError(false);
    }
  };

  const handleContinue = () => {
    if (!answer.trim()) {
      setShowError(true);
    } else {
      handleInputChange(question, answer);
      goToNextSection();
    }
  };

  return (
    <motion.div
      className="flex justify-center items-center min-h-screen flex-col text-white relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Stylish overlay for blur/brightness when loading */}
      {loading && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "url('/loader-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(8px) brightness(1.1)',
            opacity: 0.5,
          }}
        />
      )}

      {/* Animated background particles */}
      <div className="absolute inset-0 z-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white opacity-20"
            style={{
              width: Math.random() * 6 + 2 + 'px',
              height: Math.random() * 6 + 2 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
            }}
            animate={{
              y: [0, -100],
              opacity: [0, 0.8, 0]
            }}
            transition={{
              duration: Math.random() * 8 + 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {loading ? (
        <motion.div
          className="flex flex-col items-center z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="text-9xl font-bold text-center relative"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <img 
          src="/Logo-black.png" 
          alt="FORCE Logo" 
          className="w-32 h-32 inline-block mb-4"
        /> 
            <motion.div
              className="absolute inset-0 blur-xl bg-blue-500 opacity-30"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            ></motion.div>
          </motion.div>
          <div className="mt-6 h-2 w-36 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
            ></motion.div>
          </div>
          <div className="mt-3 text-sm text-gray-600 flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating your personalized experience...
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="max-w-lg w-full mx-auto p-8 rounded-xl shadow-2xl z-10 relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative z-10">

            <motion.h2
              className="text-3xl font-extrabold mb-8 text-center text-gray-700 drop-shadow-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {question}
            </motion.h2>

            <div className="space-y-4 text-bold text-gray-700">
              {[
                "Yes, frequently",
                "Sometimes, when I'm reflective",
                "Rarely, but I'd like to more",
                "I'm new to this practice"
              ].map((answer, idx) => (
                <motion.div
                  key={idx}
                  onClick={() => { handleInputChange(question, answer); goToNextSection(); }}
                  className="w-full p-5 text-center bg-white/5 hover:bg-white/15 rounded-xl transition-all cursor-pointer border border-white/10 group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,0.15)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex-grow text-black">{answer}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-8 flex justify-start opacity-70 hover:opacity-100 transition-opacity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <button
                onClick={goToPrevSection}
                className="text-sm flex text-gray-600 items-center hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Go back
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LoadingSection;
