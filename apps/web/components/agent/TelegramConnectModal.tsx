'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  X,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Mic,
  Calendar,
  Sparkles,
  Film,
  Zap,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramConnectModal: React.FC<TelegramConnectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const BOT_USERNAME = 'force_agent_bot_newbot';
  const TELEGRAM_URL = `https://t.me/${BOT_USERNAME}`;

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function checkUserLinkStatus() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && isMounted) {
          setUserId(user.id);

          // Check if user has an active Telegram external_account
          const { data: accounts } = await supabase
            .from('external_accounts')
            .select('external_id, provider')
            .eq('user_id', user.id)
            .eq('provider', 'telegram')
            .limit(1);

          if (accounts && accounts.length > 0) {
            setIsLinked(true);
          }
        }
      } catch (err) {
        console.warn('[TelegramModal] Failed to check link status:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkUserLinkStatus();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(TELEGRAM_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#DFDAD2] bg-[#FAF7F2] text-[#241A14] shadow-2xl z-10"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-[#2AABEE] to-[#229ED9] p-6 text-white text-left">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-full bg-black/10 p-2 text-white/80 hover:bg-black/20 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white">
                <Send size={24} className="translate-x-[-1px] translate-y-[1px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight">Force on Telegram</h3>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white">
                    24/7 Companion
                  </span>
                </div>
                <p className="text-sm text-white/90 font-mono mt-0.5">@{BOT_USERNAME}</p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 text-left">
            {/* Status Pill */}
            <div className="flex items-center justify-between rounded-2xl border border-[#E6DFD5] bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className={`h-2.5 w-2.5 rounded-full ${isLinked ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <div>
                  <div className="text-xs font-semibold text-[#18110B]">
                    {isLinked ? 'Telegram Connected' : 'Ready to Connect'}
                  </div>
                  <div className="text-[11px] text-[#7A5A3A]">
                    {isLinked
                      ? 'Your account is linked. Messages sync directly with your dashboard.'
                      : 'Send any message to the bot to link with 1 tap.'}
                  </div>
                </div>
              </div>
              {isLinked && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 size={12} />
                  <span>Active</span>
                </div>
              )}
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-[#EBE5DB] bg-white/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#18110B]">
                  <Mic size={14} className="text-[#8f4d30]" />
                  <span>Voice Notes</span>
                </div>
                <p className="mt-1 text-[11px] text-[#7A5A3A] leading-relaxed">
                  Send audio memos on the go. Transcribed and saved to your journal.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EBE5DB] bg-white/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#18110B]">
                  <Film size={14} className="text-[#8f4d30]" />
                  <span>Cinema & Events</span>
                </div>
                <p className="mt-1 text-[11px] text-[#7A5A3A] leading-relaxed">
                  Ask about new releases, theaters, and local spots in real time.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EBE5DB] bg-white/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#18110B]">
                  <Calendar size={14} className="text-[#8f4d30]" />
                  <span>To-Dos & Tasks</span>
                </div>
                <p className="mt-1 text-[11px] text-[#7A5A3A] leading-relaxed">
                  "Remind me tomorrow..." locks straight into your planner.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EBE5DB] bg-white/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#18110B]">
                  <Sparkles size={14} className="text-[#8f4d30]" />
                  <span>Smart Wingman</span>
                </div>
                <p className="mt-1 text-[11px] text-[#7A5A3A] leading-relaxed">
                  Personalized lifestyle companion with high EQ and zero fluff.
                </p>
              </div>
            </div>

            {/* How It Works Explainer */}
            <div className="rounded-2xl border border-[#EBE5DB] bg-[#F3EFEA] p-4 text-xs text-[#5C3E21] space-y-1.5">
              <div className="font-semibold text-[#241A14] flex items-center gap-1.5">
                <Zap size={13} className="text-[#8f4d30]" />
                <span>How Multi-User Access Works:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[#7A5A3A]">
                <li>Every user has their own private Telegram thread.</li>
                <li>Your memories, to-dos, and reflections stay strictly separated and encrypted.</li>
                <li>When you text for the first time, Force sends a 1-click link to pair your account.</li>
              </ul>
            </div>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#229ED9] hover:bg-[#1E88E5] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#229ED9]/20 transition-all cursor-pointer"
              >
                <Send size={15} />
                <span>Open in Telegram</span>
                <ExternalLink size={13} className="opacity-70" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl border border-[#DFDAD2] bg-white hover:bg-[#F3EFEA] px-4 py-3 text-xs font-medium text-[#5C3E21] transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
