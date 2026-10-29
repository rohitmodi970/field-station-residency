'use client';

import { useEffect, useState } from 'react';
import { useGmailIntegration } from '@/hooks/useGmailIntegration';
import {
  Mail,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

export function GmailIntegrationPanel() {
  const {
    isConnected,
    isLoading,
    email,
    needsReauth,
    error,
    connectGmail,
    disconnect,
    checkConnectionStatus,
  } = useGmailIntegration();

  const { decryptTodo } = useAiDecryption();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    message: string;
    taskCount?: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      void checkConnectionStatus();
    }
  }, [checkConnectionStatus]);

  const handleSendTestDigest = async () => {
    try {
      setIsSendingTest(true);
      setTestResult(null);

      // Pre-decrypt current unfinished tasks on client for 100% data fidelity
      let clientTasks: any[] = [];
      try {
        const todoRes = await fetch('/api/ai-todo');
        if (todoRes.ok) {
          const todoData = await todoRes.json();
          const rawTodos = Array.isArray(todoData?.todos) ? todoData.todos : [];
          const unfinished = rawTodos.filter((t: any) => {
            const status = (t.status || '').toLowerCase().trim();
            return status !== 'done' && status !== 'completed';
          });

          clientTasks = await Promise.all(
            unfinished.map(async (row: any) => {
              const fields = await decryptTodo(row);
              return {
                id: row.id,
                title: (fields.title && fields.title.trim()) || (row.title && row.title.trim()) || 'Task',
                description: (fields.description && fields.description.trim()) || (row.description && row.description.trim()) || null,
                category: fields.category || row.category || 'Personal',
                due_date: row.due_date || null,
                priority: row.priority || 'medium',
                is_primary: Boolean(row.is_primary),
                status: row.status || 'pending',
                ai_reasoning: fields.ai_reasoning || row.ai_reasoning || null,
              };
            })
          );
        }
      } catch (err) {
        console.warn('[GmailIntegrationPanel] Client pre-decryption error (falling back to server):', err);
      }

      const res = await fetch('/api/gmail/send-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: clientTasks.length > 0 ? clientTasks : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setTestResult({
          type: 'error',
          message: data.error || data.message || 'Failed to send test digest email.',
          taskCount: data.taskCount,
        });
        return;
      }

      setTestResult({
        type: 'success',
        message: data.message || `Digest email with ${data.taskCount} task(s) sent successfully!`,
        taskCount: data.taskCount,
      });
    } catch (err) {
      setTestResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error while triggering test email.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-4 h-8 w-48 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-gray-200" />
          <div className="h-4 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gmail</h2>
          <p className="mt-1 text-sm text-gray-600">
            {isConnected
              ? `Connected as ${email}`
              : 'Not connected'}
          </p>
        </div>
        {isConnected && (
          <button
            onClick={disconnect}
            disabled={isLoading}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {needsReauth && (
        <div className="flex flex-col gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Gmail needs re-authorization</p>
              <p className="text-xs text-yellow-700">Please reconnect your Gmail account to resume daily task digests.</p>
            </div>
          </div>
          <button
            onClick={connectGmail}
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {!isConnected ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Mail className="h-6 w-6" />
          </div>
          <p className="mb-2 text-base font-semibold text-gray-900">
            Connect Gmail for Daily Task Alerts
          </p>
          <p className="mx-auto mb-5 max-w-md text-sm text-gray-600">
            Connect your Gmail to receive your full daily list of unfinished and high-priority tasks delivered straight to your inbox once a day at 12:00 PM from <span className="font-semibold text-gray-800">work@findmyforce.com</span>.
          </p>
          <button
            onClick={connectGmail}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Connect Gmail
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Daily Digest Active</h3>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Connected
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Your unfinished tasks list will be delivered daily at <span className="font-medium text-gray-800">12:00 PM</span> to <span className="font-medium text-gray-800">{email}</span>.
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Delivery time: 12:00 PM daily
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                    Sender: work@findmyforce.com
                  </span>
                </div>

                {/* Manual Trigger Test Button */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Test Digest Email</p>
                    <p className="text-xs text-gray-500">Send your current unfinished tasks list to your inbox right now.</p>
                  </div>
                  <button
                    onClick={handleSendTestDigest}
                    disabled={isSendingTest}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending Email...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send Digest Now (Test)
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`mt-3 rounded-lg p-3 text-xs ${
                      testResult.type === 'success'
                        ? 'border border-green-200 bg-green-50 text-green-800'
                        : 'border border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {testResult.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span>{testResult.type === 'success' ? 'Email Sent!' : 'Send Failed'}</span>
                    </div>
                    <p className="mt-1">{testResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
