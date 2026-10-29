// apps/web/components/ActionOptionsModal.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  ListTodo, 
  Calendar as CalendarIcon, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { announceTaskAdded } from '@/utils/notifications/taskAddedNotifier';

export interface ActionData {
  icon: string;
  title: string;
  reason: string;
  duration: string;
  category: 'health' | 'productivity' | 'social' | 'wellbeing';
}

interface ActionOptionsModalProps {
  action: ActionData | null;
  journalId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type Priority = 'low' | 'medium' | 'high';

interface FormState {
  addToGoals: boolean;
  addToTodo: boolean;
  addToCalendar: boolean;
  dueDate: string;
  reminderAt: string;
  followUpDetails: string;
  priority: Priority;
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-500', textColor: 'text-gray-600' },
  medium: { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  high: { label: 'High', color: 'bg-red-500', textColor: 'text-red-600' },
};

const categoryColors = {
  health: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  productivity: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  social: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  wellbeing: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
};

export function ActionOptionsModal({
  action,
  journalId,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: ActionOptionsModalProps) {
  const { isDarkMode, elementColors } = useTheme();
  
  const [form, setForm] = useState<FormState>({
    addToGoals: true,
    addToTodo: true,
    addToCalendar: false,
    dueDate: '',
    reminderAt: '',
    followUpDetails: '',
    priority: 'medium',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

  // Check Google Calendar connection status
  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/calendar/status')
        .then(res => res.json())
        .then(data => setCalendarConnected(data.connected))
        .catch(() => setCalendarConnected(false));
    }
  }, [isOpen]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setForm({
        addToGoals: true,
        addToTodo: true,
        addToCalendar: false,
        dueDate: '',
        reminderAt: '',
        followUpDetails: '',
        priority: 'medium',
      });
    }
  }, [isOpen]);

  const toIsoOrNull = (value: string): string | null => {
    if (!value?.trim()) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!action) return;
    
    // Must select at least one option
    if (!form.addToGoals && !form.addToTodo && !form.addToCalendar) {
      onError('Please select at least one option');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const results: string[] = [];
      let actionId: string | null = null;
      let autoTodoDueDate: string | null = null;
      const safeJournalId = journalId.startsWith('temp_') ? null : journalId;

      const ensureAction = async () => {
        const response = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icon: action.icon,
            title: action.title,
            reason: action.reason,
            duration: action.duration,
            category: action.category,
            journal_id: safeJournalId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add to goals');
        }

        const data = await response.json();
        actionId = data.action?.id || null;

        if (form.addToGoals) {
          if (data.duplicate) {
            results.push('Goal already active');
          } else {
            results.push('Added to Goals');
          }
        }
      };

      // 1. Add to Goals (user_actions table)
      if (form.addToGoals || form.addToTodo) {
        await ensureAction();
      }

