import {
  Inbox, Check, FileText, Bot, Code, BookOpen, Folder, Clock, User,
  Database, Lock, GitBranch, Cloud, Send, Briefcase, Calendar
} from 'lucide-react';
import type { Endpoints } from './types';

export const DEFAULT_ENDPOINTS: Endpoints = {
  puddleJumper: 'https://pj.publiclogic.org',
  logicOS: 'https://os.publiclogic.org',
  logicCommons: 'https://commons.publiclogic.org',
  publicLogic: 'https://publiclogic.org',
  vaultIntake: 'https://pj.publiclogic.org/api/vault/intake',
  policyAPI: 'https://malegislature.gov/api',
  aiEnabled: true,
  aiModel: 'claude-sonnet-4-6'
};

export const TOOL_CATALOG = [
  { id: 'capture', name: 'Capture', icon: Inbox, desc: 'One-tap into 0_INBOX' },
  { id: 'docket', name: 'Docket', icon: Check, desc: 'Tasks for this case' },
  { id: 'notes', name: 'Notes', icon: FileText, desc: 'Long-form drafting' },
  { id: 'ai', name: 'AI', icon: Bot, desc: 'Claude-powered chat' },
  { id: 'code', name: 'Code', icon: Code, desc: 'JS scratchpad' },
  { id: 'policy', name: 'Policy', icon: BookOpen, desc: 'MGL, regs, bylaws' },
  { id: 'files', name: 'Files', icon: Folder, desc: 'Case attachments' },
  { id: 'timeline', name: 'Timeline', icon: Clock, desc: 'Event log' },
  { id: 'people', name: 'People', icon: User, desc: 'Contacts' }
] as const;

export const CONNECTION_CATALOG = [
  { id: 'pj', name: 'PuddleJumper', icon: Database, desc: 'Backend' },
  { id: 'vault', name: 'VAULT', icon: Lock, desc: 'Governance' },
  { id: 'commons', name: 'Logic Commons', icon: GitBranch, desc: 'Library' },
  { id: 'gdrive', name: 'Google Drive', icon: Cloud, desc: 'Docs' },
  { id: 'gmail', name: 'Gmail', icon: Send, desc: 'Email' },
  { id: 'm365', name: 'M365', icon: Briefcase, desc: 'Business' },
  { id: 'cal', name: 'Calendar', icon: Calendar, desc: 'Scheduling' },
  { id: 'icloud', name: 'iCloud', icon: Cloud, desc: 'Personal' }
] as const;

export const AI_INTEGRATIONS = [
  { id: 'claude', name: 'Claude (Sonnet)', desc: 'General reasoning' },
  { id: 'claude-h', name: 'Claude (Haiku)', desc: 'Fast lookups' },
  { id: 'web', name: 'Web Search', desc: 'Live research' }
] as const;
