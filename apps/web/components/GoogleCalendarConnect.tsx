// apps/web/components/GoogleCalendarConnect.tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  CheckCircle2, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  Unlink,
  AlertTriangle
} from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { useGoogleCalendarStatus } from '@/hooks/useGoogleCalendarStatus';

interface GoogleCalendarConnectProps {
  /** Compact mode for inline display */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback after connection change */
  onConnectionChange?: (connected: boolean) => void;
}

export function GoogleCalendarConnect({
  compact = false,
  className = '',
  onConnectionChange,
}: GoogleCalendarConnectProps) {
  const { isDarkMode, elementColors } = useTheme();
  const {
    isConnected,
    isLoading,
    error,
    email,
    calendarName,
    needsReauth,
    connect,
    disconnect,
    refresh,
  } = useGoogleCalendarStatus();

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const accentColor = elementColors?.button || '#3B82F6';

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    const success = await disconnect();
    setIsDisconnecting(false);
    setShowConfirmDisconnect(false);
    if (success && onConnectionChange) {
      onConnectionChange(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 size={compact ? 16 : 20} className="animate-spin text-gray-400" />
        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Checking calendar...
        </span>
      </div>
    );
  }

  // Needs re-authentication
  if (needsReauth) {
    return (
      <div className={`${className}`}>
        <div className={`
          flex items-center gap-3 p-3 rounded-lg border
          ${isDarkMode ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-yellow-50 border-yellow-200'}
        `}>
          <AlertTriangle size={20} className="text-yellow-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Calendar needs re-authorization
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
              Your Google Calendar connection has expired
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 text-sm font-medium rounded-lg text-white shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  // Connected state
  if (isConnected) {
    if (compact) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <CheckCircle2 size={16} className="text-green-500" />
          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {email || 'Connected'}
          </span>
          <button
            onClick={() => setShowConfirmDisconnect(true)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
            title="Disconnect"
          >
            <Unlink size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          </button>
        </div>
      );
    }

    return (
      <div className={`${className}`}>
        <div className={`
          flex items-center gap-3 p-4 rounded-xl border
          ${isDarkMode ? 'bg-green-900/10 border-green-800/30' : 'bg-green-50 border-green-200'}
        `}>
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Calendar size={20} style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Google Calendar Connected
              </span>
            </div>
            <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {email} {calendarName && `• ${calendarName}`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={refresh}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
              title="Refresh status"
            >
              <RefreshCw size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setShowConfirmDisconnect(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-500'
              }`}
              title="Disconnect calendar"
            >
              <Unlink size={16} />
            </button>
          </div>
        </div>

        {/* Disconnect confirmation */}
        <AnimatePresence>
          {showConfirmDisconnect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`
                mt-2 p-3 rounded-lg border
                ${isDarkMode ? 'bg-red-900/20 border-red-800/30' : 'bg-red-50 border-red-200'}
              `}>
                <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                  Disconnect Google Calendar?
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-red-400/70' : 'text-red-600/70'}`}>
                  Calendar events won't be synced until you reconnect.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowConfirmDisconnect(false)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white flex items-center gap-1"
                  >
                    {isDisconnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Unlink size={14} />
                    )}
                    Disconnect
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Not connected state
  if (compact) {
    return (
      <button
        onClick={handleConnect}
        className={`
          flex items-center gap-2 text-sm
          ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}
          ${className}
        `}
      >
        <Calendar size={16} />
        Connect Calendar
        <ExternalLink size={12} />
      </button>
    );
  }

  return (
    <div className={`${className}`}>
      <button
        onClick={handleConnect}
        className={`
          w-full flex items-center gap-3 p-4 rounded-xl border transition-all
          ${isDarkMode 
            ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600' 
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
          }
        `}
      >
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Calendar size={20} style={{ color: accentColor }} />
        </div>
        <div className="flex-1 text-left">
          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Connect Google Calendar
          </span>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Sync your calendar events and add actions directly
          </p>
        </div>
        <ExternalLink size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export default GoogleCalendarConnect;
