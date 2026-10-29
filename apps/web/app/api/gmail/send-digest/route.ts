import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { notificationService } from '@/utils/notifications/notificationService';
import { resolveNotificationEmail, isSmtpConfigured } from '@/utilities/gmailSend';
import { isEmailDeliveryAvailable } from '@/utils/notifications/channels/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipientEmail = await resolveNotificationEmail(user.id);
    const emailAvailable = await isEmailDeliveryAvailable(user.id);
    const smtpReady = isSmtpConfigured();

    if (!recipientEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'No recipient email found. Please connect your Gmail account in Settings > Integrations.',
        },
        { status: 400 }
      );
    }

    if (!smtpReady) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email sender (SMTP) is not configured on the server. Please check SMTP_USER / EMAIL_ADDRESS environment variables.',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const clientTasks = Array.isArray(body?.tasks) && body.tasks.length > 0 ? body.tasks : undefined;

    const tasks = clientTasks || (await notificationService.getImportantTasksForDigest(user.id));
    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'You have no unfinished tasks right now. Create a pending task in your Todo list first to test the email digest!',
        taskCount: 0,
        recipient: recipientEmail,
      });
    }

    // When the client sends pre-decrypted tasks, write the plaintext back to
    // ai_todos so the automated 12 PM cron can read them directly.
    if (clientTasks && clientTasks.length > 0) {
      const { createAdminClient } = await import('@/utils/supabase/admin');
      const adminClient = createAdminClient();
      Promise.allSettled(
        clientTasks.map((t: any) => {
          if (!t.id || !t.title) return Promise.resolve();
          const patch: Record<string, string | null> = { title: t.title };
          if (t.description) patch.description = t.description;
          if (t.category) patch.category = t.category;
          if (t.ai_reasoning) patch.ai_reasoning = t.ai_reasoning;
          return adminClient
            .from('ai_todos')
            .update(patch)
            .eq('id', t.id)
            .eq('user_id', user.id);
        })
      ).catch(() => {/* fire-and-forget */});
    }

    const result = await notificationService.sendDailyImportantTasksDigestForUser(user.id, {
      bypassDailyLimit: true,
      overrideTasks: clientTasks,
    });

    if (!result.sent) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || `Failed to send email digest: ${result.reason}`,
          reason: result.reason,
          recipient: recipientEmail,
          taskCount: tasks.length,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Unfinished tasks digest email successfully sent to ${recipientEmail}!`,
      taskCount: tasks.length,
      recipient: recipientEmail,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        is_primary: t.is_primary,
        due_date: t.due_date,
      })),
    });
  } catch (error) {
    console.error('[POST /api/gmail/send-digest] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email digest' },
      { status: 500 }
    );
  }
}
