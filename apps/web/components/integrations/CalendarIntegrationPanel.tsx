// apps/web/components/integrations/CalendarIntegrationPanel.tsx
'use client';

import { useState } from 'react';
import { useCalendarIntegration, UseCalendarIntegrationState } from '@/hooks/useCalendarIntegration';
import { formatEventForDisplay } from '@/utilities/calendarIntegration';

export function CalendarIntegrationPanel() {
  const {
    isConnected,
    isSyncing,
    isLoading,
    lastSyncTime,
    events,
    syncStatus,
    error,
    connectCalendar,
    loadEvents,
    disconnect,
    syncToTodo,
    checkConnectionStatus,
  } = useCalendarIntegration();

  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const handleToggleEvent = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(events.map(e => e.id)));
    }
  };

  const handleSyncSelected = async () => {
    if (selectedEvents.size === 0) {
      alert('Please select at least one event');
      return;
    }
    const success = await syncToTodo(Array.from(selectedEvents));
    if (success) {
      setSelectedEvents(new Set());
      alert('Events synced to to-do list!');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Google Calendar</h2>
          <p className="text-gray-600 text-sm mt-1">
            {isConnected 
              ? `Connected as ${syncStatus.calendar?.email}`
              : 'Not connected'}
          </p>
        </div>
        {isConnected && (
          <div className="flex gap-2">
            <button
              onClick={() => loadEvents()}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isSyncing ? 'Refreshing...' : 'Refresh Events'}
            </button>
            <button
              onClick={disconnect}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Not Connected */}
      {!isConnected && (
        <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
          <p className="text-gray-600 mb-4">
            Connect your Google Calendar to sync events with your to-do list
          </p>
          <button
            onClick={connectCalendar}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Calendar
          </button>
        </div>
      )}

      {/* Connected - Show Stats */}
      {isConnected && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-xs font-semibold uppercase">Total Events</p>
              <p className="text-2xl font-bold mt-1">{syncStatus.eventsTotal}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-xs font-semibold uppercase">Cached</p>
              <p className="text-2xl font-bold mt-1">{syncStatus.eventsCached}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-orange-600 text-xs font-semibold uppercase">Unsynced</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{syncStatus.eventsUnsynced}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-green-600 text-xs font-semibold uppercase">Synced</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{syncStatus.eventsSynced}</p>
            </div>
          </div>

          {/* Last Sync Time */}
          {lastSyncTime && (
            <p className="text-xs text-gray-500">
              Last synced: {new Date(lastSyncTime).toLocaleString()}
            </p>
          )}

          {/* Events List */}
          {events.length > 0 ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Upcoming Events</h3>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.size === events.length && events.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                    <span>Select All</span>
                  </label>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {events.map(event => {
                    const formatted = formatEventForDisplay(event);
                    const isSelected = selectedEvents.has(event.id);

                    return (
                      <div
                        key={event.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleEvent(event.id)}
                            className="mt-1 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{formatted.title}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {formatted.dateRange} • {formatted.time}
                            </p>
                            {formatted.location && (
                              <p className="text-xs text-gray-500 mt-1">📍 {formatted.location}</p>
                            )}
                            {event.attendees > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                👥 {event.attendees} attendee{event.attendees !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sync Button */}
              {selectedEvents.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncSelected}
                    disabled={isSyncing}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {isSyncing
                      ? 'Syncing...'
                      : `Sync ${selectedEvents.size} Event${selectedEvents.size !== 1 ? 's' : ''} to To-Do List`}
                  </button>
                  <button
                    onClick={() => setSelectedEvents(new Set())}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No upcoming events found</p>
              <button
                onClick={() => loadEvents()}
                className="mt-2 text-blue-600 text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <p className="font-semibold mb-1">💡 How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Events are automatically fetched from your Google Calendar</li>
              <li>Select the events you want to sync to your to-do list</li>
              <li>Click "Sync to To-Do List" to add them</li>
              <li>Your to-do list stays in sync with selected events</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
