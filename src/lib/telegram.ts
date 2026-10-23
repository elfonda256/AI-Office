const TELEGRAM_API = 'https://api.telegram.org';

function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const appUrl = (process.env.APP_URL || 'https://ai-office-elfonda256.vercel.app').replace(/\/$/, '');
  return { token, chatId, appUrl };
}

// In-memory anti-spam cache: 1 notification per agent status transition within 30s
const notificationCache = new Map<string, { status: string; task: string; timestamp: number }>();

function isDuplicateNotification(agentId: string, status: string, task: string): boolean {
  const now = Date.now();
  const cached = notificationCache.get(agentId);

  if (cached && cached.status === status && cached.task === task && now - cached.timestamp < 30000) {
    return true;
  }

  notificationCache.set(agentId, { status, task, timestamp: now });
  return false;
}

/**
 * Sends a message to the user's Telegram chat
 */
export async function sendTelegramMessage(text: string, replyMarkup?: any): Promise<boolean> {
  const { token, chatId } = getTelegramConfig();

  if (!token || !chatId) {
    console.log('[Telegram] Bot token atau Chat ID belum disetel, lewati notifikasi.');
    return false;
  }

  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10s timeout
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Telegram] Gagal mengirim pesan:', data.description);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Telegram] Error jaringan saat kirim notifikasi:', err.message);
    return false;
  }
}

/**
 * Notifies when agent completes a draft and transitions to "waiting" (nunggu)
 * Contoh: "🟡 Jojo selesai: Laporan iklan mingguan. Draf siap kamu cek."
 */
export async function notifyAgentDraftReady(agent: {
  id: string;
  name: string;
  task: string;
  draftSnippet?: string;
}): Promise<boolean> {
  if (isDuplicateNotification(agent.id, 'nunggu', agent.task)) {
    console.log(`[Telegram] Lewati notifikasi duplikat untuk ${agent.name}`);
    return false;
  }

  const { appUrl } = getTelegramConfig();

  // Escape HTML characters in task string for safe HTML rendering
  const safeTask = agent.task
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const text = `🟡 <b>${agent.name} selesai:</b> ${safeTask}.\n\nDraf siap kamu cek.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '✅ Setuju',
          callback_data: `approve:${agent.id}`,
        },
        {
          text: '✏️ Revisi',
          url: `${appUrl}/?agent=${agent.id}&action=revisi`,
        },
      ],
      [
        {
          text: '🏢 Buka Kantor',
          url: `${appUrl}/?agent=${agent.id}`,
        },
      ],
    ],
  };

  return sendTelegramMessage(text, replyMarkup);
}

/**
 * Notifies when an agent task fails (e.g. API quota or network error)
 * Contoh: "🔴 Pompom gagal: Batas kuota Gemini tercapai."
 */
export async function notifyAgentTaskFailed(agent: {
  id: string;
  name: string;
  task: string;
}, reason: string): Promise<boolean> {
  if (isDuplicateNotification(agent.id, 'gagal', reason)) {
    return false;
  }

  const { appUrl } = getTelegramConfig();

  const safeReason = reason
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const text = `🔴 <b>${agent.name} gagal:</b> ${safeReason}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '🏢 Buka Kantor',
          url: `${appUrl}/?agent=${agent.id}`,
        },
      ],
    ],
  };

  return sendTelegramMessage(text, replyMarkup);
}

/**
 * Sets up Telegram webhook pointing to the deployed Vercel domain
 */
export async function setupWebhook(customUrl?: string): Promise<{ success: boolean; message: string }> {
  const { token, appUrl } = getTelegramConfig();
  if (!token) {
    return { success: false, message: 'TELEGRAM_BOT_TOKEN belum disetel.' };
  }

  const targetUrl = customUrl || `${appUrl}/api/telegram/webhook`;
  const endpoint = `${TELEGRAM_API}/bot${token}/setWebhook?url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetch(endpoint, { method: 'POST', signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return {
      success: res.ok && data.ok,
      message: data.description || 'Webhook berhasil dikonfigurasi.',
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
