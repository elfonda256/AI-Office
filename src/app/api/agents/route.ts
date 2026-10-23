import { NextResponse } from 'next/server';
import { getAllAgents, updateAgentStatusAndTask } from '@/lib/db';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized: Kantor AI terkunci' }, { status: 401 });
  }

  try {
    const agents = await getAllAgents();
    return NextResponse.json(agents);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized: Kantor AI terkunci' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, task, draft } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    await updateAgentStatusAndTask(id, status, task, draft);
    const allAgents = await getAllAgents();
    const updated = allAgents.find((a) => a.id === id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
