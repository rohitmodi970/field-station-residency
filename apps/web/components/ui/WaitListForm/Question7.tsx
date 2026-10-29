import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Activity, Compass, 
   Brain, Heart, MessageCircle, 
  FileText, Zap, CheckCircle, AlertCircle
} from 'lucide-react';

interface Question7Props {
  question: string;
  handleCheckboxChange: (question: string, option: string, checked: boolean) => void;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question7: React.FC<Question7Props> = ({
  question,
  handleCheckboxChange,
  handleInputChange,
  goToNextSection,
  goToPrevSection
}) => {
  
  // Initialize state from localStorage if available
  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('question7Options');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [customApproach, setCustomApproach] = useState<string>(() => {
    const saved = localStorage.getItem('question7Custom');
    return saved || '';
  });
  
  const [error, setError] = useState(false);

  // Save to localStorage whenever values change
  useEffect(() => {
    localStorage.setItem('question7Options', JSON.stringify(selectedOptions));
  }, [selectedOptions]);

  useEffect(() => {
    localStorage.setItem('question7Custom', customApproach);
  }, [customApproach]);

  const approaches = [
    { text: "Movement & exercise", icon: <Activity className="h-4 w-4" /> },
    { text: "Nature immersion", icon: <Compass className="h-4 w-4" /> },
    { text: "Creative expression", icon: <Zap className="h-4 w-4" /> },
    { text: "Meditation/mindfulness", icon: <Brain className="h-4 w-4" /> },
    { text: "Deep breathing", icon: <Heart className="h-4 w-4" /> },
    { text: "Social connection", icon: <MessageCircle className="h-4 w-4" /> },
    { text: "Music/sound therapy", icon: <FileText className="h-4 w-4" /> },
    { text: "Change of environment", icon: <Compass className="h-4 w-4" /> },
    { text: "Cold exposure/contrast", icon: <Zap className="h-4 w-4" /> }
  ];

  const handleOptionChange = (option: string, checked: boolean) => {
    setError(false);
    
    if (checked) {
      setSelectedOptions(prev => [...prev, option]);
    } else {
      setSelectedOptions(prev => prev.filter(item => item !== option));
    }
    
    handleCheckboxChange(question, option, checked);
  };

  const handleCustomChange = (value: string) => {
    setCustomApproach(value);
    handleInputChange(question + " (unique approach)", value);
  };

  const handleContinue = () => {
    if (selectedOptions.length === 0 && !customApproach.trim()) {
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
      className="min-h-screen flex items-center justify-center py-16 px-4 relative"
    >
      <motion.div 
        className="max-w-xl w-full p-10 rounded-3xl shadow-xl relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="relative z-10">
          {/* Question header with icon */}
          <div className="flex items-center mb-6">
            <div className="bg-gradient-to-r from-teal-400 to-emerald-500 p-2 rounded-lg mr-4">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-center text-gray-800">
                {question}
              </h2>
              <p className="text-gray-500 text-sm mt-1">Discover your unique energy flow patterns</p>
            </div>
          </div>
          
          {/* Question description */}
          <motion.p 
            className="text-gray-600 mb-8 pl-4 border-l-2 border-teal-400"
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            We all experience energy blocks - your approaches will help us personalize specifically for you.
          </motion.p>

          {/* Error message */}
          {error && (
            <motion.div 
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Please select at least one option or describe your approach.</span>
            </motion.div>
          )}
          
          {/* Options grid with animated entries */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Select all approaches that have worked for you:
              <span className="text-red-500 ml-1"></span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {approaches.map((approach, index) => (
                <motion.label 
                  key={index}
                  className="flex items-center p-3 border border-gray-100 rounded-xl hover:border-teal-300 hover:bg-teal-50 cursor-pointer transition-all group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(approach.text)}
                      className="form-checkbox h-4 w-4 text-teal-500 rounded border-gray-300 focus:ring-teal-500"
                      onChange={(e) => handleOptionChange(approach.text, e.target.checked)}
                    />
                  </div>
                  <div className="ml-3 flex items-center text-gray-800">
                    <span className="mr-2 text-teal-500">{approach.icon}</span>
                    <span className="text-sm">{approach.text}</span>
                  </div>
                  <motion.div 
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={{ x: -5 }}
                    whileHover={{ x: 0 }}
                  >
                    <CheckCircle className="h-4 w-4 text-teal-400" />
                  </motion.div>
                </motion.label>
              ))}
            </div>
          </div>
          
          {/* Custom approach input */}
          <motion.div 
            className="bg-gradient-to-r from-teal-50 to-emerald-50 p-6 rounded-2xl mb-8 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center text-teal-800 font-medium mb-3">
              <Zap className="h-4 w-4 mr-2" />
              <span>Share your unique approach:</span>
            </div>
            <textarea
              rows={3}
              placeholder="Describe any other methods that have helped you shift your energy state..."
              className="w-full bg-white rounded-xl border border-teal-100 p-4 focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm shadow-inner"
              onChange={(e) => handleCustomChange(e.target.value)}
              value={customApproach}
            ></textarea>
          </motion.div>
          
          {/* Navigation buttons with animated effects */}
          <motion.div 
            className="flex justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <motion.button 
              onClick={goToPrevSection}
              className="px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600 flex items-center gap-2 group"
              whileHover={{ x: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="h-4 w-4 group-hover:animate-pulse" />
              <span>Previous</span>
            </motion.button>
            
            <motion.button 
              onClick={handleContinue}
              className="px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition flex items-center gap-2 group"
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 group-hover:animate-pulse" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Question7;