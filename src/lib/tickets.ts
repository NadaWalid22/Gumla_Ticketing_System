import { supabase } from './supabase';
import type {
  AppUser,
  IssueLevel,
  Ticket,
  TicketCreateInput,
  TicketStatus,
  UserRole,
} from '../types';
import { MAX_SCREENSHOT_MB } from './constants';

const SCREENSHOT_BUCKET = 'ticket-screenshots';

type TicketRow = {
  id: string;
  created_by: string;
  created_by_email: string;
  department: string;
  module: string;
  description: string;
  issue_level: IssueLevel;
  screenshot_path: string | null;
  status: TicketStatus;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
};

type DepartmentRow = {
  id: string;
  name: string;
};

function normalizeStatus(status: TicketStatus): TicketStatus {
  if (status === 'Open') return 'Hold';
  if (status === 'Resolved') return 'Done';
  return status;
}

function toTimestamp(value: string): number {
  return new Date(value).getTime();
}

function mapUser(row: UserRow): AppUser {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    role: row.role,
    createdAt: toTimestamp(row.created_at),
  };
}

async function toTicket(row: TicketRow): Promise<Ticket> {
  let screenshotUrl: string | undefined;

  if (row.screenshot_path) {
    const { data } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrl(row.screenshot_path, 60 * 60);

    screenshotUrl = data?.signedUrl;
  }

  return {
    id: row.id,
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    department: row.department,
    module: row.module,
    description: row.description,
    issueLevel: row.issue_level,
    screenshotPath: row.screenshot_path ?? undefined,
    screenshotUrl,
    status: normalizeStatus(row.status),
    internalNotes: row.internal_notes ?? undefined,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string;
  defaultRole?: UserRole;
}): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', params.uid)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const { error: insertError } = await supabase.from('users').insert({
      id: params.uid,
      email: params.email,
      display_name: params.displayName ?? '',
      role: params.defaultRole ?? 'employee',
    });

    if (insertError) {
      throw insertError;
    }
  }
}

export async function getCurrentUserProfile(uid: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .maybeSingle<UserRow>();

  if (error) {
    throw error;
  }

  return data ? mapUser(data) : null;
}

export async function uploadTicketScreenshot(file: File, uid: string): Promise<{ path: string; url: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  const maxBytes = MAX_SCREENSHOT_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Image must be less than ${MAX_SCREENSHOT_MB}MB.`);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${uid}/${timestamp}_${safeName}`;

  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 60 * 60);

  return { path, url: data?.signedUrl ?? '' };
}

export async function getDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id,name')
    .order('name', { ascending: true })
    .returns<DepartmentRow[]>();

  if (error || !data) {
    throw error ?? new Error('Failed to load departments.');
  }

  return data.map((d) => d.name);
}

export async function addDepartment(name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Department name is required.');
  }

  const { error } = await supabase.from('departments').insert({ name: cleanName });
  if (error) {
    throw error;
  }
}

export async function deleteDepartment(name: string): Promise<void> {
  const { error } = await supabase.from('departments').delete().eq('name', name);
  if (error) {
    throw error;
  }
}

export async function createTicket(
  input: TicketCreateInput,
  screenshot?: { path: string; url: string }
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    throw new Error('You must be logged in to submit a ticket.');
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      created_by: user.id,
      created_by_email: user.email,
      department: input.department,
      module: input.module,
      description: input.description.trim(),
      issue_level: input.issueLevel,
      screenshot_path: screenshot?.path ?? null,
      status: 'Hold',
      internal_notes: '',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create ticket.');
  }

  return data.id;
}

export async function getEmployeeTickets(uid: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('created_by', uid)
    .order('created_at', { ascending: false })
    .returns<TicketRow[]>();

  if (error || !data) {
    throw error ?? new Error('Failed to load tickets.');
  }

  return Promise.all(data.map((row) => toTicket(row)));
}

export async function getAllTickets(filters?: {
  department?: string;
  module?: string;
  status?: string;
  issueLevel?: string;
}): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.department) {
    query = query.eq('department', filters.department);
  }

  if (filters?.module) {
    query = query.eq('module', filters.module);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.issueLevel) {
    query = query.eq('issue_level', filters.issueLevel);
  }

  const { data, error } = await query.returns<TicketRow[]>();

  if (error || !data) {
    throw error ?? new Error('Failed to load tickets.');
  }

  return Promise.all(data.map((row) => toTicket(row)));
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    throw error;
  }
}

export async function updateTicketNotes(ticketId: string, internalNotes: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ internal_notes: internalNotes, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) {
    throw error;
  }
}

export async function deleteScreenshotByPath(path: string): Promise<void> {
  if (!path) return;

  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}
