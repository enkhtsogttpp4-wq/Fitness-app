-- ═══════════════════════════════════════════════════════════════
--  ХҮЧ — Supabase өгөгдлийн бааз
--  Ажиллуулах: Supabase → төслөө нээх → SQL Editor → энэ файлыг
--  бүхэлд нь буулгаад RUN дарна. Дахин ажиллуулж болно (idempotent).
-- ═══════════════════════════════════════════════════════════════

-- ───────── 1. ХҮСНЭГТҮҮД ─────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  sex        text,
  age        int,
  height     numeric,
  weight     numeric,
  body_fat   numeric,
  goal       text,
  exp        text,
  days       int,
  activity   numeric,
  meals      int,
  updated_at timestamptz default now()
);

create table if not exists public.measurements (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  d          date not null,
  weight     numeric,
  chest      numeric,
  waist      numeric,
  hip        numeric,
  arm        numeric,
  thigh      numeric,
  note       text,
  deleted    boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.workout_sets (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  d            date not null,
  day_idx      int,
  exercise_key text,
  set_no       int,
  weight       numeric,
  reps         int,
  rir          int,
  deleted      boolean default false,
  updated_at   timestamptz default now()
);

create table if not exists public.food_entries (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  d          date not null,
  slot       text,
  name       text,
  unit       text,
  amount     numeric,
  kcal       numeric,
  protein    numeric,
  fat        numeric,
  carb       numeric,
  deleted    boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.photos (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  d          date not null,
  path       text,
  note       text,
  deleted    boolean default false,
  updated_at timestamptz default now()
);

-- ───────── 2. ИНДЕКС ─────────
create index if not exists measurements_user_d on public.measurements(user_id, d);
create index if not exists workout_sets_user_d on public.workout_sets(user_id, d);
create index if not exists food_entries_user_d on public.food_entries(user_id, d);
create index if not exists photos_user_d       on public.photos(user_id, d);

-- ───────── 3. ROW LEVEL SECURITY ─────────
-- Энэ хэсэггүйгээр бүх хэрэглэгч бие биенийхээ өгөгдлийг харна. ЗААВАЛ.

alter table public.profiles     enable row level security;
alter table public.measurements enable row level security;
alter table public.workout_sets enable row level security;
alter table public.food_entries enable row level security;
alter table public.photos       enable row level security;

drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own_measurements" on public.measurements;
create policy "own_measurements" on public.measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_workout_sets" on public.workout_sets;
create policy "own_workout_sets" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_food_entries" on public.food_entries;
create policy "own_food_entries" on public.food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_photos" on public.photos;
create policy "own_photos" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── 4. ЗУРГИЙН САН (STORAGE) ─────────
insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

-- Зам нь  <user_id>/<photo_id>.jpg  хэлбэртэй байх ба
-- эхний хавтас нь эзний user_id-тай таарч байж л зөвшөөрнө.
drop policy if exists "photos_select_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_insert_own" on storage.objects;
create policy "photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_update_own" on storage.objects;
create policy "photos_update_own" on storage.objects for update
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_delete_own" on storage.objects for delete
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── 5. ШИНЭ ХЭРЭГЛЭГЧИЙН ПРОФАЙЛ АВТОМАТААР ─────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
--  Дууслаа. Шалгах:  Table Editor дээр 5 хүснэгт, Storage дээр
--  "progress" bucket харагдах ёстой.
-- ═══════════════════════════════════════════════════════════════
