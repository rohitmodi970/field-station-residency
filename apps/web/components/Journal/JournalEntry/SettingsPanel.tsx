import React from 'react';
import { Check, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JournalType, ViewMode } from '../types';

interface CacheDraftSummary {
  key: string;
  journalId: string;
  title: string;
  updatedAt: string;
  isSynced: boolean;
  isStale: boolean;
  sizeBytes: number;
}

interface SettingsPanelProps {
  showSettings: boolean;
  viewMode: string;
  journalType: string;
  setJournalType: (type: string) => void;
  setViewMode: (mode: string) => void;
  journalTypes: JournalType[];
  viewModes: ViewMode[];
  styles: any;
  isDarkMode: boolean;
  cacheOwnerLabel: string;
  cacheDrafts: CacheDraftSummary[];
  onRefreshCache: () => void;
  onRemoveCacheDraft: (key: string) => void;
  onClearStaleCache: () => void;
  onClearAllCache: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  showSettings,
  viewMode,
  journalType,
  setJournalType,
  setViewMode,
  journalTypes,
  viewModes,
  styles,
  isDarkMode,
  cacheOwnerLabel,
  cacheDrafts,
  onRefreshCache,
  onRemoveCacheDraft,
  onClearStaleCache,
  onClearAllCache,
}) => {
  return (
    <AnimatePresence>
      {showSettings && viewMode !== 'focus' && (
        <motion.div 
          className="border-b px-4 py-3 transition-all duration-300 md:px-6"
          style={{ backgroundColor: styles.bgCard, borderColor: styles.borderColor }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 rounded-2xl border p-4 md:grid-cols-2"
            style={{ borderColor: styles.borderColor, backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }}
          >
            {/* Journal type selector */}
            <div>
              <h3 
                className="text-sm font-medium mb-3 transition-all duration-300"
                style={{ color: styles.textSecondary }}
              >
                Journal Type
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {journalTypes.map(type => (
                  <button 
                    key={type.id}
                    onClick={() => setJournalType(type.id)}
                    className="flex flex-col items-start p-3 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{ 
                      backgroundColor: journalType === type.id ? styles.primaryLight : isDarkMode ? '#2D3748' : '#F3F4F6',
                      color: journalType === type.id ? styles.primaryColor : styles.textPrimary,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: journalType === type.id ? styles.primaryColor : 'transparent'
                    }}
                  >
                    <div className="flex items-center w-full mb-1">
                      <span className="mr-2" style={{ color: journalType === type.id ? styles.primaryColor : styles.textSecondary }}>
                        {type.icon}
                      </span>
                      <span>{type.name}</span>
                      {journalType === type.id && (
                        <Check size={14} className="ml-auto" style={{ color: styles.primaryColor }} />
                      )}
                    </div>
                    <span 
                      className="text-xs font-normal"
                      style={{ color: styles.textSecondary }}
                    >
                      {type.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* View mode selector */}
            <div>
              <h3 
                className="text-sm font-medium mb-3 transition-all duration-300"
                style={{ color: styles.textSecondary }}
              >
                View Mode
              </h3>
              <div className="flex flex-col gap-2">
                {viewModes.map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)}
                    className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{ 
                      backgroundColor: viewMode === mode.id ? styles.primaryLight : isDarkMode ? '#2D3748' : '#F3F4F6',
                      color: viewMode === mode.id ? styles.primaryColor : styles.textPrimary,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: viewMode === mode.id ? styles.primaryColor : 'transparent'
                    }}
                  >
                    <div className="flex flex-col items-start flex-1">
                      <span>{mode.name}</span>
                      <span 
                        className="text-xs font-normal"
                        style={{ color: styles.textSecondary }}
                      >
                        {mode.description}
                      </span>
                    </div>
                    {viewMode === mode.id && (
                      <Check size={16} style={{ color: styles.primaryColor }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-xl border p-3" style={{ borderColor: styles.borderColor, backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium" style={{ color: styles.textSecondary }}>Draft Cache Manager</h3>
                  <p className="text-xs" style={{ color: styles.textSecondary }}>Scope: {cacheOwnerLabel}. Keeps recent drafts and ignores stale entries.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRefreshCache}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: styles.borderColor, color: styles.textPrimary, backgroundColor: styles.bgCard }}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                  <button
                    type="button"
                    onClick={onClearStaleCache}
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: styles.borderColor, color: styles.textPrimary, backgroundColor: styles.bgCard }}
                  >
                    Clear Stale
                  </button>
                  <button
                    type="button"
                    onClick={onClearAllCache}
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: styles.bgCard }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {cacheDrafts.length === 0 ? (
                <p className="text-xs" style={{ color: styles.textSecondary }}>No cached drafts found for this user.</p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-auto pr-1">
                  {cacheDrafts.map((draft) => (
                    <div
                      key={draft.key}
                      className="flex items-center justify-between rounded-md border px-2 py-2"
                      style={{ borderColor: styles.borderColor, backgroundColor: styles.bgCard }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold" style={{ color: styles.textPrimary }}>{draft.title}</p>
                        <p className="text-[11px]" style={{ color: styles.textSecondary }}>
                          {draft.journalId} · {new Date(draft.updatedAt).toLocaleString()} · {(draft.sizeBytes / 1024).toFixed(1)} KB
                          {draft.isStale ? ' · stale' : ''}
                          {draft.isSynced ? ' · synced' : ' · pending sync'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveCacheDraft(draft.key)}
                        className="ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                        style={{ borderColor: styles.borderColor, color: '#ef4444', backgroundColor: styles.bgCard }}
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;