import React, { useRef } from "react";
import { useTheme } from "@/utilities/context/ThemeContext";

interface AudioUploaderProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({ handleFileUpload }) => {
  const fileInputRef = useRef(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input change event triggered");
    console.log("Files selected:", e.target.files);
    
    // Call the parent component's handler
    handleFileUpload(e);
    
    // Reset the input if needed (this helps if users try to upload the same file twice)
    // fileInputRef.current.value = "";
  };
  
  const { isDarkMode } = useTheme();

  return (
    <div style={{ borderTop: '1px solid rgba(147,114,95,0.08)', paddingTop: 16 }} className="md:pl-4 flex-1">
      <h3 style={{ color: 'var(--analysis-text)' }} className="text-lg mb-2">Upload Audio File</h3>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleChange}
        className="block w-full text-sm"
        style={{ color: 'var(--analysis-muted)' }}
      />
      <p style={{ color: 'var(--analysis-muted)' }} className="mt-2 text-xs">
        Supported formats: MP3, WAV, M4A, etc.
      </p>
    </div>
  );
};

export default AudioUploader;