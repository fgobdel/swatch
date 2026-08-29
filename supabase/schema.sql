-- ============================================================
-- Swatch database schema
-- Run this once in Supabase: Project → SQL Editor → New query
-- → paste this whole file → Run
-- ============================================================

-- one row per username ("login" with no password)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  secret_word text,  -- the lightweight "no password, just a secret word" login
  created_at timestamptz not null default now()
);

-- the single shared inspiration board, one row per saved image
create table if not exists board_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  image_path text not null,      -- path inside the storage bucket
  position int not null default 0, -- drag-to-reorder position
  created_at timestamptz not null default now()
);

-- a set = one full manicure plan
create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  notes text not null default '',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- the 10 finger slots that belong to a set
create table if not exists set_slots (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  finger_key text not null,      -- e.g. 'left_thumb' ... 'right_pinky'
  image_path text,               -- null until filled in
  note text not null default '',
  unique (set_id, finger_key)
);

-- ------------------------------------------------------------
-- Row Level Security
-- Since there's no real password/auth, we can't check "is this
-- really that user" server-side — these policies just allow the
-- app to read/write freely with the public key. That matches the
-- "no password, lightweight" design, but means there's no real
-- per-user privacy at the database level.
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table board_images enable row level security;
alter table sets enable row level security;
alter table set_slots enable row level security;

create policy "profiles read" on profiles for select using (true);
create policy "profiles insert" on profiles for insert with check (true);

create policy "board_images all" on board_images for all using (true) with check (true);
create policy "sets all" on sets for all using (true) with check (true);
create policy "set_slots all" on set_slots for all using (true) with check (true);

-- ------------------------------------------------------------
-- Storage bucket for uploaded photos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('swatch-images', 'swatch-images', true)
on conflict (id) do nothing;

create policy "swatch-images public read"
  on storage.objects for select
  using (bucket_id = 'swatch-images');

create policy "swatch-images public insert"
  on storage.objects for insert
  with check (bucket_id = 'swatch-images');

create policy "swatch-images public update"
  on storage.objects for update
  using (bucket_id = 'swatch-images');

create policy "swatch-images public delete"
  on storage.objects for delete
  using (bucket_id = 'swatch-images');
