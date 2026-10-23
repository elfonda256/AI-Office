import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { updateAgentPositions, getAllAgents } from '@/lib/db';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!checkAuth()) {
    return NextResponse.json({ error: 'Unauthorized: Kantor AI terkunci' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: 'Positions must be an array' }, { status: 400 });
    }

    // 1. Update Database (Turso / SQLite)
    await updateAgentPositions(positions);

    // 2. Fetch updated agents
    const allAgents = await getAllAgents();

    // 3. Update JSON files in local dev environment (safely ignore if read-only filesystem on Vercel)
    try {
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
    } catch {
      // Ignored on read-only serverless platforms like Vercel
    }

    return NextResponse.json({
      success: true,
      message: 'Posisi karakter berhasil disimpan',
      agents: allAgents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
