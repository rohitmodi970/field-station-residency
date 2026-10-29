import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft} from 'lucide-react';

interface Question2Props {
  question: string;
  handleCheckboxChange: (question: string, option: string, checked: boolean) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
}

const Question2: React.FC<Question2Props> = ({
  question,
  handleCheckboxChange,
  goToNextSection,
  goToPrevSection
}) => {
  // Initialize state from localStorage if available
  const [selections, setSelections] = useState<string[]>(() => {
    const savedSelections = localStorage.getItem('question2Selections');
    return savedSelections ? JSON.parse(savedSelections) : [];
  });
  const [showError, setShowError] = useState(false);
  
  // Save selections to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('question2Selections', JSON.stringify(selections));
  }, [selections]);
  
  // Run this effect only once on component mount to restore checkbox state
  useEffect(() => {
    // Restore checkbox state for each saved selection on initial load only
    selections.forEach(option => {
      handleCheckboxChange(question, option, true);
    });
    // We're intentionally not including handleCheckboxChange in deps array 
    // because we only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, selections]);
  
  const handleSelection = (option: string, checked: boolean) => {
    handleCheckboxChange(question, option, checked);
    
    if (checked) {
      setSelections(prev => [...prev, option]);
      setShowError(false);
    } else {
      setSelections(prev => prev.filter(item => item !== option));
    }
  };
  
  const handleContinue = () => {
    if (selections.length === 0) {
      setShowError(true);
    } else {
      goToNextSection();
    }
  };

  return (
    <motion.div 
      className="min-h-screen flex items-center justify-center py-16 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="max-w-lg w-full p-10 rounded-3xl shadow-xl relative overflow-hidden backdrop-blur-xl bg-white/[0.02] dark:bg-black/[0.02] border border-white/5 dark:border-white/5">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 text-center text-gray-800">{question}</h2>
          <p className="text-gray-500 mb-2">Select all that apply to your current practice</p>
          {showError && (
            <p className="text-red-500 text-sm mb-4">Please select at least one option</p>
          )}

          <div className="space-y-4">
            {[
              "Journal or diary",
              "Notes on phone or computer",
              "Voice memos",
              "Meditation or mindfulness",
              "I don't have a current practice"
            ].map((option, index) => (
              <label key={index} className="flex items-center p-4 border border-gray-100 rounded-xl hover:border-purple-200 hover:bg-purple-50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-purple-600 rounded"
                  checked={selections.includes(option)}
                  onChange={(e) => handleSelection(option, e.target.checked)}
                />
                <span className="ml-3 text-gray-800">{option}</span>
              </label>
            ))}
          </div>

          <div className="mt-10 flex justify-between">
            <button 
              onClick={goToPrevSection} 
              className="px-6 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <button 
              onClick={handleContinue} 
              className={`px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg transition shadow-md ${
                selections.length === 0 ? 'opacity-70' : 'hover:from-purple-600 hover:to-indigo-700'
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Question2;