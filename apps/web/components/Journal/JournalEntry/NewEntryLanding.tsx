"use client"
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, FileText, Check, RefreshCw, PenLine, Zap, Bookmark, ChevronRight, Layout, Image, Layers, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import ReactMarkdown from 'react-markdown';
import BulkJournalImport from '@/components/Journal/BulkImport/BulkJournalImport';

// Define template type
interface Template {
  id: string;
  title: string;
  description: string;
  content: string;
  icon: React.ReactNode;
  tags: string[];
  journalType: string;
}

// Define OCR API response types
interface OCRImage {
  content_type: string;
  content: string;
}

interface OCRPage {
  markdown: string;
  images?: OCRImage[];
}

interface OCRResponse {
  pages?: OCRPage[];
  text?: string;
  content?: string;
}

// Props interface for the component
interface NewEntryLandingProps {
  onStartNewEntry: (props: {
    title: string;
    content: string;
    tags: string[];
    journalType: string;
  }) => void;
  quickLink?: 'blank' | 'template' | 'ocr' | 'bulk';
  templateId?: string;
  onBack?: () => void;
}

const NewEntryLanding: React.FC<NewEntryLandingProps> = ({ 
  onStartNewEntry, 
  quickLink,
  templateId,
  onBack
}) => {
  // Get theme context
  const { currentTheme, isDarkMode, elementColors, currentFont } = useTheme();
  
  // States for OCR functionality
  const [files, setFiles] = useState<File[]>([]);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'blank' | 'template' | 'ocr' | 'bulk'>(() => quickLink || 'blank');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [error, setError] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<string>('');
  
  // State for title extracted from OCR
  const [ocrTitle, setOcrTitle] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartBlankEntry = useCallback(() => {
    onStartNewEntry({
      title: '',
      content: '',
      tags: [],
      journalType: 'personal'
    });
  }, [onStartNewEntry]);

  // Templates for journal entries
  const templates: Template[] = useMemo(() => [
    {
      id: 'daily-reflection',
      title: 'Daily Reflection',
      description: 'Reflect on your day with guided prompts',
      content: `What went well today?\n\nWhat challenges did I face?\n\nWhat am I grateful for?\n\nWhat did I learn today?\n\nHow do I feel right now?`,
      icon: <PenLine size={24} />,
      tags: ['reflection', 'daily'],
      journalType: 'personal'
    },
    {
      id: 'gratitude-journal',
      title: 'Gratitude Journal',
      description: 'Focus on things you\'re thankful for',
      content: `Three things I'm grateful for today:\n\n1. \n\n2. \n\n3. \n\nWhy these matter to me:\n\nHow gratitude is changing my perspective:`,
      icon: <Zap size={24} />,
      tags: ['gratitude', 'positivity'],
      journalType: 'gratitude'
    },
    {
      id: 'goal-setting',
      title: 'Goal Setting',
      description: 'Plan and track your goals',
      content: `My goal:\n\nWhy this matters to me:\n\nSteps to achieve this:\n\n1. \n\n2. \n\n3. \n\nPotential obstacles and solutions:\n\nDeadline:`,
      icon: <Bookmark size={24} />,
      tags: ['goals', 'planning'],
      journalType: 'goals'
    },
    {
      id: 'creative-writing',
      title: 'Creative Writing',
      description: 'Express your creativity',
      content: `Story title:\n\nMain character(s):\n\nSetting:\n\nPlot idea:\n\n`,
      icon: <FileText size={24} />,
      tags: ['creative', 'writing'],
      journalType: 'creative'
    }
  ], []);

  // Handle quick links
  useEffect(() => {
    if (quickLink) {
      setActiveTab(quickLink);
      
      // If quickLink is blank, start a blank entry immediately
      if (quickLink === 'blank') {
        handleStartBlankEntry();
      }
      
      // If quickLink is template and templateId is provided
      if (quickLink === 'template' && templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          setSelectedTemplate(template);
          // Auto-start with the selected template
          setTimeout(() => {
            onStartNewEntry({
              title: template.title,
              content: template.content,
              tags: template.tags,
              journalType: template.journalType
            });
          }, 100);
        }
      }
      
      // If quickLink is ocr, trigger file input
      if (quickLink === 'ocr') {
        setTimeout(() => {
          triggerFileInput();
        }, 500);
      }
    }
  }, [quickLink, templateId, handleStartBlankEntry, onStartNewEntry, templates]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check total count
    if (files.length + selectedFiles.length > 10) {
      setError('Maximum 10 files allowed. Please remove some files before adding more.');
      return;
    }

    setFiles(prev => [...prev, ...selectedFiles]);
    setExtractedText('');
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Process API response to combine markdown text with base64 images
  const processApiResponse = (data: OCRResponse) => {
    let combinedMarkdown = "";
    if (data.pages && Array.isArray(data.pages)) {
      data.pages.forEach((page: OCRPage, pageIndex: number) => {
        let pageMarkdown = page.markdown;

        if (page.images && Array.isArray(page.images) && page.images.length > 0) {
          // Replace image placeholders with actual base64 data URIs
          pageMarkdown = pageMarkdown.replace(/!\[(img-\d+\.\w+)\]\(\1\)/g, (match: string, imageName: string) => {
            const imageIndexMatch = imageName.match(/img-(\d+)/);
            if (!imageIndexMatch || !imageIndexMatch[1]) return match;

            const imageIndex = parseInt(imageIndexMatch[1], 10);

            if (page.images && page.images[imageIndex]) {
              const imageData = page.images[imageIndex];
              if (imageData.content_type && imageData.content) {
                const imageSrc = `data:${imageData.content_type};base64,${imageData.content}`;
                return `![${imageName}](${imageSrc})`;
              }
            }
            return match;
          });
        }

        combinedMarkdown += pageMarkdown;

        if (data.pages && pageIndex < data.pages.length - 1) {
          combinedMarkdown += "\n\n---\n\n"; // Page separator
        }
      });
    } else {
      // If no pages array, try to extract text directly
      if (data.text) {
        combinedMarkdown = data.text;
      } else if (data.content) {
        combinedMarkdown = data.content;
      } else {
        combinedMarkdown = "No content found in the response";
      }
    }
    return combinedMarkdown;
  };

  const processDocument = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setExtractedText('');
    setError('');
    setProcessingProgress('Preparing files...');

    try {
      // Step 1: Get presigned URLs for all files
      const fileMetadata = files.map(file => ({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      }));

      setProcessingProgress('Getting upload URLs...');
      const presignedResponse = await fetch('/api/ocr/presigned-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileMetadata })
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URLs');
      }

      const { uploads } = await presignedResponse.json();

      // Step 2: Upload files directly to Supabase Storage
      setProcessingProgress('Uploading files...');
      const uploadPromises = uploads.map(async (upload: any, index: number) => {
        const file = files[index];
        if (!file) {
          throw new Error(`Missing file for upload at index ${index}`);
        }
        
        const uploadResponse = await fetch(upload.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return {
          filePath: upload.filePath,
          fileName: upload.fileName,
          mimeType: file.type
        };
      });

      const uploadedFileData = await Promise.all(uploadPromises);

      // Step 3: Process OCR from uploaded files
      setProcessingProgress(`Processing ${files.length} file(s)...`);
      const processResponse = await fetch('/api/ocr/process-from-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadedFileData })
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'OCR processing failed');
      }

      const data = await processResponse.json();
      
      console.log('[OCR] API Response:', data);
      
      // Use combined text from batch processing
      const combinedText = data.combinedText || '';
      console.log('[OCR] Combined text:', combinedText);
      console.log('[OCR] Combined text length:', combinedText.length);
      
      setExtractedText(combinedText);
      setProcessingProgress('Complete!');
      
      // Extract title from first line if possible
      const lines: string[] = combinedText.split('\n').filter((line: string) => line.trim().length > 0);
      if (lines.length > 0 && lines[0]) {
        // Use the first line as title if it's not too long and not a file separator
        const potentialTitle = lines[0].trim().replace(/^===\s*/, '').replace(/\s*===$/, '');
        if (potentialTitle.length <= 50 && !potentialTitle.includes('===')) {
          setOcrTitle(potentialTitle);
        }
      }

      // Show summary if some files failed
      if (data.failedFiles > 0) {
        setError(`Note: ${data.failedFiles} of ${data.totalFiles} file(s) failed to process.`);
      }
      
      console.log('[OCR] extractedText state set to:', combinedText);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err instanceof Error ? err.message : 'Error processing document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const resetOcr = () => {
    setFiles([]);
    setExtractedText('');
    setOcrTitle('');
    setError('');
    setProcessingProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartWithOcr = () => {
    onStartNewEntry({
      title: ocrTitle || 'Extracted Journal Entry',
      content: extractedText,
      tags: ['extracted'],
      journalType: 'personal'
    });
  };

  const handleStartWithTemplate = () => {
    if (selectedTemplate) {
      onStartNewEntry({
        title: selectedTemplate.title,
        content: selectedTemplate.content,
        tags: selectedTemplate.tags,
        journalType: selectedTemplate.journalType
      });
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  // Theme-based styles
  const headerBgStyle = {
    background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.hover} 100%)`
  };
  const activeTabStyle = { color: currentTheme.primary, borderBottomColor: currentTheme.primary };
  const iconBgStyle = { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : currentTheme.light };
  const buttonStyle = { 
    backgroundColor: elementColors.button,
    color: '#ffffff',
    boxShadow: `0 10px 24px ${currentTheme.primary}40`
  };
  const selectedTemplateStyle = {
    borderColor: currentTheme.primary,
    backgroundColor: isDarkMode ? `${currentTheme.primary}24` : currentTheme.light
  };
  const selectedTemplateBgStyle = {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : currentTheme.light
  };
  const palette = {
    panelBg: isDarkMode ? 'rgba(43, 24, 40, 0.88)' : 'rgba(255, 247, 252, 0.96)',
    panelBorder: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(223, 126, 174, 0.45)',
    tabBg: isDarkMode ? 'rgba(35, 19, 33, 0.9)' : 'rgba(255, 238, 246, 0.86)',
    tabBorder: isDarkMode ? 'rgba(236, 72, 153, 0.25)' : 'rgba(223, 126, 174, 0.32)',
    tabIdle: isDarkMode ? '#f6cbe3' : '#7b2853',
    heading: isDarkMode ? '#fff1f8' : '#4f1636',
    body: isDarkMode ? '#f6cbe3' : '#7b2853',
    bodyMuted: isDarkMode ? '#d8a7c2' : '#8e2f5f',
  };

  // If there's a quickLink that has already triggered an action, return null to prevent UI flicker
  if ((quickLink === 'blank') || (quickLink === 'template' && templateId && selectedTemplate)) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6" style={{ fontFamily: 'var(--font-family)' }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden border" style={{ backgroundColor: palette.panelBg, borderColor: palette.panelBorder }}>
        <div style={headerBgStyle} className="px-6 py-6 md:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">New Journal Entry</h1>
              <p className="mt-1 text-white/90">Choose how you want to start your journal entry</p>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 cursor-pointer"
                title="Back to previous page"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex overflow-x-auto border-b" style={{ backgroundColor: palette.tabBg, borderColor: palette.tabBorder }}>
          <button
            onClick={() => setActiveTab('blank')}
            className={`min-w-52 flex-1 py-4 px-5 text-sm font-semibold tracking-wide text-center transition-colors md:text-base ${
              activeTab === 'blank' ? 'border-b-2' : ''
            }`}
            style={activeTab === 'blank' ? activeTabStyle : { color: palette.tabIdle }}
          >
            <div className="flex justify-center items-center gap-2">
              <PenLine size={18} />
              <span>Start from Scratch</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`min-w-52 flex-1 py-4 px-5 text-sm font-semibold tracking-wide text-center transition-colors md:text-base ${
              activeTab === 'template' ? 'border-b-2' : ''
            }`}
            style={activeTab === 'template' ? activeTabStyle : { color: palette.tabIdle }}
          >
            <div className="flex justify-center items-center gap-2">
              <Layout size={18} />
              <span>Use Template</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`min-w-52 flex-1 py-4 px-5 text-sm font-semibold tracking-wide text-center transition-colors md:text-base ${
              activeTab === 'ocr' ? 'border-b-2' : ''
            }`}
            style={activeTab === 'ocr' ? activeTabStyle : { color: palette.tabIdle }}
          >
            <div className="flex justify-center items-center gap-2">
              <Image size={18} />
              <span>Extract from Image</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`min-w-52 flex-1 py-4 px-5 text-sm font-semibold tracking-wide text-center transition-all md:text-base ${
              activeTab === 'bulk'
                ? 'border-b-2 border-amber-500'
                : ''
            }`}
            style={activeTab === 'bulk' ? { color: '#f59e0b', borderColor: '#f59e0b' } : { color: palette.tabIdle }}
          >
            <div className="flex justify-center items-center gap-2">
              <Layers size={18} className={activeTab === 'bulk' ? 'text-amber-500' : ''} />
              <span>Bulk Import</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                activeTab === 'bulk'
                  ? 'bg-amber-500 text-white'
                  : isDarkMode
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-amber-100 text-amber-600'
              }`}>Beta</span>
            </div>
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5 md:p-8" style={{ backgroundColor: isDarkMode ? 'rgba(43, 24, 40, 0.72)' : 'rgba(255, 252, 254, 0.96)' }}>
          {/* Blank Entry Tab */}
          {activeTab === 'blank' && (
            <motion.div 
              className="py-10 md:py-12 flex flex-col items-center text-center"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div 
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={iconBgStyle}
                variants={itemVariants}
              >
                <PenLine size={40} style={{ color: currentTheme.primary }} />
              </motion.div>
              <motion.h2
                variants={itemVariants}
                className="text-xl font-bold mb-3"
                style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
              >
                Start with a Blank Page
              </motion.h2>
              <motion.p variants={itemVariants} className="max-w-md mb-8" style={{ color: palette.bodyMuted }}>
                Begin with a clean slate and write whatever comes to mind. 
                Perfect for free-form journaling without any constraints.
              </motion.p>
              <motion.button
                variants={itemVariants}
                onClick={handleStartBlankEntry}
                className="px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                style={buttonStyle}
              >
                Start expressing <ChevronRight size={18} />
              </motion.button>
            </motion.div>
          )}
  
          {/* Template Tab */}
          {activeTab === 'template' && (
            <motion.div 
              className="py-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.h2
                variants={itemVariants}
                className="text-xl font-bold mb-6"
                style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
              >
                Choose a Template
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    variants={itemVariants}
                    className={`border rounded-lg p-5 cursor-pointer hover:shadow-md transition-all ${
                      isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    } ${
                      selectedTemplate?.id === template.id 
                        ? 'shadow-md' 
                        : ''
                    }`}
                    style={selectedTemplate?.id === template.id ? selectedTemplateStyle : undefined}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-start">
                      <div className="p-3 rounded-full mr-4"
                        style={selectedTemplate?.id === template.id 
                          ? selectedTemplateBgStyle
                          : { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                      >
                        {template.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg" style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                          {template.title}
                        </h3>
                        <p className="text-sm mb-2" style={{ color: palette.bodyMuted }}>{template.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {template.tags.map(tag => (
                            <span 
                              key={tag} 
                              className={`text-xs px-2 py-1 rounded-full ${
                                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <motion.div variants={itemVariants} className="mt-8 flex justify-center">
                <button
                  onClick={handleStartWithTemplate}
                  disabled={!selectedTemplate}
                  className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 ${
                    !selectedTemplate && 'opacity-50 cursor-not-allowed'
                  } transition-colors`}
                  style={selectedTemplate ? buttonStyle : {
                    backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                    color: isDarkMode ? '#9CA3AF' : '#9CA3AF'
                  }}
                >
                  Use Selected Template <ChevronRight size={18} />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* OCR Tab */}
          {activeTab === 'ocr' && (
            <motion.div 
              className="py-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.h2 variants={itemVariants} className="text-xl font-bold mb-2">Extract Text from Document</motion.h2>
              <motion.p variants={itemVariants} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'} mb-6`}>
                Upload an image or PDF document and we'll extract the content for your journal entry using AI
              </motion.p>
              
              <motion.div variants={itemVariants} className="mb-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    handleFileUpload(e);
                    e.target.value = ''; // Reset to allow selecting the same file again
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.avif,.heic,.heif"
                  multiple
                  className="hidden"
                />
                
                <div 
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    files.length > 0 
                      ? `${isDarkMode ? 'border-green-600 bg-green-900 bg-opacity-20' : 'border-green-400 bg-green-50'}`
                      : `${isDarkMode 
                          ? 'border-gray-600 hover:border-gray-400 hover:bg-gray-800' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`
                  }`}
                >
                  {files.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <Check className={`h-12 w-12 ${isDarkMode ? 'text-green-400' : 'text-green-500'} mb-2`} />
                      <p className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} font-medium`}>{files.length} document(s) uploaded</p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Click to add more (max 10 total)</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className={`h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'} mb-2`} />
                      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} font-medium`}>Click to upload documents</p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Supports PDF, JPG, PNG, JPEG, AVIF, HEIC, HEIF • Multiple files allowed</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {files.length > 0 && (
                <>
                  <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="mb-6"
                  >
                    <div className="flex justify-between mb-2">
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Uploaded Files ({files.length}/10)</span>
                      <button
                        onClick={resetOcr}
                        className={`text-sm font-medium ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
                      >
                        Remove All
                      </button>
                    </div>
                    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-4 space-y-2`}>
                      {files.map((file, index) => (
                        <div key={index} className={`flex justify-between items-center ${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded p-2`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} truncate`}>
                              {file.name}
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className={`ml-2 px-2 py-1 text-xs rounded ${isDarkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-600 hover:bg-red-50'}`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex gap-4 mb-6"
                  >
                    <button
                      onClick={processDocument}
                      disabled={isProcessing}
                      className={`flex items-center justify-center px-4 py-2 rounded-md text-white font-medium flex-1 ${
                        isProcessing ? 'bg-gray-400 cursor-not-allowed' : ''
                      }`}
                      style={isProcessing ? undefined : buttonStyle}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {processingProgress || 'Processing Documents...'}
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Extract Text from {files.length} Document{files.length > 1 ? 's' : ''}
                        </>
                      )}
                    </button>
                  </motion.div>

                  {error && (
                    <motion.div 
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      className="mb-6"
                    >
                      <div className={`${isDarkMode ? 'bg-red-900 bg-opacity-50 border-red-700' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
                        <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                          {error}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {extractedText && (
                    <motion.div 
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} mb-2`}>Extracted Text</h3>
                      
                      <div className="mb-6">
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Title</label>
                        <input 
                          type="text"
                          value={ocrTitle}
                          onChange={(e) => setOcrTitle(e.target.value)}
                          placeholder="Journal Entry Title"
                          className={`w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white focus:ring-opacity-50' 
                              : 'border border-gray-300 focus:ring-opacity-50'
                          }`}
                          style={{ 
                            borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                            '--focus-ring-color': currentTheme.primary
                          } as React.CSSProperties}
                        />
                      </div>
                      
                      <div className={`${
                        isDarkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-gray-50 border-gray-200'
                      } border rounded-lg p-4 mb-6 max-h-60 overflow-y-auto`}>
                        <div className={`prose prose-sm max-w-none ${
                          isDarkMode ? 'prose-invert' : ''
                        }`}>
                          <ReactMarkdown>{extractedText}</ReactMarkdown>
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                        <button
                          onClick={handleStartWithOcr}
                          className="px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                          style={buttonStyle}
                        >
                          Continue with Extracted Text <ChevronRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                  
                </>
              )}
            </motion.div>
          )}

          {/* Bulk Import Tab */}
          {activeTab === 'bulk' && (
            <BulkJournalImport onBack={onBack || (() => setActiveTab('blank'))} />
          )}
        </div>
      </div>
    </div>
  );
};

export default NewEntryLanding;