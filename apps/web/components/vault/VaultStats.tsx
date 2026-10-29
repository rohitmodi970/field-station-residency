
'use client';

import { useState, useEffect } from 'react';
import { HardDrive, Image, Music, Video, FileText, Folder, TrendingUp } from 'lucide-react';

interface VaultStatsData {
  total_files: number;
  total_size: number;
  total_size_mb: string;
  storage_limit_mb: number;
  remaining_mb: string;
  usage_percentage: string;
  is_near_limit: boolean;
  by_type: {
    image: number;
    audio: number;
    video: number;
    document: number;
  };
  by_folder: {
    miscellaneous: number;
    specific: number;
  };
  folder_usage: {
    miscellaneous_mb: string;
    specific_mb: string;
  };
}

export default function VaultStats() {
  const [stats, setStats] = useState<VaultStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/vault/stats');
      const result = await response.json();

      if (response.ok) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (!stats) return null;

  const usagePercentage = parseFloat(stats.usage_percentage);
  const isNearLimit = usagePercentage >= 80;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Files</p>
              <p className="text-3xl font-bold mt-1">{stats.total_files}</p>
            </div>
            <HardDrive className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className={`p-6 text-white rounded-lg shadow-lg bg-gradient-to-br ${
          isNearLimit ? 'from-red-500 to-red-600' : 'from-purple-500 to-purple-600'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isNearLimit ? 'text-red-100' : 'text-purple-100'}`}>
                Storage Used
              </p>
              <p className="text-3xl font-bold mt-1">{stats.total_size_mb} MB</p>
              <p className="text-xs mt-1 opacity-90">of {stats.storage_limit_mb} MB</p>
            </div>
            <Folder className={`w-12 h-12 ${isNearLimit ? 'text-red-200' : 'text-purple-200'}`} />
          </div>
        </div>

        <div className={`p-6 text-white rounded-lg shadow-lg bg-gradient-to-br ${
          isNearLimit ? 'from-orange-500 to-orange-600' : 'from-green-500 to-green-600'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isNearLimit ? 'text-orange-100' : 'text-green-100'}`}>
                Usage
              </p>
              <p className="text-3xl font-bold mt-1">{stats.usage_percentage}%</p>
              <p className="text-xs mt-1 opacity-90">{stats.remaining_mb} MB free</p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="transform -rotate-90 w-16 h-16">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className={isNearLimit ? 'text-orange-300' : 'text-green-300'}
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={`${((usagePercentage / 100) * 175.84).toFixed(2)} 175.84`}
                  className="text-white"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {isNearLimit && (
        <div className={`p-4 rounded-lg border-2 ${
          usagePercentage >= 95
            ? 'bg-red-50 border-red-300'
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center gap-3">
            <TrendingUp className={`w-6 h-6 ${
              usagePercentage >= 95 ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <div>
              <p className={`font-semibold ${
                usagePercentage >= 95 ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {usagePercentage >= 95
                  ? '⚠️ Storage Almost Full!'
                  : '⚠️ Running Low on Storage'}
              </p>
              <p className={`text-sm ${
                usagePercentage >= 95 ? 'text-red-700' : 'text-yellow-700'
              }`}>
                Consider deleting unused files to free up space.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* By Type */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Files by Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Image className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Images</p>
              <p className="text-xl font-bold">{stats.by_type.image}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Music className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Audio</p>
              <p className="text-xl font-bold">{stats.by_type.audio}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Videos</p>
              <p className="text-xl font-bold">{stats.by_type.video}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Documents</p>
              <p className="text-xl font-bold">{stats.by_type.document}</p>
            </div>
          </div>
        </div>
      </div>

      {/* By Folder */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Folder Usage</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Miscellaneous</span>
            </div>
            <div className="text-right">
              <p className="font-bold">{stats.by_folder.miscellaneous} files</p>
              <p className="text-sm text-gray-600">{stats.folder_usage.miscellaneous_mb} MB</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-green-600" />
              <span className="font-medium">Specific</span>
            </div>
            <div className="text-right">
              <p className="font-bold">{stats.by_folder.specific} files</p>
              <p className="text-sm text-gray-600">{stats.folder_usage.specific_mb} MB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}