import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

type UploadAlertDialogProps = {
  isOpen: boolean;
  isDarkMode: boolean;
  elementTextColor: string;
  primaryColor: string;
  onClose: () => void;
};

const UploadAlertDialog: React.FC<UploadAlertDialogProps> = ({
  isOpen,
  isDarkMode,
  elementTextColor,
  primaryColor,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-lg shadow-xl p-6"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
          color: elementTextColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className="p-3 rounded-full"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            <AlertTriangle size={24} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Journal Entry Required</h3>
            <p className="text-sm" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
              Please add a title, content, or tags before uploading media files.
              This helps organize your journal entries.
            </p>
          </div>
        </div>

        <div
          className="p-3 rounded-lg mb-6"
          style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
        >
          <p className="text-xs" style={{ color: isDarkMode ? '#D1D5DB' : '#4B5563' }}>
            Tip: Start by writing your thoughts or adding a title,
            then attach your media files. This ensures your journal entry is properly saved.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: primaryColor,
            color: '#ffffff',
          }}
        >
          Got it!
        </button>
      </motion.div>
    </div>
  );
};

export default UploadAlertDialog;
