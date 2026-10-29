/**
 * Telegram Chat Action (Typing Indicator) Service
 *
 * Keeps the "typing..." animation alive in the user's Telegram header
 * while Force Agent searches the web and synthesizes Claude responses.
 */

interface TypingLoopOptions {
  intervalMs?: number;
  onSend?: (ok: boolean) => void;
}

/**
 * Dispatches a single `sendChatAction` call to the Telegram Bot API.
 */
export async function sendTelegramChatAction(
  chatId: string | number,
  action: 'typing' | 'find_location' | 'upload_photo' | 'record_video' = 'typing'
): Promise<boolean> {
  const token =
    process.env.TELEGRAM_BOT_TOKEN ||
    (() => {
      try {
        const fs = require('fs');
        const path = require('path');
        for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps/web/.env')]) {
          if (fs.existsSync(p)) {
            const match = fs.readFileSync(p, 'utf8').match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
            if (match) return match[1].trim();
          }
        }
      } catch {}
      return undefined;
    })();

  if (!token) {
    // If direct Bot token isn't configured yet, log once in debug mode
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        action,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch (err: any) {
    console.warn('[Telegram ChatAction] Failed to dispatch typing action:', err?.message || err);
    return false;
  }
}

/**
 * Starts a persistent typing loop that keeps "typing..." displayed in Telegram
 * until the caller invokes the returned `stop()` cleanup function.
 *
 * Telegram typing indicators expire automatically after 5 seconds, so this
 * re-triggers every 4 seconds until the response is received and sent.
 */
export function startTelegramTypingLoop(
  chatId: string | number,
  options: TypingLoopOptions = {}
): () => void {
  const intervalMs = options.intervalMs || 4000;
  let isActive = true;

  // Immediate first ping
  void sendTelegramChatAction(chatId, 'typing').then((ok) => {
    if (options.onSend) options.onSend(ok);
  });

  // Recurring loop while agent generates response
  const intervalId = setInterval(() => {
    if (!isActive) return;
    void sendTelegramChatAction(chatId, 'typing').then((ok) => {
      if (options.onSend) options.onSend(ok);
    });
  }, intervalMs);

  return () => {
    isActive = false;
    clearInterval(intervalId);
  };
}
