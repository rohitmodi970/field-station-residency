import React from 'react';
import Question2 from './Question2';
import Question3 from './Question3';
import Question4 from './Question4';
import Question5 from './Question5';
import Question6 from './Question6';
import Question7 from './Question7';
import EmailQuestion from './EmailQuestion';
import { FormData } from './snapStart2';

interface QuestionSectionProps {
  sectionIndex: number;
  question: string;
  handleInputChange: (question: string, answer: string) => void;
  handleCheckboxChange: (question: string, option: string, checked: boolean) => void;
  goToNextSection: () => void;
  goToPrevSection: () => void;
  formData: FormData;
}

const QuestionSection: React.FC<QuestionSectionProps> = ({
  sectionIndex,
  question,
  handleInputChange,
  handleCheckboxChange,
  goToNextSection,
  goToPrevSection,
  formData
}) => {
  // Map section index to corresponding question component
  const renderQuestion = () => {
    switch (sectionIndex) {
      case 2:
        return (
          <Question2
            question={question}
            handleCheckboxChange={handleCheckboxChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 3:
        return (
          <Question3
            question={question}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 4:
        return (
          <Question7
            question={question}
            handleCheckboxChange={handleCheckboxChange}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 5:
        return (
          <Question5
            question={question}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 6:
        return (
          <Question6
            question={question}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 7:
        return (
          <Question4
            question={question}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
          />
        );
      case 8:
        return (
          <EmailQuestion
            question={question}
            handleInputChange={handleInputChange}
            goToNextSection={goToNextSection}
            goToPrevSection={goToPrevSection}
            formData={formData}
          />
        );
      default:
        return null;
    }
  };

  return <>{renderQuestion()}</>;
};

export default QuestionSection;