-- Ataşehir Fitness - Memnuniyet Anketi Şeması
create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_number text not null unique, -- 905551234567 formatı
  survey_status text not null default 'bekliyor'
    check (survey_status in ('bekliyor','davet_gonderildi','devam_ediyor','tamamlandi','reddetti')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  sender text not null check (sender in ('user','bot')),
  content text not null,
  wa_message_id text unique, -- Meta mesaj id'si (tekrar işlemeyi önler)
  created_at timestamptz not null default now()
);
create index if not exists messages_member_idx on public.messages(member_id, created_at);

create table if not exists public.survey_analyses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  overall_score int not null check (overall_score between 1 and 10),
  equipment_score int not null check (equipment_score between 1 and 10),
  hygiene_score int not null check (hygiene_score between 1 and 10),
  staff_score int not null check (staff_score between 1 and 10),
  sentiment text not null check (sentiment in ('pozitif','notr','negatif')),
  summary text not null,
  critical_alert boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists analyses_member_idx on public.survey_analyses(member_id, created_at desc);

-- Tüm erişim server tarafında service role ile yapılır; anon erişimi kapalı.
alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.survey_analyses enable row level security;
