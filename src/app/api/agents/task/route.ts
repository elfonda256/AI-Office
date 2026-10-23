import { NextResponse } from 'next/server';
import { getAllAgents, updateAgentStatusAndTask } from '@/lib/db';
import { generateAgentDraft, testGeminiConnection, getGeminiConfig } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

// GET: Test connection to Gemini
export async function GET() {
  const testResult = await testGeminiConnection();
  return NextResponse.json(testResult);
}

// POST: Execute task for an agent using Gemini
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, task } = body;

    if (!id || !task) {
      return NextResponse.json({ error: 'Missing agent id or task description' }, { status: 400 });
    }

    const agents = getAllAgents();
    const agent = agents.find((a) => a.id === id);

    if (!agent) {
      return NextResponse.json({ error: `Agent ${id} not found` }, { status: 404 });
    }

    // 1. Set status to 'kerja' while Gemini processes
    updateAgentStatusAndTask(
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
      updateAgentStatusAndTask(
        id,
        'santai',
        agent.task,
        undefined,
        `Gagal memproses tugas: ${result.error}`
      );
      return NextResponse.json({ error: result.error, model: result.model }, { status: 500 });
    }

    // 3. Set status to 'nunggu' with draft waiting for user approval, preserving original user task
    updateAgentStatusAndTask(
      id,
      'nunggu',
      task,
      result.draft,
      `Draf selesai disusun dengan ${result.model}. Menunggu persetujuan.`
    );

    const updatedAgent = getAllAgents().find((a) => a.id === id);

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
