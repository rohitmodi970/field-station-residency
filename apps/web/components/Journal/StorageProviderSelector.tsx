/* eslint-disable */
"use client"

import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, CheckCircle2, Info } from 'lucide-react';
import { StorageProvider } from '@/types/database';

interface StorageProviderSelectorProps {
  currentProvider: StorageProvider;
  onProviderChange: (provider: StorageProvider) => Promise<void>;
  disabled?: boolean;
}

const StorageProviderSelector: React.FC<StorageProviderSelectorProps> = ({
  currentProvider,
  onProviderChange,
  disabled = false
}) => {
  const [selectedProvider, setSelectedProvider] = useState<StorageProvider>(currentProvider);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setSelectedProvider(currentProvider);
  }, [currentProvider]);

  const providers = [
    {
      id: 'supabase' as StorageProvider,
      name: 'Supabase Storage',
      description: 'Fast, integrated cloud storage with 1GB free',
      icon: Cloud,
      pros: ['Fast uploads', 'Automatic backups', 'Built-in CDN'],
      cons: ['1GB free limit'],
      color: 'text-green-500'
    },
    {
      id: 'google_drive' as StorageProvider,
      name: 'Google Drive',
      description: 'Store files in your Google Drive (15GB free)',
      icon: HardDrive,
      pros: ['15GB free storage', 'Cross-platform access', 'Familiar interface'],
      cons: ['Slower uploads', 'Requires Google account'],
      color: 'text-blue-500'
    },
    {
      id: 'both' as StorageProvider,
      name: 'Both (Recommended)',
      description: 'Use both storage providers for redundancy',
      icon: CheckCircle2,
      pros: ['Automatic redundancy', 'Best of both worlds', 'Maximum reliability'],
      cons: ['Double storage usage'],
      color: 'text-purple-500'
    }
  ];

  const handleProviderSelect = async (provider: StorageProvider) => {
    if (provider === selectedProvider || disabled) return;

    setIsUpdating(true);
    try {
      await onProviderChange(provider);
      setSelectedProvider(provider);
    } catch (error) {
      console.error('Failed to update storage provider:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="w-4 h-4" />
        <span>Choose where to store your journal media files</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isSelected = selectedProvider === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => handleProviderSelect(provider.id)}
              disabled={disabled || isUpdating}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50 bg-card'
                }
                ${disabled || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              )}

              <div className="flex items-start gap-3 mb-3">
                <Icon className={`w-6 h-6 ${provider.color} shrink-0`} />
                <div>
                  <h3 className="font-semibold text-sm">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {provider.description}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400 mb-1">Pros:</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {provider.pros.map((pro, idx) => (
                      <li key={idx}>• {pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-orange-600 dark:text-orange-400 mb-1">Cons:</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {provider.cons.map((con, idx) => (
                      <li key={idx}>• {con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {isUpdating && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          <span>Updating storage provider...</span>
        </div>
      )}
    </div>
  );
};

export default StorageProviderSelector;
