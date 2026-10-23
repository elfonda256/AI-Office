import Database from 'better-sqlite3';
import path from 'path';
import initialAgents from '../data/agents.json';

const dbPath = path.join(process.cwd(), 'kantor.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);

    // Initialize schema
    dbInstance.exec(`
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

    // Ensure columns exist if table was created in an older migration
    try {
      dbInstance.exec('ALTER TABLE agents ADD COLUMN system_prompt TEXT;');
    } catch {}

    try {
      dbInstance.exec('ALTER TABLE agents ADD COLUMN draft TEXT;');
    } catch {}

    const countRow = dbInstance.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };

    if (countRow.count === 0) {
      dbInstance.exec('DELETE FROM agents');

      const insertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO agents (id, name, role, department, system_prompt, status, task, draft, x, y, chill_x, chill_y, is_user, avatar_color, recent_activity)
        VALUES (@id, @name, @role, @department, @system_prompt, @status, @task, @draft, @x, @y, @chill_x, @chill_y, @is_user, @avatar_color, @recent_activity)
      `);

      const insertMany = dbInstance.transaction((agentsList: any[]) => {
        for (const ag of agentsList) {
          insertStmt.run({
            id: ag.id,
            name: ag.name,
            role: ag.role,
            department: ag.department,
            system_prompt: ag.systemPrompt || '',
            status: ag.status,
            task: ag.task,
            draft: ag.draft || null,
            x: ag.x,
            y: ag.y,
            chill_x: ag.chillSpot?.x ?? ag.x,
            chill_y: ag.chillSpot?.y ?? ag.y,
            is_user: ag.isUser ? 1 : 0,
            avatar_color: ag.avatarColor,
            recent_activity: JSON.stringify(ag.recentActivity || []),
          });
        }
      });

      insertMany(initialAgents);
    }
  }

  return dbInstance;
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

export function getAllAgents(): AgentDbRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agents ORDER BY id ASC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    department: r.department,
    systemPrompt: r.system_prompt || '',
    status: r.status,
    task: r.task,
    draft: r.draft || undefined,
    x: r.x,
    y: r.y,
    chillSpot: { x: r.chill_x, y: r.chill_y },
    isUser: Boolean(r.is_user),
    avatarColor: r.avatar_color,
    recentActivity: JSON.parse(r.recent_activity || '[]'),
  }));
}

export function updateAgentPositions(positions: { id: string; x: number; y: number }[]) {
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE agents 
    SET x = @x, y = @y, updated_at = CURRENT_TIMESTAMP 
    WHERE id = @id
  `);

  const updateAll = db.transaction((list: { id: string; x: number; y: number }[]) => {
    for (const p of list) {
      updateStmt.run(p);
    }
  });

  updateAll(positions);
}

export function updateAgentStatusAndTask(
  id: string,
  status: 'kerja' | 'nunggu' | 'santai',
  task?: string,
  draft?: string,
  activityNote?: string
) {
  const db = getDb();
  const row = db.prepare('SELECT recent_activity FROM agents WHERE id = ?').get(id) as any;
  let activities: string[] = [];
  if (row && row.recent_activity) {
    try {
      activities = JSON.parse(row.recent_activity);
    } catch {}
  }

  if (activityNote) {
    activities = [activityNote, ...activities.slice(0, 5)];
  } else if (task) {
    activities = [`Status: ${status.toUpperCase()} - ${task}`, ...activities.slice(0, 5)];
  }

  const activitiesJson = JSON.stringify(activities);

  if (draft !== undefined) {
    db.prepare(`
      UPDATE agents 
      SET status = ?, task = COALESCE(?, task), draft = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, task || null, draft, activitiesJson, id);
  } else if (task) {
    db.prepare(`
      UPDATE agents 
      SET status = ?, task = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, task, activitiesJson, id);
  } else {
    db.prepare(`
      UPDATE agents 
      SET status = ?, recent_activity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, activitiesJson, id);
  }
}
