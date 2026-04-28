export type UserRole = 'employee' | 'manager' | 'support';

export type TicketStatus = 'Done' | 'In Progress' | 'Hold' | 'Open' | 'Resolved';
export type IssueLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: number;
}

export interface Ticket {
  id: string;
  createdBy: string;
  createdByEmail: string;
  department: string;
  module: string;
  description: string;
  issueLevel: IssueLevel;
  screenshotPath?: string;
  screenshotUrl?: string;
  status: TicketStatus;
  internalNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TicketCreateInput {
  department: string;
  module: string;
  description: string;
  issueLevel: IssueLevel;
}
