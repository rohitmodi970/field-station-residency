"use client"
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { X, Send, Zap, Sparkles, Check, Eye, MessageSquareQuote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from '@/utilities/context/ThemeContext';
import { resolveJournalContent } from '@/utilities/journalTitle';
import ForceParticles from './Chatbot/ForceParticles';

// Add shimmer animation styles
const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  memorySource?: 'vektori' | 'legacy' | 'none';
  categories?: ('mechanical' | 'preference' | 'narrative' | 'reflective')[];
  reflectiveOffer?: {
    id: string;
    status: 'pending' | 'accepted' | 'refined' | 'dismissed';
  };
}

interface ForceChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  journalEntry: {
    title: string;
    content: string;
    voiceTranscript?: string;
    tags: string[];
    mood?: string;
    date: string;
  };
  userProfile?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
}

const ForceChatbot: React.FC<ForceChatbotProps> = ({
  isOpen,
  onClose,
  journalEntry,
  userProfile,
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chatbot opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      
      // Send initial greeting if no messages (quiet, judgment-preserving companion persona)
      if (messages.length === 0) {
        const greeting = userProfile?.name 
          ? `Hello ${userProfile.name}. I am Force, your reflective companion. I've quietly reviewed "${journalEntry.title}". I'm here to listen, notice recurring threads, and offer gentle observations without taking over your judgment. What is sitting with you today?`
          : `Hello. I am Force, your reflective companion. I've quietly reviewed "${journalEntry.title}". I'm here to listen, notice recurring threads, and offer gentle observations without taking over your judgment. What is sitting with you today?`;
        
        setMessages([
          {
            role: 'assistant',
            content: greeting,
            categories: ['narrative'],
          },
        ]);
      }
    }
  }, [isOpen]);

  const buildSystemContext = () => {
    const contextParts = [];
    const resolvedContent = resolveJournalContent({
      content: journalEntry.content,
      transcript: journalEntry.voiceTranscript,
    });

    if (userProfile) {
      contextParts.push('USER PROFILE:');
      if (userProfile.name) contextParts.push(`Name: ${userProfile.name}`);
      if (userProfile.email) contextParts.push(`Email: ${userProfile.email}`);
    }

    contextParts.push('\nJOURNAL ENTRY:');
    contextParts.push(`Title: ${journalEntry.title}`);
    contextParts.push(`Date: ${journalEntry.date}`);
    if (journalEntry.mood) contextParts.push(`Mood: ${journalEntry.mood}`);
    if (journalEntry.tags.length > 0) contextParts.push(`Tags: ${journalEntry.tags.join(', ')}`);
    contextParts.push(`\nContent:\n${resolvedContent.value || journalEntry.content || ''}`);

    return contextParts.join('\n');
  };

  const handleOfferFeedback = async (
    messageIndex: number,
    offerId: string,
    decision: 'accepted' | 'refined' | 'dismissed'
  ) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === messageIndex && m.reflectiveOffer
          ? { ...m, reflectiveOffer: { ...m.reflectiveOffer, status: decision } }
          : m
      )
    );

    try {
      await fetch('/api/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reflective_feedback',
          offerId,
          decision,
        }),
      });
    } catch {
      // silent fallback
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (overrideText === undefined) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemContext: buildSystemContext(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      const messageContent = data.message || '';

      // Infer categories present in the response
      const categories: ('mechanical' | 'preference' | 'narrative' | 'reflective')[] = [];
      const lower = messageContent.toLowerCase();
      if (lower.includes('pattern') || lower.includes('over time') || lower.includes('consistently') || lower.includes('observe')) {
        categories.push('reflective');
      }
      if (lower.includes('intent') || lower.includes('relationship') || lower.includes('working through') || lower.includes('goal')) {
        categories.push('narrative');
      }
      if (lower.includes('prefer') || lower.includes('usually') || lower.includes('routine')) {
        categories.push('preference');
      }
      if (lower.includes('expire') || lower.includes('deadline') || lower.includes('due') || lower.includes('date')) {
        categories.push('mechanical');
      }
      if (categories.length === 0) categories.push('narrative');

      const isReflectiveOffer = categories.includes('reflective') || lower.includes('notice') || lower.includes('pattern');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: messageContent,
          memorySource: data.memory_source,
          categories,
          reflectiveOffer: isReflectiveOffer
            ? {
                id: `offer-${Date.now()}`,
                status: 'pending',
              }
            : undefined,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <style key="force-shimmer-style" dangerouslySetInnerHTML={{ __html: shimmerStyles }} />
      <motion.div
        key="force-chatbot-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full md:w-150 lg:w-175 shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{
          background: isDarkMode ? '#1a1a1a' : '#FBFBF8',
        }}
      >
        {/* 3D Canvas Background */}
        <div className="absolute inset-0 z-0">
          <Canvas
            camera={{ position: [0, 0, 7], fov: 60 }}
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.5} />
              <ForceParticles 
                isThinking={isLoading} 
                isHovered={isHovered}
                primaryColor={currentTheme.primary}
                secondaryColor={currentTheme.secondary || currentTheme.primary}
                accentColor={currentTheme.accent || currentTheme.primary}
              />
              <OrbitControls 
                enableZoom={false} 
                enablePan={false} 
                rotateSpeed={0.5} 
                autoRotate={isLoading}
                autoRotateSpeed={5}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Grain Texture Overlay */}
        <div 
          className="absolute inset-0 z-5 pointer-events-none opacity-[0.08] mix-blend-multiply"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
          }} 
        />

        {/* UI Layer */}
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          {/* Header */}
          <div className="p-6 flex justify-between items-start pointer-events-auto relative">
            {/* Shiny gradient overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background: `linear-gradient(135deg, ${currentTheme.primary}10 0%, transparent 30%, ${currentTheme.accent || currentTheme.primary}15 70%, transparent 100%)`,
              }}
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-mono tracking-tighter mix-blend-multiply"
                  style={{ color: isDarkMode ? '#ffffff' : currentTheme.primary }}>
                Force
              </h1>
              <p className="text-sm mt-1 opacity-80 font-mono"
                 style={{ color: isDarkMode ? '#9ca3af' : currentTheme.secondary || currentTheme.primary }}>
                Your reflection companion
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors"
              style={{
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: currentTheme.primary
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pointer-events-auto"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
            }}
          >
            <div className="min-h-full flex flex-col justify-end max-w-2xl mx-auto pb-20">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 font-mono text-sm mb-8 animate-pulse">
                  Ask your reflection companion anything...
                </div>
              )}
              
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex w-full mb-4 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] p-4 font-mono text-sm leading-relaxed shadow-lg whitespace-pre-wrap relative overflow-hidden ${
                      message.role === 'user'
                        ? 'text-white transform rotate-1'
                        : isDarkMode 
                          ? 'bg-white bg-opacity-10 text-white border border-dashed transform -rotate-1'
                          : 'bg-white text-gray-900 border border-dashed transform -rotate-1'
                    }`}
                    style={{
                      backgroundColor: message.role === 'user' ? currentTheme.primary : undefined,
                      borderColor: message.role === 'assistant' ? currentTheme.accent || currentTheme.secondary : undefined,
                      boxShadow: `4px 4px 0px rgba(0,0,0,0.1), inset 0 0 20px ${message.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    {/* Shimmer effect */}
                    <div 
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        background: `linear-gradient(110deg, transparent 40%, ${message.role === 'user' ? 'rgba(255,255,255,0.3)' : currentTheme.primary + '30'} 50%, transparent 60%)`,
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 3s infinite',
                      }}
                    />
                    {message.role === 'assistant' 
                      ? message.content.split('\n').map((paragraph, i) => (
                          paragraph.trim() && (
                            <p key={i} className="mb-3 last:mb-0">
                              {paragraph}
                            </p>
                          )
                        ))
                      : message.content
                    }

                    {/* Reflective Memory Offer Action Card (Section 2.4 & 10) */}
                    {message.role === 'assistant' && message.reflectiveOffer && (
                      <div
                        className="relative z-10 mt-3 rounded-lg border p-3 text-xs"
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)',
                          borderColor: `${currentTheme.primary}33`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-[#b36b3f]">
                          <Sparkles size={13} />
                          <span>Reflective Observation</span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-80">
                          {message.reflectiveOffer.status === 'pending'
                            ? 'Presented as an observation for you to affirm or dismiss — judgment stays with you.'
                            : message.reflectiveOffer.status === 'accepted'
                              ? '✓ Observation affirmed — incorporated into your reflective memory.'
                              : message.reflectiveOffer.status === 'refined'
                                ? '✎ Observation marked for refinement.'
                                : '✕ Observation dismissed — will not steer synthesis.'}
                        </p>

                        {message.reflectiveOffer.status === 'pending' && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-1 border-t border-black/5">
                            <button
                              onClick={() => handleOfferFeedback(index, message.reflectiveOffer!.id, 'accepted')}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors"
                            >
                              <Check size={11} /> Accept
                            </button>
                            <button
                              onClick={() => {
                                handleOfferFeedback(index, message.reflectiveOffer!.id, 'refined');
                                setInput('I want to refine that observation: ');
                                inputRef.current?.focus();
                              }}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
                            >
                              <MessageSquareQuote size={11} /> Refine
                            </button>
                            <button
                              onClick={() => handleOfferFeedback(index, message.reflectiveOffer!.id, 'dismissed')}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-zinc-600 bg-zinc-500/10 hover:bg-zinc-500/20 transition-colors"
                            >
                              <X size={11} /> Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Memory metadata and categories badge */}
                    {message.role === 'assistant' && (message.memorySource || message.categories) && (
                      <div
                        className="relative z-10 mt-3 border-t pt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] opacity-75"
                        style={{ borderColor: `${currentTheme.accent || currentTheme.secondary}44` }}
                      >
                        <span>
                          Source: {message.memorySource === 'vektori' ? 'Vektori' : message.memorySource === 'legacy' ? 'Legacy fallback' : 'Direct'}
                        </span>
                        {message.categories && message.categories.length > 0 && (
                          <div className="flex gap-1.5">
                            {message.categories.map((cat) => (
                              <span
                                key={cat}
                                className="rounded px-1.5 py-0.5 text-[9px] font-medium tracking-normal capitalize"
                                style={{
                                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                                  color: currentTheme.primary,
                                }}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex w-full justify-start mb-4"
                >
                  <div 
                    className="p-3 font-mono text-xs flex items-center gap-2 transform -rotate-1"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white',
                      color: currentTheme.primary,
                      border: `1px dashed ${currentTheme.accent || currentTheme.secondary}`,
                      boxShadow: `4px 4px 0px ${currentTheme.accent || currentTheme.secondary}40`,
                    }}
                  >
                    <Zap size={14} className="animate-spin" />
                    <span>Channeling quiet reflection...</span>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
        </div>

          {/* Input Area & Quick Reflection Chips */}
          <div 
            className="p-6 pointer-events-auto flex flex-col items-center w-full"
            style={{
              background: `linear-gradient(to top, ${isDarkMode ? '#1a1a1a' : '#FBFBF8'}, transparent)`,
            }}
          >
            {/* Quick chips */}
            <div className="w-full max-w-2xl mb-3 flex flex-wrap gap-2 justify-center">
              {[
                { label: '✨ Notice quiet patterns', text: 'What subtle patterns or threads have you noticed across my recent journal entries?' },
                { label: '🌱 Standing intentions', text: 'What ongoing threads or intentions am I currently carrying that need care?' },
                { label: '🎯 One small next action', text: 'Given where my energy is right now, what is one small next action that would help?' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => sendMessage(chip.text)}
                  disabled={isLoading}
                  className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-mono text-[#3a2818] shadow-sm hover:bg-white transition-all disabled:opacity-50"
                  style={{
                    borderColor: `${currentTheme.primary}33`,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="w-full max-w-2xl relative group"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Shiny border animation */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${currentTheme.primary}40, transparent)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite',
                  filter: 'blur(8px)',
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your thoughts here..."
                disabled={isLoading}
                className="w-full font-mono p-4 pr-12 focus:outline-none focus:ring-4 transition-all placeholder:text-gray-400 disabled:opacity-50"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'white',
                  color: isDarkMode ? 'white' : currentTheme.primary,
                  border: `2px solid ${currentTheme.primary}`,
                  borderRadius: '0px',
                  boxShadow: `8px 8px 0px ${currentTheme.primary}`,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors disabled:opacity-30"
                style={{ color: currentTheme.primary }}
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ForceChatbot;
