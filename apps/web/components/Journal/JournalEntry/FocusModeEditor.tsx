import React from 'react';

type JournalStyles = {
  textPrimary: string;
};

type FocusModeEditorProps = {
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onContentChange: (value: string) => void;
  styles: JournalStyles;
};

const FocusModeEditor: React.FC<FocusModeEditorProps> = ({
  editorRef,
  content,
  onContentChange,
  styles,
}) => {
  return (
    <div className="max-w-3xl mx-auto shadow-lg rounded-lg overflow-hidden border border-gray-200">
      <textarea
        ref={editorRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full h-full bg-transparent border-none outline-none resize-none p-6 text-lg leading-relaxed transition-all duration-300"
        style={{
          color: styles.textPrimary,
          height: 'calc(100vh - 120px)',
          fontFamily: '"Noto Serif", serif',
        }}
        placeholder="Start writing your thoughts..."
        autoFocus
      />
    </div>
  );
};

export default FocusModeEditor;
