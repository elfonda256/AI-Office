export interface GeminiTaskResult {
  success: boolean;
  draft?: string;
  model: string;
  error?: string;
  retriesUsed?: number;
  usedFallback?: boolean;
}

export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
  return { apiKey, model, fallbackModel };
}

// =========================================================================
// 🚦 CONCURRENCY QUEUE: Maksimal 2 pemanggilan Gemini berjalan bersamaan
// =========================================================================
class ConcurrencyQueue {
  private activeCount = 0;
  private readonly maxConcurrent = 2;
  private queue: (() => void)[] = [];

  async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.activeCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

const geminiQueue = new ConcurrencyQueue();

export function getQueueStatus() {
  return {
    active: geminiQueue.getActiveCount(),
    waiting: geminiQueue.getQueueLength(),
  };
}

// =========================================================================
// 🧪 Test Gemini Connection
// =========================================================================
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
      signal: AbortSignal.timeout(15000),
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

// =========================================================================
// 🚀 Core Fetch with Retries & Fallback Model
// =========================================================================
const RETRY_DELAYS_MS = [5000, 15000, 30000]; // 5 detik, 15 detik, 30 detik

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeSingleGeminiRequest(
  apiKey: string,
  modelName: string,
  prompt: string
): Promise<{ ok: boolean; status: number; text?: string; errorMsg?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000), // 45s timeout per request
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
    return {
      ok: false,
      status: res.status,
      errorMsg: data.error?.message || `HTTP ${res.status}`,
    };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return {
    ok: true,
    status: 200,
    text,
  };
}

/**
 * Generate agent draft with:
 * 1. Concurrency Queue (max 2 simultaneously)
 * 2. Exponential retry backoff on 429 quota (5s, 15s, 30s)
 * 3. Automatic fallback model (GEMINI_FALLBACK_MODEL) if quota hit
 * 4. Friendly error message
 */
export async function generateAgentDraft(
  agentName: string,
  role: string,
  systemPrompt: string,
  task: string
): Promise<GeminiTaskResult> {
  const { apiKey, model: primaryModel, fallbackModel } = getGeminiConfig();

  if (!apiKey) {
    return {
      success: false,
      model: primaryModel,
      error: 'GEMINI_API_KEY tidak ditemukan di environment server.',
    };
  }

  const prompt = `Kamu adalah ${agentName}, ${role} di Kantor AI.
${systemPrompt ? `Pedoman peranmu: ${systemPrompt}` : ''}

ATURAN UTAMA:
Jawab singkat dan langsung sesuai permintaan. Jangan menambah saran, catatan, atau pertanyaan penutup yang tidak diminta. Jika diminta tabel, berikan tabel markdown saja.

Instruksi Tugas:
"${task}"`;

  // 1. Antrikan pemanggilan agar maksimal 2 agen berjalan bersamaan
  const releaseQueue = await geminiQueue.acquire();

  try {
    let currentModel = primaryModel;
    let usedFallback = false;
    let retriesUsed = 0;
    let lastError = '';

    // Coba panggilan awal + maksimal 3 kali retry jika error kuota (429)
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) {
        retriesUsed++;
        const delay = RETRY_DELAYS_MS[attempt - 1] || 10000;
        console.log(`[Gemini Retry] Percobaan ke-${attempt} untuk ${agentName} (model: ${currentModel}) dalam ${delay / 1000} detik...`);
        await sleep(delay);
      }

      try {
        const result = await executeSingleGeminiRequest(apiKey, currentModel, prompt);

        if (result.ok && result.text) {
          return {
            success: true,
            draft: result.text,
            model: currentModel,
            retriesUsed,
            usedFallback,
          };
        }

        // Tangani Error Kuota (429)
        if (result.status === 429) {
          lastError = 'Batas kuota Gemini tercapai.';

          // Jika model utama kena 429 dan belum pakai model cadangan, langsung alihkan ke model cadangan
          if (!usedFallback && fallbackModel && fallbackModel !== currentModel) {
            console.log(`[Gemini Fallback] Mengalihkan ${agentName} dari ${currentModel} ke model cadangan: ${fallbackModel}`);
            currentModel = fallbackModel;
            usedFallback = true;
          }
          continue; // Lanjut ke retry berikutnya
        }

        // Tangani Server Busy (503 / 500)
        if (result.status >= 500) {
          lastError = 'Server Google Gemini sedang sibuk.';
          continue; // Lanjut ke retry berikutnya
        }

        // Error permanen lainnya (400, 403, 404)
        if (result.status === 400 || result.status === 403) {
          return {
            success: false,
            model: currentModel,
            error: 'Kunci API Gemini tidak valid atau izin akses ditolak.',
          };
        }

        if (result.status === 404) {
          // Jika model 404, coba fallback model jika tersedia
          if (!usedFallback && fallbackModel && fallbackModel !== currentModel) {
            currentModel = fallbackModel;
            usedFallback = true;
            continue;
          }
          return {
            success: false,
            model: currentModel,
            error: `Model ${currentModel} tidak ditemukan di Google Gemini.`,
          };
        }

        lastError = result.errorMsg || `Error HTTP ${result.status}`;
      } catch (err: any) {
        lastError = err.message || 'Gangguan koneksi';
      }
    }

    // Jika sudah mencoba 3x jeda (5s, 15s, 30s) dan tetap gagal:
    let friendlyError = 'Batas kuota Gemini tercapai setelah 3x percobaan ulang otomatis. Silakan klik "Coba Lagi" beberapa saat lagi.';
    if (!lastError.includes('kuota') && !lastError.includes('429')) {
      friendlyError = `Gagal memproses tugas (${lastError}). Silakan klik "Coba Lagi".`;
    }

    return {
      success: false,
      model: currentModel,
      retriesUsed,
      usedFallback,
      error: friendlyError,
    };
  } finally {
    // Pastikan slot antrean selalu dilepaskan
    releaseQueue();
  }
}
