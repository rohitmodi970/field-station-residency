"use client"

import React, { useState } from 'react';
import { useJournals } from '@/hooks/useJournals';
import ModernJournalCard from './ModernJournalCard';
import { Search, Filter, SortAsc, SortDesc, Plus, Loader2 } from 'lucide-react';
import { JournalFilters, SortOptions } from '@/types/database';
import { useRouter } from 'next/navigation';

interface JournalListViewProps {
  initialFilters?: JournalFilters;
  showCreateButton?: boolean;
  emptyMessage?: string;
}

const JournalListView: React.FC<JournalListViewProps> = ({
  initialFilters,
  showCreateButton = true,
  emptyMessage = 'No journals yet. Start writing!'
}) => {
  void initialFilters;
  const router = useRouter();
  const { journals, loading, update } = useJournals();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOptions['field']>('date');
  const [sortOrder, setSortOrder] = useState<SortOptions['order']>('desc');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Filter and sort journals
  const filteredJournals = journals
    .filter(journal => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = journal.title?.toLowerCase().includes(query);
        const matchesContent = journal.content?.toLowerCase().includes(query);
        const matchesTags = journal.tags?.some(tag => tag.toLowerCase().includes(query));
        if (!matchesTitle && !matchesContent && !matchesTags) return false;
      }

      // Tag filter
      if (filterTags.length > 0) {
        const hasTag = filterTags.some(tag => journal.tags?.includes(tag));
        if (!hasTag) return false;
      }

      // Archived filter
      if (!showArchived && journal.is_archived) return false;

      // Favorites filter
      if (showFavoritesOnly && !journal.is_favorite) return false;

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'word_count':
          comparison = a.word_count - b.word_count;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get all unique tags
  const allTags = Array.from(
    new Set(journals.flatMap(j => j.tags || []))
  ).sort();

  const handleFavorite = async (journalId: string, isFavorite: boolean) => {
    try {
      await update(journalId, { is_favorite: isFavorite });
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const handleArchive = async (journalId: string, isArchived: boolean) => {
    try {
      await update(journalId, { is_archived: isArchived });
    } catch (error) {
      console.error('Failed to update archive:', error);
    }
  };

  const handleCreateNew = () => {
    router.push('/journal/new');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading journals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Journals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredJournals.length} {filteredJournals.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        {showCreateButton && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Entry</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journals..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOptions['field'])}
              className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="date">Date</option>
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="title">Title</option>
              <option value="word_count">Words</option>
            </select>
            <button
              onClick={toggleSortOrder}
              className="p-1.5 hover:bg-secondary rounded transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Favorites Toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showFavoritesOnly
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border hover:bg-secondary'
            }`}
          >
            Favorites
          </button>

          {/* Archived Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showArchived
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border hover:bg-secondary'
            }`}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                multiple
                value={filterTags}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilterTags(selected);
                }}
                className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary max-h-20"
              >
                {allTags.map(tag => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Filters */}
        {filterTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            {filterTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTags(prev => prev.filter(t => t !== tag))}
                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
              >
                #{tag} ×
              </button>
            ))}
            <button
              onClick={() => setFilterTags([])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Journal Grid */}
      {filteredJournals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{emptyMessage}</p>
          {showCreateButton && (
            <button
              onClick={handleCreateNew}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Your First Entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJournals.map(journal => (
            <ModernJournalCard
              key={journal.id}
              journal={journal}
              onFavorite={handleFavorite}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalListView;
