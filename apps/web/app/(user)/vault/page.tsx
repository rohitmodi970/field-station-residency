
'use client';

import { useState } from 'react';
import VaultUploader from '@/components/vault/VaultUploader';
import VaultGallery from '@/components/vault/VaultGallery';
import VaultStats from '@/components/vault/VaultStats';
import { Upload, Grid, BarChart3, RefreshCw, Search } from 'lucide-react';

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery' | 'stats'>('gallery');
  const [filterFolder, setFilterFolder] = useState<'mydrive' | 'journal' | 'onboarding' | 'all'>('all');
  const [filterType, setFilterType] = useState<'image' | 'audio' | 'video' | 'document' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab('gallery');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Media Vault</h1>
          <p className="text-gray-600">Store and manage your media files</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-2 pb-4 px-2 border-b-2 transition ${
                activeTab === 'gallery'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-5 h-5" />
              Gallery
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 pb-4 px-2 border-b-2 transition ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5" />
              Upload
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 pb-4 px-2 border-b-2 transition ${
                activeTab === 'stats'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Statistics
            </button>
          </div>
        </div>

        {/* Filters + Search (gallery tab) */}
        {activeTab === 'gallery' && (
          <div className="mb-6 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Folder</label>
              <select
                value={filterFolder}
                onChange={(e) => setFilterFolder(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Folders</option>
                <option value="mydrive">My Drive</option>
                <option value="journal">Journal</option>
                <option value="onboarding">Onboarding</option>
              </select>
            </div>

            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="audio">Audio</option>
                <option value="video">Videos</option>
                <option value="document">Documents</option>
              </select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search file names..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => setRefreshKey(k => k + 1)}
                  title="Refresh"
                  className="px-3 py-2 bg-white border rounded-lg shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setActiveTab('upload'); }}
                  title="Upload"
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg shadow-sm flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          {activeTab === 'upload' && (
            <VaultUploader onUploadSuccess={handleUploadSuccess} />
          )}

          {activeTab === 'gallery' && (
            <VaultGallery
              key={`${refreshKey}-${searchQuery}`}
              filterFolder={filterFolder}
              filterType={filterType}
              search={searchQuery}
              onRefresh={() => setRefreshKey(prev => prev + 1)}
            />
          )}

          {activeTab === 'stats' && <VaultStats key={refreshKey} />}
        </div>
      </div>
    </div>
  );
}