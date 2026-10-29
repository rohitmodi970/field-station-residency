import React from "react";
import { useTheme } from "@/utilities/context/ThemeContext";

interface AudioRecorderProps {
  startRecording: () => void;
  stopRecording: () => void;
  recording: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ startRecording, stopRecording, recording }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  
  return (
    <div className="flex-1">
      <h3 className="text-lg mb-2" style={{ color: 'var(--analysis-text)' }}>Record Audio</h3>
      <div className="flex space-x-2">
        {!recording ? (
          <button
            onClick={startRecording}
            style={{ backgroundColor: currentTheme.primary }}
            className="px-4 py-2 text-white rounded"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 text-white rounded"
            style={{ backgroundColor: currentTheme.primary }}
          >
            Stop Recording
          </button>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;