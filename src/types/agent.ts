export type AgentStatus = 'kerja' | 'nunggu' | 'santai';

export interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  systemPrompt?: string;
  status: AgentStatus;
  task: string;
  draft?: string;
  zone?: string;
  isUser?: boolean;
  avatarColor: string;
  x: number;
  y: number;
  desk?: { x: number; y: number };
  chillSpot: { x: number; y: number; zone?: string };
  recentActivity: string[];
}
