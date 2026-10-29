import React, { useState, useRef, useEffect, useCallback } from "react";
import JournalEditor from "./GalleryComponent/JournalEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/quilted-gallery/ui/tabs";
import { useTheme } from "@/utilities/context/ThemeContext";
import { JournalEntry } from "./types";
import JournalCalendar from "./JournalCalendar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import ThemeSidebar from "../Navbar/ThemeSidebar";
import { 
  AnalysisCard, 
  StatsCard, 
  HistoryList, 
  DateNavigator, 
  EntryCard, 
  EmptyState,
  QuickFilters 
} from './EnhancedComponents';

interface JournalGalleryProps {
  entries: JournalEntry[];
}

interface Emotion {
  emotion: string;
  frequency: number;
  intensity: number;
}
interface MoodPattern {
  pattern: string;
  significance: string;
  recommendation: string;
}
interface Topic {
  topic: string;
  frequency?: number;
  context?: string[];
  sentiment?: number;
}
interface KeyInsight {
  insight: string;
  evidence?: string[];
  significance?: string;
}
interface SentimentAnalysisResults {
  overallSentiment?: { label: string; score: number; confidence: number };
  emotionalPatterns?: {
    primaryEmotions?: Emotion[];
    secondaryEmotions?: Emotion[];
  };
  insights?: {
    moodPatterns?: MoodPattern[];
  };
  sentimentTrends?: { date: string; sentiment: number }[];
}
interface TextualAnalysisResults {
  topics?: Topic[];
  keyInsights?: KeyInsight[];
}
interface AnalysisResults extends SentimentAnalysisResults, TextualAnalysisResults {
  error?: string;
}

// Add a type for history entries
interface AnalysisHistoryEntry {
  id: string;
  date: string;
  type: 'sentiment' | 'textual';
  range: string;
  results: AnalysisResults;
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFormattedDisplayDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
};

const JournalGallery: React.FC<JournalGalleryProps> = ({ entries }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateScrollerRef = useRef<HTMLDivElement>(null);
  const [analysisDateRange, setAnalysisDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    selectedDates: Date[];
  }>({
    startDate: null,
    endDate: null,
    selectedDates: []
  });
  const [analysisType, setAnalysisType] = useState<'sentiment' | 'textual'>('sentiment');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tab, setTab] = useState<'analyze' | 'history'>('analyze');
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  console.log("History:", history);
  
  // Load history from database
  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch('/api/analysis/history?limit=20');
        if (response.ok) {
          const { history: dbHistory } = await response.json();
          const formattedHistory = dbHistory.map((entry: any) => ({
            id: entry.id,
            date: new Date(entry.created_at).toLocaleString(),
            type: entry.analysis_type,
            range: entry.date_range,
            results: entry.results,
          }));
          setHistory(formattedHistory);
        }
      } catch (error) {
        console.error('Error loading analysis history:', error);
      } finally {
        setHistoryLoading(false);
      }
    }
    
    loadHistory();
  }, []);
  // Generate dates for the date scroller (past 30 days and future 7 days)
  const generateDateRange = () => {
    const today = new Date();
    const dates = [];
    
    // Past 30 days
    for (let i = 30; i > 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    
    // Today
    dates.push(today);
    
    // Future 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };
  
  const dateRange = generateDateRange();
  
  // Group entries by date for easy lookup
  const entriesByDate: Record<string, JournalEntry[]> = {};
  
  entries.forEach(entry => {
    const { date } = entry;
    if (!entriesByDate[date]) {
      entriesByDate[date] = [];
    }
    entriesByDate[date].push(entry);
  });

  // Scroll to selected date when component mounts or selected date changes
  useEffect(() => {
    if (dateScrollerRef.current) {
      const selectedDateIndex = dateRange.findIndex(date => 
        formatDate(date) === formatDate(selectedDate)
      );
      
      if (selectedDateIndex !== -1) {
        const scrollElement = dateScrollerRef.current.children[selectedDateIndex] as HTMLElement;
        dateScrollerRef.current.scrollLeft = scrollElement.offsetLeft - 100; // Center it with some offset
      }
    }
  }, [selectedDate, dateRange]);
  
  // Navigate to previous/next day
  const navigateDay = (direction: 'prev' | 'next'): void => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(newDate);
  };

  const hasEntries = (date: Date): boolean => {
    const formatted = formatDate(date);
    return !!(entriesByDate[formatted] && entriesByDate[formatted].length > 0);
  };
  
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };
  
  // Dynamic styles based on theme
  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#4A5568' : '#E2E8F0',
    color: elementColors.text
  };

  const getDateButtonClass = (date: Date) => {
    const isSelected = formatDate(date) === formatDate(selectedDate);
    const hasJournalEntries = hasEntries(date);
    
    let className = "flex flex-col items-center p-1.5 sm:p-2 rounded-lg min-w-12 sm:min-w-16 mx-0.5 sm:mx-1 transition-colors ";
    
    if (isSelected) {
      className += "border-2 ";
    } else {
      className += "border ";
    }
    
    return className;
  };

  const getDateButtonStyle = (date: Date) => {
    const isSelected = formatDate(date) === formatDate(selectedDate);
    const hasJournalEntries = hasEntries(date);
    const _isToday = isToday(date);
    
    // Base style
    const style: React.CSSProperties = {
      borderColor: isSelected ? currentTheme.primary : (isDarkMode ? '#4A5568' : '#E2E8F0'),
      color: elementColors.text
    };
    
    // Background color
    if (isSelected) {
      style.backgroundColor = isDarkMode ? `${currentTheme.active}30` : `${currentTheme.light}`;
    } else if (hasJournalEntries) {
      style.backgroundColor = isDarkMode ? `${currentTheme.active}15` : `${currentTheme.light}40`;
    } else {
      style.backgroundColor = isDarkMode ? '#374151' : '#F8FAFC';
    }
    
    // Today indicator
    if (_isToday && !isSelected) {
      style.borderColor = currentTheme.primary;
    }
    
    return style;
  };

  // Handle refresh entries after saving
  const handleEntrySave = (newEntry: boolean): void => {
    // Here you would typically refresh the entries from the parent component
    console.log("Entry saved, refreshing entries...", newEntry ? "New entry created" : "Entry updated");
  };

  // Handle calendar analysis date selection
  const handleAnalyzeDates = async (
    startDate: Date,
    endDate: Date | null,
    selectedDates: Date[],
    type: 'sentiment' | 'textual'
  ) => {
    setAnalysisType(type);
    setAnalysisDateRange({ startDate, endDate, selectedDates });
    setIsAnalyzing(true);
    setAnalysisResults(null);
    // Filter entries by selected dates
    let filteredEntries: JournalEntry[] = [];
    if (selectedDates.length > 0) {
      const selectedStrs = selectedDates.map(d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      });
      filteredEntries = entries.filter(e => selectedStrs.includes(e.date));
    } else if (startDate) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : start;
      filteredEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
    }
    if (filteredEntries.length === 0) {
      setAnalysisResults({ error: 'No entries found in the selected date(s).' });
      setIsAnalyzing(false);
      return;
    }
    try {
      const response = await fetch('/api/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: filteredEntries,
          analysisType: type,
          dateRange: {
            start: startDate?.toISOString(),
            end: endDate?.toISOString(),
          },
        }),
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setAnalysisResults(data.data);
    } catch {
      setAnalysisResults({ error: 'Failed to analyze entries.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to save current analysis to history
  const saveAnalysisToHistory = async () => {
    if (!analysisResults || isAnalyzing) return;
    
    const range = (() => {
      if (analysisDateRange.selectedDates && analysisDateRange.selectedDates.length > 0) {
        return analysisDateRange.selectedDates.map(d => d.toLocaleDateString()).join(', ');
      }
      if (analysisDateRange.startDate && analysisDateRange.startDate.getTime() !== 0) {
        return `${analysisDateRange.startDate.toLocaleDateString()}${analysisDateRange.endDate ? ` to ${analysisDateRange.endDate.toLocaleDateString()}` : ''}`;
      }
      return 'Recent';
    })();
    
    try {
      // Save to database via API
      const response = await fetch('/api/analysis/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_type: analysisType,
          date_range: range,
          start_date: analysisDateRange.startDate?.toISOString().split('T')[0] || null,
          end_date: analysisDateRange.endDate?.toISOString().split('T')[0] || null,
          selected_dates: analysisDateRange.selectedDates?.map(d => d.toISOString().split('T')[0]) || null,
          results: analysisResults,
        }),
      });
      
      if (response.ok) {
        const { history: savedEntry } = await response.json();
        // Update local history state
        setHistory([
          {
            id: savedEntry.id,
            date: new Date(savedEntry.created_at).toLocaleString(),
            type: savedEntry.analysis_type,
            range: savedEntry.date_range,
            results: savedEntry.results,
          },
          ...history,
        ]);
      } else {
        console.error('Failed to save analysis history');
      }
    } catch (error) {
      console.error('Error saving analysis history:', error);
    }
  };

  // Function to load a history entry
  const loadHistoryEntry = (entry: AnalysisHistoryEntry) => {
    setAnalysisType(entry.type);
    setAnalysisResults(entry.results);
    // Optionally set the date range UI
    // Switch to analyze tab to show loaded results
    setTab('analyze');
  };

  // Function to delete a history entry
  const deleteHistoryEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/analysis/history?id=${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from local state
        setHistory(history.filter(entry => entry.id !== id));
      } else {
        console.error('Failed to delete history entry');
      }
    } catch (error) {
      console.error('Error deleting history entry:', error);
    }
  };

  return (
    <div className="max-w-full lg:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 transition-colors" style={{ color: elementColors.text }}>
      <ThemeSidebar/>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Journal</h1>
        <div className="flex flex-wrap gap-2">
          <span 
            className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full transition-colors"
            style={{ 
              backgroundColor: isDarkMode ? `${currentTheme.active}30` : `${currentTheme.light}`, 
              color: currentTheme.primary 
            }}
          >
            Personal
          </span>
          {/* Show total entries count */}
          <span 
            className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full transition-colors"
            style={{ 
              backgroundColor: isDarkMode ? `${currentTheme.active}30` : `${currentTheme.light}`, 
              color: currentTheme.primary 
            }}
          >
            {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
          </span>
          {/* Show favorites count if any */}
          {entries.filter(e => e.isFavorite).length > 0 && (
            <span 
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full transition-colors"
              style={{ 
                backgroundColor: isDarkMode ? '#FCD34D20' : '#FEF3C7', 
                color: '#F59E0B'
              }}
            >
              ⭐ {entries.filter(e => e.isFavorite).length}
            </span>
          )}
        </div>
      </div>
      
      {/* Centralized Date Navigation */}
      <div 
        className="rounded-lg sm:rounded-xl shadow-sm border p-3 sm:p-4 mb-4 sm:mb-6 transition-colors"
        style={containerStyle}
      >
        {/* Date navigation controls */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <button 
            onClick={() => navigateDay('prev')}
            className="p-1.5 sm:p-2 rounded-full hover:opacity-80 flex items-center justify-center transition-colors"
            aria-label="Previous day"
            style={{ color: elementColors.text }}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h2 className="text-base sm:text-lg md:text-xl font-medium text-center px-2" style={{ color: elementColors.text }}>
            {getFormattedDisplayDate(selectedDate)}
          </h2>
          
          <button 
            onClick={() => navigateDay('next')}
            className="p-1.5 sm:p-2 rounded-full hover:opacity-80 flex items-center justify-center transition-colors"
            aria-label="Next day"
            style={{ color: elementColors.text }}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* Horizontal date scroller */}
        <div className="relative">
          <div 
            ref={dateScrollerRef}
            className="flex overflow-x-auto py-2 scrollbar-thin"
            style={{ 
              scrollBehavior: 'smooth',
              scrollbarColor: `${currentTheme.medium} ${isDarkMode ? '#4A5568' : '#F1F5F9'}`
            }}
          >
            {dateRange.map((date, index) => (
              <button
                key={index}
                onClick={() => setSelectedDate(new Date(date))}
                className={getDateButtonClass(date)}
                style={getDateButtonStyle(date)}
              >
                <span 
                  className="text-xs opacity-75"
                >
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-lg font-semibold">
                  {date.getDate()}
                </span>
                {hasEntries(date) && (
                  <div 
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ backgroundColor: currentTheme.primary }}
                  ></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-4 sm:mt-6">
        <Tabs defaultValue="write" className="w-full">
          <TabsList 
            className="mb-3 sm:mb-4 w-full max-w-full sm:max-w-md"
            
            style={{ 
              backgroundColor: isDarkMode ? '#374151' : '#F1F5F9',
            }}
          >
            <TabsTrigger 
              value="write" 
              className="flex-1 data-[state=active]:text-white text-xs sm:text-sm"
             
              style={{ 
                color: elementColors.text,
                backgroundColor: 'transparent',
                ['--tab-accent' as any]: currentTheme.primary 
              }}
            >
              Write Journal
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              className="flex-1 data-[state=active]:text-white text-xs sm:text-sm"
             
              style={{ 
                color: elementColors.text,
                backgroundColor: 'transparent',
                ['--tab-accent' as any]: currentTheme.primary 
              }}
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 data-[state=active]:text-white text-xs sm:text-sm" onClick={() => setTab('history')}>History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="write" className="mt-0">
            <div className="grid grid-cols-1 gap-6">
              <JournalEditor 
                selectedDate={selectedDate}
                entries={entries}
                onSave={handleEntrySave}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="calendar" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="md:col-span-2">
                <div 
                  className="rounded-xl shadow-sm border p-6 transition-colors"
                  style={containerStyle}
                >
                  <h3 className="text-lg font-medium mb-4" style={{ color: elementColors.text }}>
                    {(() => {
                      // If selectedDates are used (multiple mode)
                      if (analysisDateRange.selectedDates && analysisDateRange.selectedDates.length > 0) {
                        return `Analysis for ${analysisDateRange.selectedDates.map(d => d.toLocaleDateString()).join(' - ')}`;
                      }
                      // If a valid range is used (range mode)
                      if (
                        analysisDateRange.startDate &&
                        analysisDateRange.startDate.getTime() !== 0 // not epoch
                      ) {
                        return `Analysis for ${analysisDateRange.startDate.toLocaleDateString()}${analysisDateRange.endDate ? ` to ${analysisDateRange.endDate.toLocaleDateString()}` : ''}`;
                      }
                      // Fallback
                      return "Recent Insights";
                    })()}
                  </h3>
                  {/* Enhanced Analysis Card */}
                  <AnalysisCard 
                    analysisType={analysisType}
                    results={analysisResults}
                    isAnalyzing={isAnalyzing}
                    dateRange={(() => {
                      if (analysisDateRange.selectedDates && analysisDateRange.selectedDates.length > 0) {
                        return analysisDateRange.selectedDates.map(d => d.toLocaleDateString()).join(' - ');
                      }
                      if (analysisDateRange.startDate && analysisDateRange.startDate.getTime() !== 0) {
                        return `${analysisDateRange.startDate.toLocaleDateString()}${analysisDateRange.endDate ? ` to ${analysisDateRange.endDate.toLocaleDateString()}` : ''}`;
                      }
                      return "No date selected";
                    })()}
                    onSaveToHistory={saveAnalysisToHistory}
                  />
                </div>
              </div>
              
              <div className="md:col-span-1">
                {/* Calendar Component Integration */}
                <JournalCalendar 
                  entries={entries}
                  onAnalyze={handleAnalyzeDates}
                />
                
                {/* Enhanced Stats Card */}
                <StatsCard entries={entries} />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="mt-0">
            <div className="p-4">
              <h3 className="text-lg font-bold mb-4" style={{ color: elementColors.text }}>Analysis History</h3>
              <HistoryList 
                history={history}
                isLoading={historyLoading}
                onLoad={loadHistoryEntry}
                onDelete={deleteHistoryEntry}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default JournalGallery;