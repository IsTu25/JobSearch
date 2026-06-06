-- Enable pgvector extension for semantic similarity search
create extension if not exists vector;

-- Profiles table for user information
create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  target_role text,
  target_location text,
  experience_level text,
  preferred_salary text,
  cv_text text,
  cv_file_name text,
  cv_score integer,
  updated_at timestamptz default now()
);

-- CV chunks with database-backed real embeddings
create table if not exists cv_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  section text not null,
  content text not null,
  embedding vector(768), -- matching Google's text-embedding-004 output size
  created_at timestamptz default now()
);

-- Index for HNSW (Hierarchical Navigable Small World) cosine similarity matching
create index if not exists cv_chunks_embedding_idx on cv_chunks using hnsw (embedding vector_cosine_ops);

-- Applications tracking table (Kanban states)
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company text not null,
  role text not null,
  status text check (status in ('saved','applied','interviewing','offer','rejected')) not null,
  applied_date timestamptz default now() not null,
  notes text default '',
  url text default '',
  source text default 'Manual',
  updated_at timestamptz default now() not null
);

-- Goals tracking table (Calendar / Deadlines)
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  text text not null,
  deadline date,
  done boolean default false not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table profiles enable row level security;
alter table cv_chunks enable row level security;
alter table applications enable row level security;
alter table goals enable row level security;

-- Row Level Security policies: Users can only select, insert, update, or delete their own data
drop policy if exists "Users can manage their own profile" on profiles;
create policy "Users can manage their own profile"
  on profiles for all
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their own CV chunks" on cv_chunks;
create policy "Users can manage their own CV chunks"
  on cv_chunks for all
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their own applications" on applications;
create policy "Users can manage their own applications"
  on applications for all
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their own goals" on goals;
create policy "Users can manage their own goals"
  on goals for all
  using (auth.uid() = user_id);

