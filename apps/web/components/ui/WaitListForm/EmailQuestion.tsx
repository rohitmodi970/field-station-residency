import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { FormData } from './snapStart2';

interface EmailQuestionProps {
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
  formData: FormData;
}

const EmailQuestion: React.FC<EmailQuestionProps> = ({
  question,
  handleInputChange,
  goToNextSection,
  goToPrevSection,
  formData
}) => {
  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

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

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Debounced email checking    
  useEffect(() => {
    const checkEmailExists = async () => {
      if (email && validateEmail(email)) {
        setCheckingEmail(true);
        try {
          const response = await fetch('/api/check-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setEmailExists(data.exists);
            if (data.exists) {
              setError(data.message);
            } else {
              setError(null);
            }
          } else {
            console.error('Email check failed:', data.error);
          }
        } catch (err) {
          console.error('Email check error:', err);
        } finally {
          setCheckingEmail(false);
        }
      } else {
        setEmailExists(false);
        setError(null);
      }
    };

    // Debounce the email check
    const timeoutId = setTimeout(checkEmailExists, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setIsValid(value === '' || validateEmail(value));
    handleInputChange(question, value);
    
    // Reset error when user starts typing
    if (error && !emailExists) {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    // Validate email
    if (email === '' || !validateEmail(email)) {
      setIsValid(false);
      setError('Please enter a valid email address');
      return;
    }

    // Check if email already exists
    if (emailExists) {
      setError('This email is already registered. You cannot submit the form again.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log("Preparing to submit form data:", formData);
      
      // Make sure email is included in the formData
      const updatedFormData = {
        ...formData,
        [question]: email
      };
      
      console.log("Submitting form data to API:", updatedFormData);
      
      // Submit form data to the API endpoint
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData: updatedFormData }),
      });
      
      const data = await response.json();
      console.log("API Response:", data);
      
      if (!response.ok || !data.success) {
        // Handle specific error cases
        if (response.status === 409) {
          throw new Error(data.message || 'This email is already registered. Please use a different email address.');
        }
        throw new Error(data.message || data.error || 'Failed to submit form');
      }
      
      setSubmitted(true);
      
      // Clear all form-related local storage items
      try {
        // Clear all question-specific storage
        localStorage.removeItem('question2Selections');
        localStorage.removeItem('question3Answer');
        localStorage.removeItem('question4Answer');
        localStorage.removeItem('question5Pattern');
        localStorage.removeItem('question5OtherPattern');
        localStorage.removeItem('question6Scale');
        localStorage.removeItem('question6Text');
        localStorage.removeItem('question7Options');
        localStorage.removeItem('question7Custom');
        
        // Clear any other form-related items
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('question')) {
            localStorage.removeItem(key);
          }
        });
        
        console.log("All form-related local storage has been cleared successfully");
      } catch (storageError) {
        console.error("Failed to clear local storage:", storageError);
        // Continue with the flow even if local storage clearing fails
      }
      
      // Wait a moment before proceeding to the next section
      setTimeout(() => {
        goToNextSection();
      }, 1500);
    } catch (err: unknown) {
      console.error("Form submission error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the form');
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate a personalized summary based on form data
  const generateSummary = () => {
    // This is just a simple example - you can expand based on your actual form data structure
    const areas = Object.keys(formData).filter(key => 
      key.includes('area') && formData[key] === true
    ).length;
    
    return `Based on your answers, we'll create a personalized growth plan focusing on your selected areas.`;
  };

  // Determine input border color and validation state
  const getInputClassName = () => {
    let baseClass = "w-full bg-white rounded-lg border p-4 pr-12 focus:ring-2 focus:border-transparent transition-all";
    
    if (emailExists || (!isValid && email !== '')) {
      return `${baseClass} border-red-500 focus:ring-red-500`;
    } else if (email && isValid && !emailExists && !checkingEmail) {
      return `${baseClass} border-green-500 focus:ring-green-500`;
    } else {
      return `${baseClass} border-gray-200 focus:ring-blue-500`;
    }
  };

  const canSubmit = email && isValid && !emailExists && !checkingEmail && !submitting && !submitted;

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
            <span className="inline-block bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium mb-3">Final Step</span>
            <h2 className="text-3xl font-bold text-gray-800">{question}</h2>
          </motion.div>

          <motion.div
            className="bg-green-50 p-6 rounded-xl mb-6"
            variants={itemVariants}
          >
            <p className="text-gray-700 mb-4">{generateSummary()}</p>
            
            <div className="relative">
              <input
                type="email"
                placeholder="Enter your email address"
                className={getInputClassName()}
                value={email}
                onChange={handleEmailChange}
                disabled={submitting || submitted}
              />
              
              {/* Loading indicator for email checking */}
              {checkingEmail && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
              
              {/* Success indicator */}
              {email && isValid && !emailExists && !checkingEmail && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              )}
              
              {/* Error indicator */}
              {(emailExists || (!isValid && email !== '')) && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
              )}
              
              {/* Error messages */}
              {!isValid && email !== '' && (
                <p className="text-red-500 text-sm mt-2">Please enter a valid email address</p>
              )}
              {error && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            className="mb-6"
            variants={itemVariants}
          >
            <div className="flex items-center mb-4">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-gray-700 text-sm">Receive your personalized growth plan</span>
            </div>
            <div className="flex items-center mb-4">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-gray-700 text-sm">Get access to exclusive resources</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-gray-700 text-sm">We respect your privacy and will never spam you</span>
            </div>
          </motion.div>

          <motion.div
            className="flex justify-between"
            variants={itemVariants}
          >
            <motion.button
              onClick={goToPrevSection}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={submitting || submitted}
              className={`px-5 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 flex items-center gap-2 ${(submitting || submitted) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </motion.button>

            <motion.button
              onClick={handleSubmit}
              whileHover={canSubmit ? { scale: 1.05 } : {}}
              whileTap={canSubmit ? { scale: 0.95 } : {}}
              disabled={!canSubmit}
              className={`px-5 py-2 rounded-lg transition shadow-md flex items-center gap-2 ${
                canSubmit
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <Send className="h-4 w-4 animate-pulse" />
                  Submitting...
                </>
              ) : submitted ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </>
              ) : (
                <>
                  Submit
                  <Send className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmailQuestion;