// apps/web/components/Journal/EnhancedComponents/HistoryList.tsx
"use client";

import React from 'react';
import { Clock, TrendingUp, MessageCircle, Trash2, Eye } from 'lucide-react';
import { Card } from '@/components/ui/quilted-gallery/ui/card';
import { useTheme } from '@/utilities/context/ThemeContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface HistoryEntry {
  id: string;
  date: string;
  type: 'sentiment' | 'textual';
  range: string;
  results: any;
}

interface HistoryListProps {
  history: HistoryEntry[];
  isLoading: boolean;
  onLoad: (entry: HistoryEntry) => void;
  onDelete?: (id: string) => void;
}

export default function HistoryList({ history, isLoading, onLoad, onDelete }: HistoryListProps) {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const containerStyle = {
    backgroundColor: elementColors.background,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: elementColors.text,
  };

  if (isLoading) {
    return (
      <Card className="p-6" style={containerStyle}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg animate-pulse"
              style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
            />
          ))}
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-8" style={containerStyle}>
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${currentTheme.primary}20` }}
          >
            <Clock size={32} style={{ color: currentTheme.primary }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">No Analysis History Yet</h3>
            <p className="text-sm opacity-70 max-w-sm mx-auto">
              Your analysis history will appear here. Start analyzing your journals to see patterns over time.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <Card
          key={entry.id}
          className="p-4 hover:shadow-md transition-all cursor-pointer group"
          style={containerStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                {entry.type === 'sentiment' ? (
                  <TrendingUp size={20} style={{ color: currentTheme.primary }} />
                ) : (
                  <MessageCircle size={20} style={{ color: currentTheme.primary }} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold truncate">
                    {entry.type === 'sentiment' ? 'Sentiment Analysis' : 'Textual Analysis'}
                  </h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${currentTheme.primary}20`,
                      color: currentTheme.primary,
                    }}
                  >
                    {entry.type}
                  </span>
                </div>
                
                <p className="text-sm opacity-70 mb-1">{entry.range}</p>
                
                <div className="flex items-center gap-2 text-xs opacity-60">
                  <Clock size={12} />
                  <span>{entry.date}</span>
                </div>

                {/* Preview of results */}
                {entry.results && !entry.results.error && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
                    {entry.type === 'sentiment' && entry.results.overallSentiment && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-70">Mood:</span>
                        <span
                          className="text-xs font-medium capitalize"
                          style={{ color: currentTheme.primary }}
                        >
                          {entry.results.overallSentiment.label}
                        </span>
                        <span className="text-xs opacity-60">
                          ({Math.round(entry.results.overallSentiment.confidence * 100)}%)
                        </span>
                      </div>
                    )}
                    {entry.type === 'textual' && entry.results.topics && entry.results.topics.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-70">Topics:</span>
                        <div className="flex flex-wrap gap-1">
                          {entry.results.topics.slice(0, 3).map((topic: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                              }}
                            >
                              {topic.topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoad(entry);
                }}
                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                style={{
                  backgroundColor: `${currentTheme.primary}20`,
                  color: currentTheme.primary,
                }}
                title="View Analysis"
              >
                <Eye size={16} />
              </button>
              
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(entry.id);
                    setShowDeleteDialog(true);
                  }}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-red-100 dark:hover:bg-red-900/20"
                  style={{ color: '#EF4444' }}
                  title="Delete Analysis"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete analysis?"
        description="This analysis will be permanently removed."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting..."
        onConfirm={() => {
          if (deleteTargetId) {
            onDelete?.(deleteTargetId);
            setShowDeleteDialog(false);
            setDeleteTargetId(null);
          }
        }}
        confirmTone="danger"
      />
    </div>
  );
}
