import { createClient, Client } from '@libsql/client';
import initialAgents from '../data/agents.json';

let clientInstance: Client | null = null;
let initPromise: Promise<void> | null = null;

export function getDbClient(): Client {
  if (!clientInstance) {
    const url = process.env.TURSO_DATABASE_URL || 'file:kantor.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    try {
      clientInstance = createClient({
        url,
        authToken: authToken || undefined,
      });
    } catch {
      // Fallback to in-memory if file path is not writable
      clientInstance = createClient({ url: ':memory:' });
    }
  }

  return clientInstance;
}

export async function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = getDbClient();

      // 1. Initialize schema
      await client.execute(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          department TEXT NOT NULL,
          system_prompt TEXT,
          status TEXT NOT NULL,
          task TEXT NOT NULL,
          draft TEXT,
          x REAL NOT NULL,
          y REAL NOT NULL,
          chill_x REAL NOT NULL,
          chill_y REAL NOT NULL,
          is_user INTEGER DEFAULT 0,
          avatar_color TEXT NOT NULL,
          recent_activity TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Safe migrations for new columns
      try {
        await client.execute('ALTER TABLE agents ADD COLUMN system_prompt TEXT;');
      } catch {}

      try {
        await client.execute('ALTER TABLE agents ADD COLUMN draft TEXT;');
      } catch {}

      // 3. Seed data if empty
      const countRes = await client.execute('SELECT COUNT(*) as count FROM agents');
      const count = Number(countRes.rows[0]?.count || 0);

      if (count === 0) {
        for (const ag of initialAgents) {
          await client.execute({
            sql: `
              INSERT OR REPLACE INTO agents (
                id, name, role, department, system_prompt, status, task, draft, 
                x, y, chill_x, chill_y, is_user, avatar_color, recent_activity
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              ag.id,
              ag.name,
              ag.role,
              ag.department,
              ag.systemPrompt || '',
              ag.status,
              ag.task,
              ag.draft || null,
              ag.x,
              ag.y,
              ag.chillSpot?.x ?? ag.x,
              ag.chillSpot?.y ?? ag.y,
              ag.isUser ? 1 : 0,
              ag.avatarColor,
              JSON.stringify(ag.recentActivity || []),
            ],
          });
        }
      }
    })();
  }

  return initPromise;
}

export interface AgentDbRecord {
  id: string;
  name: string;
  role: string;
  department: string;
  systemPrompt?: string;
  status: 'kerja' | 'nunggu' | 'santai';
  task: string;
  draft?: string;
  x: number;
  y: number;
  chillSpot: { x: number; y: number };
  isUser: boolean;
  avatarColor: string;
  recentActivity: string[];
}

export async function getAllAgents(): Promise<AgentDbRecord[]> {
  await ensureDbInitialized();
  const client = getDbClient();
  const res = await client.execute('SELECT * FROM agents ORDER BY id ASC');

  return res.rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name),
    role: String(r.role),
    department: String(r.department),
    systemPrompt: r.system_prompt ? String(r.system_prompt) : '',
    status: r.status as 'kerja' | 'nunggu' | 'santai',
    task: String(r.task),
    draft: r.draft ? String(r.draft) : undefined,
    x: Number(r.x),
    y: Number(r.y),
    chillSpot: { x: Number(r.chill_x), y: Number(r.chill_y) },
    isUser: Boolean(r.is_user),
    avatarColor: String(r.avatar_color),
    recentActivity: JSON.parse(r.recent_activity ? String(r.recent_activity) : '[]'),
  }));
}

export async function updateAgentPositions(positions: { id: string; x: number; y: number }[]): Promise<void> {
  await ensureDbInitialized();
  const client = getDbClient();

  for (const p of positions) {
    await client.execute({
      sql: `UPDATE agents SET x = ?, y = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [p.x, p.y, p.id],
    });
  }
}

export async function updateAgentStatusAndTask(
  id: string,
  status: 'kerja' | 'nunggu' | 'santai',
  task?: string,
  draft?: string,
  activityNote?: string
): Promise<void> {
  await ensureDbInitialized();
  const client = getDbClient();

  const rowRes = await client.execute({
    sql: 'SELECT recent_activity FROM agents WHERE id = ?',
    args: [id],
  });

  const row = rowRes.rows[0];
  let activities: string[] = [];
  if (row && row.recent_activity) {
    try {
      activities = JSON.parse(String(row.recent_activity));
    } catch {}
  }

  if (activityNote) {
    activities = [activityNote, ...activities.slice(0, 5)];
  } else if (task) {
    activities = [`Status: ${status.toUpperCase()} - ${task}`, ...activities.slice(0, 5)];
  }

  const activitiesJson = JSON.stringify(activities);

  if (draft !== undefined) {
    await client.execute({
      sql: `
        UPDATE agents 
        SET status = ?, task = COALESCE(?, task), draft = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      args: [status, task || null, draft, activitiesJson, id],
    });
  } else if (task) {
    await client.execute({
      sql: `
        UPDATE agents 
        SET status = ?, task = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      args: [status, task, activitiesJson, id],
    });
  } else {
    await client.execute({
      sql: `
        UPDATE agents 
        SET status = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      args: [status, activitiesJson, id],
    });
  }
}
