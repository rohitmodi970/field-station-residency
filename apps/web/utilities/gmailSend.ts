import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/utilities/mailService';

export const FORCE_SENDER_EMAIL =
  process.env.FORCE_SENDER_EMAIL || process.env.EMAIL_ADDRESS || 'work@findmyforce.com';

export interface ImportantTaskForEmail {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string | null;
  category?: string | null;
  allocation?: string | null;
  ai_reasoning?: string | null;
  is_primary?: boolean | null;
  status?: string | null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getCategoryBadge(category?: string | null): string {
  const cat = (category || 'Personal').trim();
  const normalized = cat.toLowerCase();

  let bg = '#f8fafc';
  let text = '#475569';
  let border = '#e2e8f0';
  let icon = '🌟';

  if (normalized.includes('work') || normalized.includes('job') || normalized.includes('project')) {
    bg = '#eff6ff'; text = '#1d4ed8'; border = '#bfdbfe'; icon = '💼';
  } else if (normalized.includes('health') || normalized.includes('fit') || normalized.includes('well') || normalized.includes('exercise')) {
    bg = '#f0fdf4'; text = '#15803d'; border = '#bbf7d0'; icon = '🌿';
  } else if (normalized.includes('career') || normalized.includes('goal')) {
    bg = '#f5f3ff'; text = '#6d28d9'; border = '#ddd6fe'; icon = '🎯';
  } else if (normalized.includes('finance') || normalized.includes('money') || normalized.includes('budget')) {
    bg = '#fefce8'; text = '#854d0e'; border = '#fef08a'; icon = '💰';
  } else if (normalized.includes('learn') || normalized.includes('study') || normalized.includes('read')) {
    bg = '#ecfeff'; text = '#0e7490'; border = '#a5f3fc'; icon = '📚';
  } else if (normalized.includes('reflect') || normalized.includes('mind') || normalized.includes('journal')) {
    bg = '#fdf4ff'; text = '#86198f'; border = '#f5d0fe'; icon = '🧘';
  } else if (normalized.includes('relation') || normalized.includes('family') || normalized.includes('friend')) {
    bg = '#fff1f2'; text = '#be123c'; border = '#fecdd3'; icon = '🤝';
  } else if (normalized.includes('admin')) {
    bg = '#f8fafc'; text = '#334155'; border = '#cbd5e1'; icon = '⚡';
  }

  return `<span style="display:inline-block;background:${bg};color:${text};border:1px solid ${border};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">${icon} ${cat}</span>`;
}

function cleanDisplayTitle(title: string | undefined | null, category?: string | null, description?: string | null): string {
  let t = (title || '').trim();
  const cat = (category || 'Personal').trim();

  const isGeneric =
    !t ||
    t.toLowerCase() === cat.toLowerCase() ||
    t.toLowerCase() === 'personal' ||
    t.toLowerCase() === 'task' ||
    t.toLowerCase() === 'untitled task' ||
    t.toLowerCase().endsWith('focus task');

  if (isGeneric) {
    if (description && description.trim() && description.toLowerCase() !== 'personal' && description.toLowerCase() !== cat.toLowerCase()) {
      const parts = stripHtml(description).split(' | Steps: ');
      const firstPart = parts[0] || '';
      const cleanDesc = (firstPart.split(' | ')[0] || '').trim();
      if (cleanDesc.length > 5) {
        return cleanDesc.length > 65 ? cleanDesc.slice(0, 62) + '...' : cleanDesc;
      }
    }

    if (cat.toLowerCase() === 'work') return 'Review and advance priority work deliverables';
    if (cat.toLowerCase() === 'health') return 'Complete daily health & wellness routine';
    if (cat.toLowerCase() === 'career') return 'Progress on key career development milestones';
    if (cat.toLowerCase() === 'finance') return 'Review financial commitments and budgets';
    if (cat.toLowerCase() === 'learning') return 'Dedicated time for study and skill building';
    if (cat.toLowerCase() === 'reflection') return 'Mindful reflection & journaling check-in';
    if (cat.toLowerCase() === 'relationship') return 'Connect and follow up with key relationships';
    return 'Personal Focus & Key Daily Action';
  }

  return t;
}

function getDueDateInfo(dueDate?: string | null): { label: string; isOverdue: boolean; isToday: boolean } {
  if (!dueDate) {
    return { label: 'No due date', isOverdue: false, isToday: false };
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return { label: 'No due date', isOverdue: false, isToday: false };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const formattedDate = due.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (due.getTime() < todayStart.getTime()) {
    return { label: `Overdue (${formattedDate})`, isOverdue: true, isToday: false };
  }

  if (due.getTime() <= todayEnd.getTime()) {
    return { label: 'Due Today', isOverdue: false, isToday: true };
  }

  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
  if (due.getTime() > todayEnd.getTime() && due.getTime() <= tomorrowEnd.getTime()) {
    return { label: 'Tomorrow', isOverdue: false, isToday: false };
  }

  return { label: formattedDate, isOverdue: false, isToday: false };
}

function formatDueDate(dueDate?: string | null): string {
  return getDueDateInfo(dueDate).label;
}

function buildNotificationHtml(params: {
  title: string;
  body: string;
  actionUrl?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://force-web.vercel.app';
  const actionUrl = params.actionUrl?.startsWith('http')
    ? params.actionUrl
    : `${appUrl}${params.actionUrl || '/notifications'}`;

  return `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:24px;color:#1e293b;margin:0;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Force</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;color:#0f172a;">${params.title}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${params.body}</p>
      <a href="${actionUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;">Open in Force</a>
    </div>
  </body>
</html>`;
}

export function buildDailyTasksDigestHtml(tasks: ImportantTaskForEmail[], recipientEmail?: string | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://force-web.vercel.app';
  const taskCount = tasks.length;

  const taskRows = tasks
    .map((task, idx) => {
      const displayTitle = cleanDisplayTitle(task.title, task.category, task.description);
      const dueInfo = getDueDateInfo(task.due_date);
      const isOverdue = dueInfo.isOverdue;
      const isDueToday = dueInfo.isToday;

      let accentBorderColor = '#cbd5e1';
      if (task.is_primary) {
        accentBorderColor = '#3b82f6';
      } else if (isOverdue) {
        accentBorderColor = '#ef4444';
      } else if (task.priority === 'high' || isDueToday) {
        accentBorderColor = '#f59e0b';
      }

      const badges: string[] = [];

      // Category badge
      if (task.category) {
        badges.push(getCategoryBadge(task.category));
      }

      if (task.is_primary) {
        badges.push(
          '<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">⭐ Primary Focus</span>'
        );
      }

      if (isOverdue) {
        badges.push(
          '<span style="display:inline-block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">⚠️ Overdue</span>'
        );
      } else if (isDueToday) {
        badges.push(
          '<span style="display:inline-block;background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">⏳ Due Today</span>'
        );
      }

      if (task.priority === 'high' && !task.is_primary) {
        badges.push(
          '<span style="display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">🔥 High Priority</span>'
        );
      }

      if (task.status === 'in_progress') {
        badges.push(
          '<span style="display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-right:6px;vertical-align:middle;">⚡ In Progress</span>'
        );
      }

      // Rich description rendering
      let descriptionHtml = '';
      if (task.description && task.description.trim()) {
        const cleanDesc = stripHtml(task.description);
        if (cleanDesc.includes(' | Steps: ')) {
          const [mainText, stepsText] = cleanDesc.split(' | Steps: ');
          const stepItems = stepsText ? stepsText.split(' • ').map((s) => s.trim()).filter(Boolean) : [];
          descriptionHtml = `
            <p style="margin:8px 0 6px;font-size:13px;color:#334155;line-height:1.5;font-weight:500;">${mainText || ''}</p>
            ${
              stepItems.length > 0
                ? `<div style="margin:6px 0 0;padding:8px 12px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:6px;">
                    ${stepItems.map((st) => `<p style="margin:3px 0;font-size:12px;color:#475569;line-height:1.4;">• ${st}</p>`).join('')}
                  </div>`
                : ''
            }
          `;
        } else if (cleanDesc.includes(' | ')) {
          const parts = cleanDesc.split(' | ').map((p) => p.trim()).filter(Boolean);
          const firstSub = parts[0] || '';
          descriptionHtml = `
            <p style="margin:8px 0 6px;font-size:13px;color:#334155;line-height:1.5;">${firstSub}</p>
            ${
              parts.length > 1
                ? `<div style="margin:6px 0 0;padding:8px 12px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:6px;">
                    ${parts.slice(1).map((st) => `<p style="margin:3px 0;font-size:12px;color:#475569;line-height:1.4;">• ${st}</p>`).join('')}
                  </div>`
                : ''
            }
          `;
        } else {
          descriptionHtml = `<p style="margin:8px 0 0;font-size:13px;color:#475569;line-height:1.5;">${cleanDesc}</p>`;
        }
      }

      const dueColor = isOverdue ? '#dc2626' : isDueToday ? '#d97706' : '#64748b';

      return `<li style="margin:0 0 14px;padding:16px 18px;border:1px solid #e2e8f0;border-left:4px solid ${accentBorderColor};border-radius:12px;background:#ffffff;list-style:none;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="flex:1;">
            <div style="margin-bottom:8px;line-height:1.8;">
              ${badges.join('')}
            </div>
            <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;line-height:1.4;">${idx + 1}. ${displayTitle}</p>
            ${descriptionHtml}
            <p style="margin:10px 0 0;font-size:12px;color:${dueColor};font-weight:600;">📅 Due: ${dueInfo.label}</p>
          </div>
        </div>
      </li>`;
    })
    .join('');

  const recipientNote = recipientEmail ? ` to <span style="font-weight:600;color:#334155;">${recipientEmail}</span>` : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:24px 12px;color:#1e293b;margin:0;">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
      
      <!-- Header -->
      <div style="background:#090d16;padding:28px 24px 24px;color:#ffffff;">
        <span style="display:inline-block;background:rgba(255,255,255,0.12);color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:999px;margin-bottom:10px;">FORCE • DAILY DIGEST</span>
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;">
          ${taskCount === 1 ? 'Your unfinished task for today' : `Your ${taskCount} unfinished tasks for today`}
        </h1>
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
          Here is your daily summary of pending tasks to help you stay on track.
        </p>
      </div>

      <!-- Task List Content -->
      <div style="padding:24px 24px 20px;">
        <ul style="margin:0;padding:0;">
          ${taskRows}
        </ul>

        <!-- Action Button -->
        <div style="margin-top:24px;text-align:center;">
          <a href="${appUrl}/dashboard?tab=todos" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(15,23,42,0.15);">
            Open Force to Complete Tasks →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;padding:18px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
        <p style="margin:0 0 6px;">Sent daily at 12:00 PM${recipientNote} from <strong style="color:#334155;">work@findmyforce.com</strong></p>
        <p style="margin:0;"><a href="${appUrl}/settings?tab=integrations" style="color:#3b82f6;text-decoration:none;">Manage notification settings</a></p>
      </div>

    </div>
  </body>
</html>`;
}

export async function resolveNotificationEmail(userId: string): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data: gmailConn } = await adminClient
    .from('user_google_gmail_connections')
    .select('google_email, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (gmailConn?.google_email) {
    return gmailConn.google_email;
  }

  const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
  return authUser?.user?.email || null;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_USER && process.env.SMTP_PASSWORD) ||
    (process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD)
  );
}

export async function sendNotificationEmail(params: {
  userId: string;
  to?: string;
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  html?: string;
}): Promise<{ success: boolean; provider: 'smtp' | 'none'; error?: string }> {
  const recipient = params.to || (await resolveNotificationEmail(params.userId));
  if (!recipient) {
    return { success: false, provider: 'none', error: 'No recipient email found' };
  }

  if (!isSmtpConfigured()) {
    return { success: false, provider: 'none', error: 'SMTP not configured' };
  }

  const html = params.html || buildNotificationHtml({
    title: params.title,
    body: params.body,
    actionUrl: params.actionUrl,
  });

  const smtpOk = await sendEmail({
    to: recipient,
    subject: params.subject,
    html,
    text: params.body,
  });

  return smtpOk
    ? { success: true, provider: 'smtp' }
    : { success: false, provider: 'smtp', error: 'SMTP send failed' };
}

export async function sendDailyTasksDigestEmail(params: {
  userId: string;
  to?: string;
  tasks: ImportantTaskForEmail[];
}): Promise<{ success: boolean; provider: 'smtp' | 'none'; error?: string }> {
  const recipient = params.to || (await resolveNotificationEmail(params.userId));
  if (!recipient) {
    return { success: false, provider: 'none', error: 'No recipient email found' };
  }

  if (!isSmtpConfigured()) {
    return { success: false, provider: 'none', error: 'SMTP not configured' };
  }

  const taskCount = params.tasks.length;
  const subject = taskCount === 1
    ? 'Your unfinished task for today'
    : `${taskCount} unfinished tasks for today`;

  const plainBody = params.tasks
    .map((task, index) => {
      const displayTitle = cleanDisplayTitle(task.title, task.category, task.description);
      const due = formatDueDate(task.due_date);
      const cat = task.category ? ` [${task.category}]` : '';
      const priorityLabel = task.is_primary ? ' [Primary]' : task.priority === 'high' ? ' [High Priority]' : '';
      const desc = task.description ? `\n   ${stripHtml(task.description)}` : '';
      return `${index + 1}. ${displayTitle}${cat}${priorityLabel} (Due: ${due})${desc}`;
    })
    .join('\n\n');

  const html = buildDailyTasksDigestHtml(params.tasks, recipient);
  const smtpOk = await sendEmail({
    to: recipient,
    subject,
    html,
    text: `Your unfinished tasks for today:\n\n${plainBody}\n\nOpen Force to complete your tasks: ${process.env.NEXT_PUBLIC_APP_URL || 'https://force-web.vercel.app'}/dashboard?tab=todos`,
  });

  return smtpOk
    ? { success: true, provider: 'smtp' }
    : { success: false, provider: 'smtp', error: 'SMTP send failed' };
}
