import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  createBrowserStream,
  persistTinyfishUsageContext,
  type TinyfishCompletionPayload,
} from '@/lib/force-agent/toolAdapters/tinyfish';
import { loadProfile, saveAgentExtras } from '@/lib/agent/profileStore';
import { notificationService } from '@/utils/notifications/notificationService';

/**
 * POST /api/agent/register
 *
 * Accepts { url, eventUrl, goal, prompt, taskType } and streams TinyFish SSE events back to the client.
 * Supports universal autonomous browser automation across any website or search task.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    let rawUrl: string = body.url || body.eventUrl || '';
    const goal: string | undefined = body.goal;
    const prompt: string | undefined = body.prompt;
    const taskType: 'research' | 'action' | 'registration' | 'browse' | undefined = body.taskType;

    if (!rawUrl && !goal && !prompt) {
      return new Response(
        JSON.stringify({ error: 'A URL, search prompt, or goal is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Format target URL if specified without protocol
    if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`;
    }

    const targetUrl =
      rawUrl ||
      (prompt ? `https://www.google.com/search?q=${encodeURIComponent(prompt)}` : 'https://www.google.com');

    const profile = await loadProfile(supabase, user.id);

    if (body.phone) profile.phone = body.phone;
    if (body.customAnswers && typeof body.customAnswers === 'object') {
      profile.customAnswers = {
        ...(profile.customAnswers || {}),
        ...body.customAnswers,
      };
    }

    if (body.phone || body.customAnswers) {
      await saveAgentExtras(supabase, user.id, {
        phone: body.phone,
        customAnswers: body.customAnswers,
      }).catch((e: any) => console.warn('Failed to save extras:', e));
    }

    const resolvedEmail: string = profile.email || user.email || 'user@example.com';
    const userMetaName: string = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string;
    const resolvedName: string =
      profile.name ||
      userMetaName ||
      (resolvedEmail.includes('@') ? resolvedEmail.split('@')[0] || 'Force User' : 'Force User');

    profile.email = resolvedEmail;
    profile.name = resolvedName;

    const isRegistration = taskType === 'registration' || targetUrl.includes('lu.ma') || targetUrl.includes('luma');

    const stream = await createBrowserStream({
      url: targetUrl,
      eventUrl: targetUrl,
      goal,
      prompt,
      taskType: taskType || (isRegistration ? 'registration' : 'research'),
      profile,
      hooks: {
        onComplete: async (payload: TinyfishCompletionPayload) => {
          try {
            await persistTinyfishUsageContext(user.id, payload);

            if (payload.status === 'SUCCESS') {
              await notificationService.sendAgentCompletedInApp(user.id, {
                link: '/agent',
                outcome: isRegistration ? 'registration_completed' : 'browser_task_completed',
              });

              // Push is capped at once/day and selected by global priority.
              await notificationService.sendBestDailyPushNotificationForUser(user.id);
            }
          } catch (persistErr) {
            console.error('[Agent Browser] Failed to persist TinyFish context:', persistErr);
          }
        },
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