      // 2. Add to Todo (auto-generates due date, priority, and reminder timing)
      let touchedTodo = false;
      if (form.addToTodo) {
        if (!actionId) {
          throw new Error('Unable to create task without action');
        }

        const dueDateIso = toIsoOrNull(form.dueDate);
        const reminderIso = toIsoOrNull(form.reminderAt);

        const response = await fetch(`/api/actions/${actionId}/add-to-todo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auto_generate: true,
            journal_id: safeJournalId,
            priority: form.priority,
            due_date: dueDateIso,
            reminder_at: reminderIso,
            context_details: form.followUpDetails.trim() || null,
          }),
        });

        if (response.ok) {
          const payload = await response.json();
          autoTodoDueDate = payload?.todo?.due_date || null;
          touchedTodo = true;
          if (payload?.mode === 'reminder' || payload?.reminder_created) {
            results.push(`Reminder set for ${payload?.todo?.title || action.title}`);
          } else {
            results.push(`Added to Tasks: ${payload?.todo?.title || action.title}`);
          }
          if (payload?.todo?.title) {
            announceTaskAdded({ title: payload.todo.title, source: 'action' });
          }
          if (payload?.calendar_reminder_created) {
            results.push('Calendar reminder added');
          }
        } else if (response.status === 409) {
          const payload = await response.json().catch(() => ({}));
          touchedTodo = true;
          if (payload?.mode === 'reminder') {
            results.push('Reminder already exists');
          } else {
            results.push('Task already exists');
          }
        } else {
          console.error('Failed to add to todo');
        }
      }

      // Notify any open todo views to refresh immediately.
      if (touchedTodo && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('force:todo-updated'));
      }

      // 3. Add to Google Calendar
      const calendarStartIso = toIsoOrNull(form.dueDate) || autoTodoDueDate;
      if (form.addToCalendar && calendarConnected && calendarStartIso) {
        const startDate = new Date(calendarStartIso);
        const calendarPayload = {
          title: action.title,
          description: action.reason,
          start: startDate.toISOString(),
          end: new Date(startDate.getTime() + 30 * 60 * 1000).toISOString(), // 30 min event
          action_id: actionId,
        };

        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calendarPayload),
        });
        
        if (response.ok) {
          results.push('Added to Calendar');
        } else {
          console.error('Failed to add to calendar');
        }
      } else if (form.addToCalendar && calendarConnected && !calendarStartIso) {
        results.push('Calendar event skipped (no auto time available)');
      }

      // Success message
      onSuccess(results.length > 0 ? results.join(' • ') : 'Action saved!');
      onClose();
    } catch (err) {
      console.error('Error saving action:', err);
      onError('Failed to save action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!action) return null;

  const colors = categoryColors[action.category];
  const accentColor = elementColors?.button || '#3B82F6';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`
        w-[calc(100vw-1rem)] max-w-2xl p-0 gap-0 overflow-hidden
        max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh]
        flex flex-col
        ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}
      `}>
        {/* Header with action preview */}
        <div className={`p-4 sm:p-5 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className={`text-3xl p-2 rounded-xl ${colors.bg}`}>
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className={`text-lg font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {action.title}
                </DialogTitle>
                <DialogDescription className={`mt-1 text-sm line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {action.reason}
                </DialogDescription>
                <div className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                  <Clock size={12} />
                  {action.duration}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Options */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            What would you like to do with this action?
          </p>

          {/* Add to Goals */}
          <label className={`
            flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
            ${form.addToGoals 
              ? isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
              : isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'
            }
            border
          `}>
            <input
              type="checkbox"
              checked={form.addToGoals}
              onChange={(e) => updateForm('addToGoals', e.target.checked)}
              className="sr-only"
            />
            <div className={`
              w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
              ${form.addToGoals 
                ? 'bg-blue-500 border-blue-500' 
                : isDarkMode ? 'border-gray-600' : 'border-gray-300'
              }
            `}>
              {form.addToGoals && <CheckCircle2 size={14} className="text-white" />}
            </div>
            <Target size={20} className={form.addToGoals ? 'text-blue-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
            <div className="flex-1">
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Add to Goals
              </span>
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Track this as an active goal
              </p>
            </div>
          </label>

          {/* Add to Todo */}
          <div className="space-y-3">
            <label className={`
              flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
              ${form.addToTodo 
                ? isDarkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200'
                : isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'
              }
              border
            `}>
              <input
                type="checkbox"
                checked={form.addToTodo}
                onChange={(e) => updateForm('addToTodo', e.target.checked)}
                className="sr-only"
              />
              <div className={`
                w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                ${form.addToTodo 
                  ? 'bg-purple-500 border-purple-500' 
                  : isDarkMode ? 'border-gray-600' : 'border-gray-300'
                }
              `}>
                {form.addToTodo && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <ListTodo size={20} className={form.addToTodo ? 'text-purple-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Add to Tasks
                </span>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  One click: timing, priority, and reminders are auto-set
                </p>
              </div>
            </label>
          </div>

          {/* Follow-up details for better task/reminder generation */}
          {form.addToTodo && (
            <div className={`rounded-xl border p-3 space-y-3 ${isDarkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white'}`}>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Add follow-up details
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  If the journal context is incomplete, add specifics so Force can create a better task or reminder.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Preferred due time (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={(e) => updateForm('dueDate', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Reminder time (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.reminderAt}
                    onChange={(e) => updateForm('reminderAt', e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Priority
                </label>
                <div className="flex gap-2">
                  {(Object.keys(priorityConfig) as Priority[]).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => updateForm('priority', priority)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                        form.priority === priority
                          ? isDarkMode
                            ? 'border-pink-500 bg-pink-500/20 text-pink-200'
                            : 'border-pink-400 bg-pink-50 text-pink-700'
                          : isDarkMode
                            ? 'border-gray-700 bg-gray-900 text-gray-300'
                            : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {priorityConfig[priority].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Extra context (optional)
                </label>
                <textarea
                  value={form.followUpDetails}
                  onChange={(e) => updateForm('followUpDetails', e.target.value)}
                  rows={4}
                  placeholder="Add anything helpful: who this is for, constraints, location, expected outcome, or any missing info."
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
                />
              </div>
            </div>
          )}

          {/* Add to Calendar */}
          <label className={`
            flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
            ${!calendarConnected ? 'opacity-60' : ''}
            ${form.addToCalendar && calendarConnected
              ? isDarkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'
              : isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'
            }
            border
          `}>
            <input
              type="checkbox"
              checked={form.addToCalendar}
              onChange={(e) => calendarConnected && updateForm('addToCalendar', e.target.checked)}
              disabled={!calendarConnected}
              className="sr-only"
            />
            <div className={`
              w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
              ${form.addToCalendar && calendarConnected
                ? 'bg-green-500 border-green-500' 
                : isDarkMode ? 'border-gray-600' : 'border-gray-300'
              }
            `}>
              {form.addToCalendar && calendarConnected && <CheckCircle2 size={14} className="text-white" />}
            </div>
            <CalendarIcon size={20} className={form.addToCalendar && calendarConnected ? 'text-green-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
            <div className="flex-1">
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Add to Google Calendar
              </span>
              {calendarConnected === false ? (
                <p className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                  <AlertCircle size={12} />
                  Connect calendar in Settings
                </p>
              ) : calendarConnected === null ? (
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Checking connection...
                </p>
              ) : (
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create a calendar event
                </p>
              )}
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className={`
          sticky bottom-0 p-3 sm:p-4 border-t flex gap-3
          ${isDarkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}
        `}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`
              flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors
              ${isDarkMode 
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              disabled:opacity-50
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!form.addToGoals && !form.addToTodo && !form.addToCalendar)}
            className={`
              flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-all
              flex items-center justify-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            style={{ 
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 4px 14px ${accentColor}40`,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Save Action
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ActionOptionsModal;
