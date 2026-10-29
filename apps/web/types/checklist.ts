export type Period = 'daily' | 'weekly' | 'monthly';
export type Lane = 'work' | 'personal';
export type Privacy = 'private' | 'shared';
export type ShareRole = 'view' | 'comment' | 'collaborate';

export interface MindMapNode {
  id: string;
  name: string;
  chakra?: string;
  color?: string;
}

export interface SharedWith {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: ShareRole;
  addedAt: Date;
}

export interface NudgeSettings {
  enabled: boolean;
  method: 'email' | 'calendar' | 'push';
  time?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  lane: Lane;
  completed: boolean;
  timeEstimate?: number; // in minutes
  linkedNodes: MindMapNode[];
  privacy: Privacy;
  sharedWith: SharedWith[];
  notes?: string;
  nudgeSettings: NudgeSettings;
  createdAt: Date;
  completedAt?: Date;
}

export interface Checklist {
  id: string;
  name: string;
  period: Period;
  items: ChecklistItem[];
  privacy: Privacy;
  sharedWith: SharedWith[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceStats {
  workProgress: number;
  personalProgress: number;
  isBalanced: boolean;
  balanceThreshold: number;
}
