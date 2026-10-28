-- Students Attendance Tracker: Supabase PostgreSQL schema
-- Run this file once in Supabase Dashboard -> SQL Editor.
-- The Express server uses the server-only service role key and enforces application roles.
-- RLS is enabled as defense in depth. Do not expose the service role key to browsers.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null unique check (email = lower(trim(email))),
  password_hash text not null,
  role text not null check (role in ('admin', 'teacher', 'student')),
  student_number text unique,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'student' and student_number is not null) or role <> 'student')
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,20}$'),
  teacher_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.app_users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.app_users(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present', 'Absent')),
  marked_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id, attendance_date)
);

create index if not exists idx_app_users_role_active on public.app_users(role, is_active);
create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_attendance_student_date on public.attendance_records(student_id, attendance_date desc);
create index if not exists idx_attendance_class_date on public.attendance_records(class_id, attendance_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at before update on public.app_users
for each row execute function public.set_updated_at();
drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes
for each row execute function public.set_updated_at();
drop trigger if exists attendance_updated_at on public.attendance_records;
create trigger attendance_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();

-- RLS is enabled. The browser has no database credentials and accesses data through Express.
-- The server uses the Supabase service-role key, which bypasses RLS. Therefore every private
-- route MUST use backend authentication/authorization checks (implemented in backend/).
-- No anon policies are intentionally created: browser-side direct table access is not supported.
alter table public.app_users enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance_records enable row level security;

-- This schema uses custom app_users authentication rather than Supabase Auth identities.
-- Do not add broad anon/authenticated policies to these tables.
