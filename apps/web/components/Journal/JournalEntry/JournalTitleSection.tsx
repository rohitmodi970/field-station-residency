import React from 'react';
import { Clock } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

type MoodOption = {
  id: string;
  emoji: string;
  label: string;
};
//interface of journal styles 
type JournalStyles = {
  textPrimary: string;
  textSecondary: string;
  bgPage: string;
  primaryColor: string;
  borderColor: string;
  primaryLight: string;
};

type JournalTitleSectionProps = {
  itemVariants: Variants;
  titleRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  onTitleChange: (value: string) => void;
  onTitleFocus: () => void;
  onTitleBlur: () => void;
  isTitleFocused: boolean;
  styles: JournalStyles;
  isDarkMode: boolean;
  date: string;
  selectedMood: string | null;
  moods: MoodOption[];
  showMeta?: boolean;
  isMinimal?: boolean;
};
// JournalTitleSection component handles the display and editing of the journal entry title, as well as showing the date and selected mood. It uses framer-motion for animations and applies dynamic styles based on the current theme and focus state.
const JournalTitleSection: React.FC<JournalTitleSectionProps> = ({
  itemVariants,
  titleRef,
  title,
  onTitleChange,
  onTitleFocus,
  onTitleBlur,
  isTitleFocused,
  styles,
  isDarkMode,
  date,
  selectedMood,
  moods,
  showMeta = true,
  isMinimal = false,
}) => {
  const inputClassName = isMinimal
    ? 'mb-6 w-full appearance-none bg-transparent text-sm font-medium outline-none'
    : 'mb-2 w-full appearance-none border-b bg-transparent pb-2 text-lg font-semibold outline-none transition-colors duration-200 sm:text-xl';
  return (
    <motion.div className="mb-6" variants={itemVariants}>
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onFocus={onTitleFocus}
        onBlur={onTitleBlur}
        placeholder="Entry Title"
        className={inputClassName}
        style={{
          color: isMinimal ? styles.textSecondary : styles.textPrimary,
          borderColor: isMinimal ? 'transparent' : (isTitleFocused ? styles.primaryColor : styles.borderColor),
          caretColor: styles.primaryColor,
          backgroundColor: 'transparent',
          colorScheme: isDarkMode ? 'dark' : 'light',
          WebkitTextFillColor: isMinimal ? styles.textSecondary : styles.textPrimary,
        }}
      />

      {showMeta && (
        <div className="mb-3 flex items-center text-sm" style={{ color: styles.textSecondary }}>
          <Clock size={16} className="mr-1" />
          <span>{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          {selectedMood && (
            <span className="ml-3">
              {moods.find((m) => m.id === selectedMood)?.emoji}
              {moods.find((m) => m.id === selectedMood)?.label}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default JournalTitleSection;
