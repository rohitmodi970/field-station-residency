"use client"

import React, { useState } from 'react';
import { Settings, X, Save } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import StorageProviderSelector from './StorageProviderSelector';
import StorageUsageIndicator from './StorageUsageIndicator';
import { StorageProvider, ThemeMode } from '@/types/database';

interface JournalSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const JournalSettingsPanel: React.FC<JournalSettingsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const { settings, loading, update, updateStorageProvider } = useSettings(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleProviderChange = async (provider: StorageProvider) => {
    try {
      setIsSaving(true);
      await updateStorageProvider(provider);
      setSuccessMessage('Storage provider updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update provider:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIFeaturesToggle = async () => {
    if (!settings) return;
    
    try {
      setIsSaving(true);
      await update({
        ai_features_enabled: !settings.ai_features_enabled
      });
      setSuccessMessage('AI features ' + (!settings.ai_features_enabled ? 'enabled' : 'disabled'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update AI features:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-125 bg-background border-l border-border z-50 overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Journal Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <Save className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-400">
                {successMessage}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Settings Content */}
          {!loading && settings && (
            <>
              {/* Storage Provider */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Storage Provider</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose where to store your journal media files
                  </p>
                </div>
                <StorageProviderSelector
                  currentProvider={settings.storage_provider || 'supabase'}
                  onProviderChange={handleProviderChange}
                  disabled={isSaving}
                />
              </div>

              {/* Storage Usage */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Storage Usage</h3>
                  <p className="text-sm text-muted-foreground">
                    Track your storage consumption across all journals
                  </p>
                </div>
                <StorageUsageIndicator />
              </div>

              {/* AI Features */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">AI Features</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable AI-powered insights, sentiment analysis, and topic extraction
                  </p>
                </div>
                <label className="flex items-center justify-between p-4 bg-card border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Enable AI Analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Get automatic insights from your journal entries
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.ai_features_enabled}
                    onChange={handleAIFeaturesToggle}
                    disabled={isSaving}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                </label>
              </div>

              {/* Storage Scope */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Storage Scope</h3>
                  <p className="text-sm text-muted-foreground">
                    Where to save your journal data
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'device_only', label: 'Device Only', description: 'Store locally, no cloud sync' },
                    { value: 'cloud', label: 'Cloud Only', description: 'Always sync to cloud' },
                    { value: 'both', label: 'Both (Recommended)', description: 'Local + cloud backup' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="storage_scope"
                        value={option.value}
                        checked={settings.storage_scope === option.value}
                        onChange={async (e) => {
                          try {
                            setIsSaving(true);
                            await update({ storage_scope: e.target.value as any });
                            setSuccessMessage('Storage scope updated');
                            setTimeout(() => setSuccessMessage(null), 3000);
                          } catch (error) {
                            console.error('Failed to update scope:', error);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="mt-1 w-4 h-4 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Account Type */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Account Privacy</h3>
                  <p className="text-sm text-muted-foreground">
                    Control who can see your journal entries
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'private', label: 'Private', description: 'Only you can see your entries' },
                    { value: 'public', label: 'Public', description: 'Anyone can view your public entries' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="account_type"
                        value={option.value}
                        checked={settings.account_type === option.value}
                        onChange={async (e) => {
                          try {
                            setIsSaving(true);
                            await update({ account_type: e.target.value as any });
                            setSuccessMessage('Privacy settings updated');
                            setTimeout(() => setSuccessMessage(null), 3000);
                          } catch (error) {
                            console.error('Failed to update privacy:', error);
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="mt-1 w-4 h-4 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default JournalSettingsPanel;
