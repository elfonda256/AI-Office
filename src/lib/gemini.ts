export interface GeminiTaskResult {
  success: boolean;
  draft?: string;
  model: string;
  error?: string;
}

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return { apiKey, model };
}

export async function testGeminiConnection(): Promise<{ success: boolean; model: string; message: string }> {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    return {
      success: false,
      model,
      message: 'GEMINI_API_KEY belum terpasang di .env.local',
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Halo Gemini, konfirmasi tes koneksi server Kantor AI dalam 1 kalimat singkat.' }],
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error?.message || `HTTP ${res.status}`;
      return {
        success: false,
        model,
        message: `Gagal menghubungi Gemini (${errMsg})`,
      };
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Koneksi berhasil.';
    return {
      success: true,
      model,
      message: reply,
    };
  } catch (err: any) {
    return {
      success: false,
      model,
      message: `Error jaringan: ${err.message}`,
    };
  }
}

export async function generateAgentDraft(
  agentName: string,
  role: string,
  systemPrompt: string,
  task: string
): Promise<GeminiTaskResult> {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    return {
      success: false,
      model,
      error: 'GEMINI_API_KEY tidak ditemukan di environment server.',
    };
  }

  const prompt = `Kamu adalah ${agentName}, ${role} di Kantor AI.
${systemPrompt ? `Pedoman peranmu: ${systemPrompt}` : ''}

ATURAN UTAMA:
Jawab singkat dan langsung sesuai permintaan. Jangan menambah saran, catatan, atau pertanyaan penutup yang tidak diminta. Jika diminta tabel, berikan tabel markdown saja.

Instruksi Tugas:
"${task}"`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(50000), // 50s timeout to safely finish before Vercel's 60s limit
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      let friendlyError = 'Terjadi kesalahan saat memproses tugas dengan AI.';
      const status = res.status;
      const apiMsg = data.error?.message || '';

      if (status === 400 || status === 403) {
        friendlyError = 'API key Gemini tidak valid atau izin akses ditolak.';
      } else if (status === 429) {
        friendlyError = 'Batas kuota Gemini tercapai. Silakan coba lagi beberapa saat.';
      } else if (status === 404) {
        friendlyError = `Model ${model} tidak ditemukan atau belum tersedia untuk key ini.`;
      } else if (status >= 500) {
        friendlyError = 'Server Google Gemini sedang sibuk. Coba sesaat lagi.';
      }

      return {
        success: false,
        model,
        error: `${friendlyError} (${apiMsg || `Status: ${status}`})`,
      };
    }

    const draftText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return {
      success: true,
      draft: draftText,
      model,
    };
  } catch (err: any) {
    return {
      success: false,
      model,
      error: `Gagal memanggil API: ${err.message}`,
    };
  }
}
