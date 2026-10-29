'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { useGoogleGmailStatus } from '@/hooks/useGoogleGmailStatus';

interface GoogleGmailConnectProps {
  compact?: boolean;
  className?: string;
  onConnectionChange?: (connected: boolean) => void;
}

export function GoogleGmailConnect({
  compact = false,
  className = '',
  onConnectionChange,
}: GoogleGmailConnectProps) {
  const { isDarkMode, elementColors } = useTheme();
  const {
    isConnected,
    isLoading,
    error,
    email,
    needsReauth,
    connect,
    disconnect,
    refresh,
  } = useGoogleGmailStatus();

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const accentColor = elementColors?.button || '#3B82F6';

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    const success = await disconnect();
    setIsDisconnecting(false);
    setShowConfirmDisconnect(false);
    if (success && onConnectionChange) {
      onConnectionChange(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 size={compact ? 16 : 20} className="animate-spin text-gray-400" />
        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Checking Gmail...
        </span>
      </div>
    );
  }

  if (needsReauth) {
    return (
      <div className={className}>
        <div
          className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center ${
            isDarkMode ? 'border-yellow-800/50 bg-yellow-900/20' : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 text-yellow-500" />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Gmail needs re-authorization
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                Your Gmail connection has expired
              </p>
            </div>
          </div>
          <button
            onClick={connect}
            className="w-full shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white sm:w-auto"
            style={{ backgroundColor: accentColor }}
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  if (isConnected) {
    if (compact) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <CheckCircle2 size={16} className="text-green-500" />
          <span className={`truncate text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {email || 'Connected'}
          </span>
          <button
            onClick={() => setShowConfirmDisconnect(true)}
            className="rounded p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Disconnect"
          >
            <Unlink size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          </button>
        </div>
      );
    }

    return (
      <div className={className}>
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
            isDarkMode ? 'border-green-800/30 bg-green-900/10' : 'border-green-200 bg-green-50'
          }`}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Mail size={20} style={{ color: accentColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Gmail Connected
              </span>
            </div>
            <p className={`mt-0.5 truncate text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {email}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:shrink-0">
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/gmail/send-digest', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    alert(`✅ Digest email sent to ${email} with ${data.taskCount} task(s)!`);
                  } else {
                    alert(`⚠️ ${data.error || data.message || 'Failed to send digest email'}`);
                  }
                } catch {
                  alert('Failed to send digest email. Please try again.');
                }
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isDarkMode ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
              title="Send test digest email now"
            >
              <Mail size={13} />
              Test Send
            </button>
            <button
              onClick={refresh}
              className={`rounded-lg p-2 transition-colors ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
              title="Refresh status"
            >
              <RefreshCw size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setShowConfirmDisconnect(true)}
              className={`rounded-lg p-2 transition-colors ${
                isDarkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'
              }`}
              title="Disconnect Gmail"
            >
              <Unlink size={16} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showConfirmDisconnect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`mt-2 rounded-lg border p-3 ${
                  isDarkMode ? 'border-red-800/30 bg-red-900/20' : 'border-red-200 bg-red-50'
                }`}
              >
                <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                  Disconnect Gmail?
                </p>
                <p className={`mt-1 text-xs ${isDarkMode ? 'text-red-400/70' : 'text-red-600/70'}`}>
                  You will no longer receive daily 12:00 PM task digest emails until you reconnect.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setShowConfirmDisconnect(false)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="flex items-center justify-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white"
                  >
                    {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
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

  if (compact) {
    return (
      <button
        onClick={connect}
        className={`flex items-center gap-2 text-sm ${
          isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
        } ${className}`}
      >
        <Mail size={16} />
        Connect Gmail
        <ExternalLink size={12} />
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={connect}
        className={`flex w-full items-center gap-3 rounded-xl border p-4 transition-all ${
          isDarkMode
            ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }`}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Mail size={20} style={{ color: accentColor }} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Connect Gmail
          </span>
          <p className={`mt-0.5 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Receive daily important task summaries at 12:00 PM
          </p>
        </div>
        <ExternalLink size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
      </button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default GoogleGmailConnect;
