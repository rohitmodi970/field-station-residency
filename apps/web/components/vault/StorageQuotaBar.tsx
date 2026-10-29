// ===========================================
// components/vault/StorageQuotaBar.tsx - NEW COMPONENT
// ===========================================

'use client';

import { useEffect, useState } from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';

interface StorageInfo {
  used_mb: string;
  limit_mb: number;
  remaining_mb: string;
  usage_percentage: string;
  is_near_limit: boolean;
  is_full: boolean;
}

export default function StorageQuotaBar() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStorageInfo();
  }, []);

  const fetchStorageInfo = async () => {
    try {
      const response = await fetch('/api/vault/storage-info');
      const result = await response.json();

      if (response.ok) {
        setStorageInfo(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch storage info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-2 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (!storageInfo) return null;

  const percentage = parseFloat(storageInfo.usage_percentage);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  return (
    <div className={`p-4 rounded-lg border-2 ${
      isDanger ? 'bg-red-50 border-red-300' :
      isWarning ? 'bg-yellow-50 border-yellow-300' :
      'bg-blue-50 border-blue-300'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className={`w-5 h-5 ${
            isDanger ? 'text-red-600' :
            isWarning ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
          <span className="font-semibold text-gray-900">Storage Usage</span>
        </div>
        {isWarning && (
          <AlertTriangle className={`w-5 h-5 ${
            isDanger ? 'text-red-600' : 'text-yellow-600'
          }`} />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-700">
          <span>{storageInfo.used_mb} MB used</span>
          <span>{storageInfo.limit_mb} MB total</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isDanger ? 'bg-red-600' :
              isWarning ? 'bg-yellow-500' :
              'bg-blue-600'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-600">
            {storageInfo.remaining_mb} MB remaining
          </span>
          <span className={`font-semibold ${
            isDanger ? 'text-red-600' :
            isWarning ? 'text-yellow-600' :
            'text-blue-600'
          }`}>
            {storageInfo.usage_percentage}%
          </span>
        </div>

        {/* Warning Message */}
        {isWarning && (
          <div className={`mt-2 p-2 rounded text-xs ${
            isDanger ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {isDanger
              ? '⚠️ Storage is almost full! Delete some files to free up space.'
              : '⚠️ You are running low on storage space.'}
          </div>
        )}
      </div>
    </div>
  );
}