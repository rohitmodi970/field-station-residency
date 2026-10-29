import React from 'react';
import OCRUpload from './OCRUpload';
import ForceChatbot from '@/components/ForceChatbot';

type JournalEntryPayload = {
  title: string;
  content: string;
  voiceTranscript?: string;
  tags: string[];
  mood?: string;
  date: string;
};

type JournalEntryAuxiliaryPanelsProps = {
  showOCRUpload: boolean;
  onTextExtracted: (text: string) => void;
  onCloseOCR: () => void;
  showChatbot: boolean;
  entrySavedSuccessfully: boolean;
  onCloseChatbot: () => void;
  journalEntry: JournalEntryPayload;
  userProfile?: Record<string, unknown>;
};

const JournalEntryAuxiliaryPanels: React.FC<JournalEntryAuxiliaryPanelsProps> = ({
  showOCRUpload,
  onTextExtracted,
  onCloseOCR,
  showChatbot,
  entrySavedSuccessfully,
  onCloseChatbot,
  journalEntry,
  userProfile,
}) => {
  return (
    <>
      {showOCRUpload && (
        <OCRUpload
          onTextExtracted={onTextExtracted}
          onClose={onCloseOCR}
        />
      )}

      {showChatbot && entrySavedSuccessfully && (
        <ForceChatbot
          isOpen={showChatbot}
          onClose={onCloseChatbot}
          journalEntry={journalEntry}
          userProfile={userProfile}
        />
      )}
    </>
  );
};

export default JournalEntryAuxiliaryPanels;
