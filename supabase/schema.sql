-- Gumla Ticketing System (Supabase)
-- Run this in Supabase SQL Editor once.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('employee', 'manager', 'support');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('Hold', 'In Progress', 'Done');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'ticket_status') then
    alter type public.ticket_status add value if not exists 'Hold';
    alter type public.ticket_status add value if not exists 'In Progress';
    alter type public.ticket_status add value if not exists 'Done';
    alter type public.ticket_status add value if not exists 'Open';
    alter type public.ticket_status add value if not exists 'Resolved';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'issue_level') then
    create type public.issue_level as enum ('Low', 'Medium', 'High', 'Critical');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_by_email text not null,
  department text not null,
  module text not null,
  description text not null check (char_length(description) >= 10),
  issue_level public.issue_level not null default 'Medium',
  screenshot_path text,
  status public.ticket_status not null default 'Hold',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets add column if not exists issue_level public.issue_level not null default 'Medium';

create index if not exists idx_tickets_created_by on public.tickets(created_by);
create index if not exists idx_tickets_created_at on public.tickets(created_at desc);
create index if not exists idx_tickets_department on public.tickets(department);
create index if not exists idx_tickets_module on public.tickets(module);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_issue_level on public.tickets(issue_level);

alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.tickets enable row level security;

create or replace function public.is_manager_or_support(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('manager', 'support')
  );
$$;

-- Users policies
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
on public.users
for insert
with check (
  auth.uid() = id
  and role = 'employee'
);

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
on public.users
for select
using (
  auth.uid() = id
  or public.is_manager_or_support(auth.uid())
);

drop policy if exists "users_update_self_safe_or_admin" on public.users;
create policy "users_update_self_safe_or_admin"
on public.users
for update
using (
  auth.uid() = id
  or public.is_manager_or_support(auth.uid())
)
with check (
  (auth.uid() = id and role = 'employee')
  or public.is_manager_or_support(auth.uid())
);

-- Departments policies
drop policy if exists "departments_select_all_authed" on public.departments;
create policy "departments_select_all_authed"
on public.departments
for select
using (auth.uid() is not null);

drop policy if exists "departments_manage_admin_only" on public.departments;
create policy "departments_manage_admin_only"
on public.departments
for all
using (public.is_manager_or_support(auth.uid()))
with check (public.is_manager_or_support(auth.uid()));

-- Tickets policies
drop policy if exists "tickets_insert_owner" on public.tickets;
create policy "tickets_insert_owner"
on public.tickets
for insert
with check (
  auth.uid() = created_by
  and status in ('Hold', 'Open')
);

insert into public.departments (name)
values
  ('Content Writer'),
  ('Sales'),
  ('Accounting'),
  ('Purshase'),
  ('Inventory'),
  ('Fleet'),
  ('FlutterApp')
on conflict (name) do nothing;

drop policy if exists "tickets_select_owner_or_admin" on public.tickets;
create policy "tickets_select_owner_or_admin"
on public.tickets
for select
using (
  created_by = auth.uid()
  or public.is_manager_or_support(auth.uid())
);

drop policy if exists "tickets_update_admin_only" on public.tickets;
create policy "tickets_update_admin_only"
on public.tickets
for update
using (public.is_manager_or_support(auth.uid()))
with check (public.is_manager_or_support(auth.uid()));

-- Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('ticket-screenshots', 'ticket-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "storage_select_owner_or_admin" on storage.objects;
create policy "storage_select_owner_or_admin"
on storage.objects
for select
using (
  bucket_id = 'ticket-screenshots'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_manager_or_support(auth.uid())
  )
);

drop policy if exists "storage_insert_owner" on storage.objects;
create policy "storage_insert_owner"
on storage.objects
for insert
with check (
  bucket_id = 'ticket-screenshots'
  and auth.uid()::text = (storage.foldername(name))[1]
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
);

drop policy if exists "storage_delete_owner_or_admin" on storage.objects;
create policy "storage_delete_owner_or_admin"
on storage.objects
for delete
using (
  bucket_id = 'ticket-screenshots'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_manager_or_support(auth.uid())
  )
);
