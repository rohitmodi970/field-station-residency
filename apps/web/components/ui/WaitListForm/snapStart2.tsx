"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Landing from './Landing';
import LoadingSection from './LoadingSection';
import QuestionSection from './QuestionSection';
import FinalWelcome from './FinalWelcome';
import ProgressIndicator from './ProgressIndicator';
import AnimatedBackground from './AnimatedBackground';

export interface FormData {
  [key: string]: any;
}

export interface SnapStartProps {
  onComplete?: () => void;
}

const SnapStart: React.FC<SnapStartProps> = ({ onComplete }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  const [submitStatus, setSubmitStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  
  // Total sections: Landing + 8 questions (including email) + final welcome
  const totalSections = 10;

  // Handle section navigation - using useCallback to prevent recreation on every render
  const goToNextSection = useCallback(() => {
    if (currentSection === 0) {
      setLoading(true);
      setCurrentSection(prev => prev + 1);

      // Keep loading true for 3 seconds
      setTimeout(() => {
        setLoading(false);
      }, 3000);
    } else if (currentSection >= totalSections - 1) {
      // If we're at the last section, call onComplete
      if (onComplete) onComplete();
    } else {
      setCurrentSection(prev => prev + 1);
    }
  }, [currentSection, totalSections, onComplete]);

  const goToPrevSection = useCallback(() => {
    setCurrentSection(prev => prev - 1);
  }, []);

  // Handle scroll to top when section changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSection > 0) {
      window.scrollTo(0, 0);
    }
  }, [currentSection]);

  // Save answer to state - using useCallback to stabilize function reference
  const handleInputChange = useCallback((question: string, answer: string) => {
    setFormData(prev => ({ ...prev, [question]: answer }));
  }, []);

  // Handle checkbox selection - using useCallback to stabilize function reference
  const handleCheckboxChange = useCallback((question: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const currentAnswers = prev[question] || [];
      
      if (checked) {
        return {
          ...prev,
          [question]: [...currentAnswers, option]
        };
      } else {
        return {
          ...prev,
          [question]: currentAnswers.filter((item: string) => item !== option)
        };
      }
    });
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setSubmitStatus('loading');
      
      // API call to save data
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit form');
      }
      
      console.log('Data submitted successfully:', data);
      
      setSubmitStatus('success');
      setTimeout(() => goToNextSection(), 500);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus(null), 3000);
    }
  };

  // Questions array - using useMemo to prevent recreation on every render
  const questions = React.useMemo(() => [
    "Hey there! Do you ever get drawn to explore your inner thoughts and patterns?",
    "How do you currently capture your ideas and reflections to track of your personal journey?",
    "I'm curious - what's something you did recently that made time seem to disappear because you were so immersed in it?",
    "We all have those little moments that help us reset. What's your go-to way to reconnect with yourself when life gets noisy?",
    "If we could shine a light on one corner of your thinking patterns, where would you want that beam to focus?",
    "When do you feel your creative energy is at its peak during the day?",
    "If Force could help you with just one thing in your journey, what would that be?",
    "Share your email to save your journey and receive tailored insights"
  ], []);

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground opacity={0.3} />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen">
        <AnimatePresence mode="wait">
          {currentSection === 0 && (
            <Landing key="landing" goToNextSection={goToNextSection} />
          )}

          {currentSection === 1 && (
            <LoadingSection 
              key="loading"
              loading={loading} 
              question={questions[0] || ''} 
              handleInputChange={handleInputChange} 
              goToNextSection={goToNextSection} 
              goToPrevSection={goToPrevSection}
            />
          )}

          {currentSection >= 2 && currentSection <= 8 && (
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="w-full max-w-4xl mx-auto flex items-center justify-center">
                <QuestionSection
                  sectionIndex={currentSection}
                  question={questions[currentSection - 1] || ''}
                  handleInputChange={handleInputChange}
                  handleCheckboxChange={handleCheckboxChange}
                  goToNextSection={goToNextSection}
                  goToPrevSection={goToPrevSection}
                  formData={formData}
                />
              </div>
            </div>
          )}

          {currentSection === 9 && (
            <FinalWelcome 
              key="welcome"
              goToPrevSection={goToPrevSection} 
              onComplete={onComplete} 
            />
          )}
        </AnimatePresence>

        {/* Progress Indicator */}
        {currentSection > 0 && currentSection < 9 && (
          <ProgressIndicator currentSection={currentSection} totalSections={8} />
        )}
      </div>
    </div>
  );
};

export default SnapStart;