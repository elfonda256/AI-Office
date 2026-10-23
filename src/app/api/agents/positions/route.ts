import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updateAgentPositions, getAllAgents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: 'Positions must be an array' }, { status: 400 });
    }

    // 1. Update SQLite DB
    updateAgentPositions(positions);

    // 2. Update all agents in src/data/agents.json
    const allAgents = getAllAgents();
    const jsonPaths = [
      path.join(process.cwd(), 'src', 'data', 'agents.json'),
      path.join(process.cwd(), 'data', 'agents.json'),
      path.join(process.cwd(), 'public', 'data', 'agents.json'),
    ];

    const jsonContent = JSON.stringify(allAgents, null, 2);
    for (const p of jsonPaths) {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, jsonContent, 'utf-8');
    }

    return NextResponse.json({
      success: true,
      message: 'Posisi karakter berhasil disimpan ke database dan agents.json',
      agents: allAgents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
