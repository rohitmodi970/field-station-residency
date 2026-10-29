"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, Image, Music, Video, FileText, AlertTriangle, Info } from 'lucide-react';
import { StorageUsage, MediaType } from '@/types/database';

interface StorageUsageIndicatorProps {
  journalId?: string;
  onStorageUpdate?: (usage: StorageUsage) => void;
}

const StorageUsageIndicator: React.FC<StorageUsageIndicatorProps> = ({
  journalId,
  onStorageUpdate
}) => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStorageUsage = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/storage-usage');
      
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
        onStorageUpdate?.(data.usage);
      }
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    } finally {
      setLoading(false);
    }
  }, [onStorageUpdate]);

  useEffect(() => {
    fetchStorageUsage();
  }, [journalId, fetchStorageUsage]);

  const getMediaTypeIcon = (type: MediaType) => {
    switch (type) {
      case 'image': return Image;
      case 'audio': return Music;
      case 'video': return Video;
      case 'document': return FileText;
    }
  };

  const getMediaTypeColor = (type: MediaType) => {
    switch (type) {
      case 'image': return 'text-blue-500';
      case 'audio': return 'text-purple-500';
      case 'video': return 'text-red-500';
      case 'document': return 'text-green-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HardDrive className="w-4 h-4 animate-pulse" />
        <span>Loading storage...</span>
      </div>
    );
  }

  if (!usage) return null;

  const percentageUsed = usage.limits.percentage_used;
  const isNearLimit = percentageUsed > 80;
  const isOverLimit = percentageUsed > 95;

  return (
    <div className="space-y-3">
      {/* Main Storage Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Storage Usage</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-primary hover:underline"
            >
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {usage.total_size_mb} / {(usage.limits.total / (1024 * 1024 * 1024)).toFixed(1)} GB
            </span>
            {isNearLimit && !isOverLimit && (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            )}
            {isOverLimit && (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isOverLimit 
                ? 'bg-red-500' 
                : isNearLimit 
                ? 'bg-orange-500' 
                : 'bg-primary'
            }`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>

        {/* Warning Messages */}
        {isNearLimit && (
          <div className={`flex items-start gap-2 text-xs p-2 rounded ${
            isOverLimit 
              ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400' 
              : 'bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400'
          }`}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              {isOverLimit 
                ? 'Storage limit reached! Please delete some files or upgrade your plan.' 
                : 'You\'re running low on storage space. Consider deleting unused files.'}
            </p>
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-foreground">Storage by Type</p>
          
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(usage.by_type).map(([type, data]) => {
              const Icon = getMediaTypeIcon(type as MediaType);
              const color = getMediaTypeColor(type as MediaType);
              
              return (
                <div
                  key={type}
                  className="flex items-center gap-2 p-2 rounded bg-card border border-border"
                >
                  <Icon className={`w-4 h-4 ${color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">
                      {type}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{data.count} files</span>
                      <span>{data.size_mb}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Summary */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
            <span className="font-medium text-foreground">Total Files</span>
            <span className="text-muted-foreground">{usage.file_count} files</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageUsageIndicator;
