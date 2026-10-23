import { NextResponse } from 'next/server';
import { getAllAgents, updateAgentStatusAndTask } from '@/lib/db';
import { generateAgentDraft, testGeminiConnection } from '@/lib/gemini';
import { checkAuth } from '@/lib/auth';
import { notifyAgentDraftReady, notifyAgentTaskFailed } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60 seconds allowed on Vercel Serverless

// GET: Test connection to Gemini
export async function GET() {
  if (!checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized: Kantor AI terkunci' }, { status: 401 });
  }

  const testResult = await testGeminiConnection();
  return NextResponse.json(testResult);
}

// POST: Execute task for an agent using Gemini
export async function POST(request: Request) {
  if (!checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized: Kantor AI terkunci' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, task } = body;

    if (!id || !task) {
      return NextResponse.json({ error: 'Missing agent id or task description' }, { status: 400 });
    }

    const agents = await getAllAgents();
    const agent = agents.find((a) => a.id === id);

    if (!agent) {
      return NextResponse.json({ error: `Agent ${id} not found` }, { status: 404 });
    }

    // 1. Set status to 'kerja' while Gemini processes
    await updateAgentStatusAndTask(
      id,
      'kerja',
      task,
      undefined,
      `Mulai mengerjakan tugas: "${task.length > 50 ? task.slice(0, 48) + '...' : task}"`
    );

    // 2. Call Gemini
    const result = await generateAgentDraft(
      agent.name,
      agent.role,
      agent.systemPrompt || '',
      task
    );

    if (!result.success) {
      // Revert to 'santai' or previous state with error
      await updateAgentStatusAndTask(
        id,
        'santai',
        agent.task,
        undefined,
        `Gagal memproses tugas: ${result.error}`
      );

      // Kirim notifikasi kegagalan ke Telegram (contoh: "🔴 Pompom gagal: Batas kuota...")
      notifyAgentTaskFailed(
        { id, name: agent.name, task },
        result.error || 'Terjadi kesalahan sistem'
      ).catch((e) => console.error('[Telegram] Notifikasi error gagal dikirim:', e));

      return NextResponse.json({ error: result.error, model: result.model }, { status: 500 });
    }

    // 3. Set status to 'nunggu' with draft waiting for user approval, preserving original user task
    await updateAgentStatusAndTask(
      id,
      'nunggu',
      task,
      result.draft,
      `Draf selesai disusun dengan ${result.model}. Menunggu persetujuan.`
    );

    // Kirim notifikasi draf siap ke Telegram (contoh: "🟡 Jojo selesai: Laporan iklan mingguan...")
    notifyAgentDraftReady({
      id,
      name: agent.name,
      task,
      draftSnippet: result.draft,
    }).catch((e) => console.error('[Telegram] Notifikasi draft gagal dikirim:', e));

    const updatedAgents = await getAllAgents();
    const updatedAgent = updatedAgents.find((a) => a.id === id);

    return NextResponse.json({
      success: true,
      agent: updatedAgent,
      model: result.model,
      draft: result.draft,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
