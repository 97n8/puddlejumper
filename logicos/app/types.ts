// Core domain types
export interface Case {
  id: string;
  name: string;
  kicker: string;
  color: string;
  pinned: boolean;
  tools: string[];
  connections: string[];
  ai: string[];
  lastOpened: number;
}

export interface Task {
  id: string;
  text: string;
  caseId: string;
  done: boolean;
  completedAt?: number;
}

export interface Capture {
  id: string;
  source: string;
  ts: number;
  text: string;
  caseId?: string;
  sentToVault: boolean;
  failedToVault?: boolean;
}

export interface Endpoints {
  puddleJumper: string;
  logicOS: string;
  logicCommons: string;
  publicLogic: string;
  vaultIntake: string;
  policyAPI: string;
  aiEnabled: boolean;
  aiModel: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface CaseData {
  notes: string;
  code: string;
  messages: Message[];
  people: Array<{ name: string; role: string; contact: string }>;
  timeline: Array<{ ts: number; text: string; type: string }>;
}
