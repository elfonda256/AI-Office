import { NextResponse } from 'next/server';
import { getAllAgents, updateAgentStatusAndTask } from '@/lib/db';
import { setupWebhook } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TELEGRAM_API = 'https://api.telegram.org';

// GET: Check status or auto-setup webhook if ?setup=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get('setup') === '1') {
    const result = await setupWebhook();
    return NextResponse.json(result);
  }

  return NextResponse.json({
    status: 'active',
    service: 'Kantor AI Telegram Webhook',
    timestamp: new Date().toISOString(),
  });
}

// POST: Handle Telegram Updates (Callback queries for "✅ Setuju" button & commands)
export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const allowedChatId = process.env.TELEGRAM_CHAT_ID || '';
  const appUrl = (process.env.APP_URL || 'https://ai-office-arkaprana.vercel.app').replace(/\/$/, '');

  try {
    const body = await request.json();

    // 1. Handle Callback Query (tombol "✅ Setuju")
    if (body.callback_query) {
      const cb = body.callback_query;
      const senderId = String(cb.from?.id || cb.message?.chat?.id || '');

      // Keamanan Ketat: Hanya terima instruksi dari Chat ID pemilik
      if (allowedChatId && senderId !== allowedChatId) {
        console.warn(`[Telegram Webhook] Akses ditolak dari unauthorized ID: ${senderId}`);
        await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cb.id,
            text: '⛔ Akses ditolak. Anda bukan pemilik Kantor AI.',
            show_alert: true,
          }),
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const data = String(cb.data || '');

      if (data.startsWith('approve:')) {
        const agentId = data.replace('approve:', '');
        const allAgents = await getAllAgents();
        const agent = allAgents.find((a) => a.id === agentId);

        if (agent) {
          // Update status agen ke 'kerja', hapus draft, catat aktivitas
          await updateAgentStatusAndTask(
            agentId,
            'kerja',
            agent.task,
            undefined,
            'Draf disetujui Bos Elfano via Telegram'
          );

          // 1. Popup umpan balik di Telegram
          await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: `✅ Draf ${agent.name} berhasil disetujui!`,
            }),
          });

          // 2. Ubah isi pesan Telegram menjadi status selesai/disetujui
          const safeTask = agent.task
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cb.message?.chat?.id || allowedChatId,
              message_id: cb.message?.message_id,
              text: `✅ <b>${agent.name} Disetujui:</b>\n"${safeTask}"\n\nDraf telah disetujui oleh Bos Elfano via Telegram. Agen kembali bekerja!`,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🏢 Buka Kantor',
                      url: `${appUrl}/?agent=${agent.id}`,
                    },
                  ],
                ],
              },
            }),
          });

          return NextResponse.json({ success: true, agent: agentId, action: 'approved' });
        }
      }
    }

    // 2. Handle Text Command (contoh: /start atau /status)
    if (body.message?.text) {
      const msg = body.message;
      const senderId = String(msg.from?.id || msg.chat?.id || '');

      if (allowedChatId && senderId !== allowedChatId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const text = msg.text.trim();

      if (text.startsWith('/start') || text.startsWith('/status')) {
        const allAgents = await getAllAgents();
        const kerja = allAgents.filter((a) => a.status === 'kerja').length;
        const nunggu = allAgents.filter((a) => a.status === 'nunggu').length;
        const santai = allAgents.filter((a) => a.status === 'santai').length;

        const reply = `🏢 <b>Kantor AI — Status Terkini</b>\n\n` +
          `🟢 Lagi kerja: <b>${kerja}</b>\n` +
          `🟡 Nunggu kamu: <b>${nunggu}</b>\n` +
          `🔵 Santai: <b>${santai}</b>\n\n` +
          `Bot akan otomatis mengirim notifikasi setiap kali agen selesai menyusun draf atau butuh keputusanmu!`;

        await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: msg.chat.id,
            text: reply,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🏢 Buka Kantor AI',
                    url: appUrl,
                  },
                ],
              ],
            },
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
