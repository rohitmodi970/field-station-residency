import React from 'react';
import UploadAlertDialog from './UploadAlertDialog';
import JournalEntryAuxiliaryPanels from './JournalEntryAuxiliaryPanels';

type JournalEntryAuxWrapperProps = {
  showUploadAlert: boolean;
  isDarkMode: boolean;
  elementTextColor: string;
  primaryColor: string;
  onCloseUploadAlert: () => void;
  showOCRUpload: boolean;
  onTextExtracted: (text: string) => void;
  onCloseOCR: () => void;
  showChatbot: boolean;
  entrySavedSuccessfully: boolean;
  onCloseChatbot: () => void;
  journalEntry: {
    title: string;
    content: string;
    voiceTranscript?: string;
    tags: string[];
    mood?: string;
    date: string;
  };
  userProfile?: Record<string, unknown>;
};

const JournalEntryAuxWrapper: React.FC<JournalEntryAuxWrapperProps> = ({
  showUploadAlert,
  isDarkMode,
  elementTextColor,
  primaryColor,
  onCloseUploadAlert,
  showOCRUpload,
  onTextExtracted,
  onCloseOCR,
  showChatbot,
  entrySavedSuccessfully,
  onCloseChatbot,
  journalEntry,
  userProfile,
}) => (
  <>
    <UploadAlertDialog
      isOpen={showUploadAlert}
      isDarkMode={isDarkMode}
      elementTextColor={elementTextColor}
      primaryColor={primaryColor}
      onClose={onCloseUploadAlert}
    />

    <JournalEntryAuxiliaryPanels
      showOCRUpload={showOCRUpload}
      onTextExtracted={onTextExtracted}
      onCloseOCR={onCloseOCR}
      showChatbot={showChatbot}
      entrySavedSuccessfully={entrySavedSuccessfully}
      onCloseChatbot={onCloseChatbot}
      journalEntry={journalEntry}
      userProfile={userProfile}
    />
  </>
);

export default JournalEntryAuxWrapper;
