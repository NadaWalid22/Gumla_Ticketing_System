# Gumla Internal Ticketing System (Supabase)

A lightweight internal issue ticketing app for Gumla employees, managers, and support team.

## 1) System Architecture

### Frontend
- React + TypeScript + Vite
- Deployed on free static hosting (Vercel recommended)

### Backend
- Supabase Authentication (Email/Password)
- Supabase Postgres (tickets + users + roles)
- Supabase Storage (ticket screenshots)
- Security via Row Level Security (RLS) + Storage policies

### Access model
- `employee`: can create tickets, can only read own tickets
- `manager` / `support`: can read all tickets, filter, update status, add notes
- Ticket statuses: `Hold`, `In Progress`, `Done`

---

## 2) Database Schema

### `public.users`
```sql
id uuid primary key references auth.users(id)
email text not null unique
display_name text
role user_role not null default 'employee' -- employee | manager | support
created_at timestamptz not null default now()
```

### `public.tickets`
```sql
id uuid primary key default gen_random_uuid()
created_by uuid not null references auth.users(id)
created_by_email text not null
department text not null
module text not null
description text not null
screenshot_path text
status ticket_status not null default 'Open' -- Open | In Progress | Resolved
internal_notes text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Full SQL (tables + RLS + storage policies): [supabase/schema.sql](/Users/nada/Downloads/Gumla_Ticketing_System/supabase/schema.sql)

---

## 3) Project Structure

```txt
.
├── src
│   ├── components
│   │   └── ProtectedRoute.tsx
│   ├── context
│   │   └── AuthContext.tsx
│   ├── lib
│   │   ├── constants.ts
│   │   ├── supabase.ts
│   │   └── tickets.ts
│   ├── pages
│   │   ├── AdminDashboardPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── SubmissionPage.tsx
│   ├── types
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── supabase
│   └── schema.sql
├── .env.example
└── README.md
```

---

## 4) Key Code Snippets

### A) Ticket submission
File: `src/lib/tickets.ts`

```ts
const { data, error } = await supabase
  .from('tickets')
  .insert({
    created_by: user.id,
    created_by_email: user.email,
    department: input.department,
    module: input.module,
    description: input.description.trim(),
    screenshot_path: screenshot?.path ?? null,
    status: 'Open',
    internal_notes: '',
  })
  .select('id')
  .single();
```

### B) Image upload
File: `src/lib/tickets.ts`

```ts
const path = `${uid}/${Date.now()}_${safeName}`;
const { error } = await supabase.storage.from('ticket-screenshots').upload(path, file, {
  cacheControl: '3600',
  contentType: file.type,
  upsert: false,
});
```

### C) Authentication
File: `src/context/AuthContext.tsx`

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
const { data, error } = await supabase.auth.signUp({ email, password });
```

### D) Role handling
Files: `src/context/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `supabase/schema.sql`

```ts
isManagerOrSupport: profile?.role === 'manager' || profile?.role === 'support'
```

```ts
if (requireManager && !isManagerOrSupport) {
  return <Navigate to="/" replace />;
}
```

```sql
create policy "tickets_select_owner_or_admin"
on public.tickets
for select
using (created_by = auth.uid() or public.is_manager_or_support(auth.uid()));
```

---

## 5) Step-by-Step Setup (Supabase Free)

### Step 1: Create Supabase project
1. Go to Supabase dashboard.
2. Create a new project (free plan).
3. Wait for DB initialization.

### Step 2: Run SQL schema
1. Open SQL Editor in Supabase.
2. Copy/paste all content of [supabase/schema.sql](/Users/nada/Downloads/Gumla_Ticketing_System/supabase/schema.sql).
3. Run it once.

### Step 3: Configure Auth
1. Supabase Dashboard -> Authentication -> Providers -> Email
2. Enable Email provider.
3. Recommended for internal tool: disable "Confirm email" so users can sign in immediately after register.

### Step 4: Configure local env
1. Copy `.env.example` to `.env`.
2. Get values from Supabase -> Project Settings -> API.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Step 5: Install and run
```bash
npm install
npm run dev
```

### Step 6: Role assignment
- New users are created as `employee` automatically.
- Promote managers/support in Supabase table editor:
  - table: `public.users`
  - change `role` to `manager` or `support`
- Managers/support can now manage department values from `/admin` -> `Department Settings`.

---

## 6) Deployment Instructions (Free Hosting)

### GitHub Pages + gumlanow.com subdomain
1. Push this repo to GitHub.
2. In repo settings, enable GitHub Pages and use `gh-pages` branch as source.
3. Install once and deploy:
```bash
npm install
npm run deploy
```
4. Add repository Secrets/Variables for runtime in GitHub if needed for builds (or build locally and deploy branch output):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. DNS at your domain provider (`gumlanow.com`):
   - Create `CNAME` record: `tickets` -> `<your-github-username>.github.io`
6. In GitHub repo -> Settings -> Pages -> Custom domain:
   - set `tickets.gumlanow.com`
   - enable HTTPS after DNS propagates.

The repo includes [CNAME](/Users/nada/Downloads/Gumla_Ticketing_System/public/CNAME) with `tickets.gumlanow.com`.

---

## 7) Assumptions and Limitations

### Assumptions
- Internal Gumla employees only.
- Role promotion is managed manually by admin.
- Screenshot uploads are image-only and max 3MB in client validation.

### Limitations
- No notifications/escalation workflow yet.
- Signed screenshot URLs are temporary (regenerated on data fetch).
- Manager/support role assignment is manual.

---

## Security Notes
- RLS prevents employees from accessing other users' tickets.
- Only manager/support can update ticket status and notes.
- Storage policies enforce user-folder ownership and role-based read access.
