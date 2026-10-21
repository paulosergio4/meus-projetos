-- Banco de questões do Sinapse.
-- Todo mundo logado lê as publicadas; só administradores importam, editam e publicam.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin vê a si mesmo" on public.admins;
create policy "admin vê a si mesmo" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  banca text not null,                 -- ex.: ENARE, AREMG, FUVEST
  prova text not null,                 -- ex.: ENARE 2025 - Acesso direto
  ano integer not null,
  numero integer not null,             -- número da questão na prova
  area text not null,                  -- id da área no app (clinica, cirurgia, go, pediatria, preventiva, basico)
  sub text not null,                   -- subtema
  stem text not null,                  -- enunciado
  options jsonb not null,              -- ["texto A", "texto B", ...]
  answer smallint,                     -- índice da alternativa certa, sempre do gabarito oficial (0 = A)
  explanation text,                    -- comentário
  explanation_ai boolean not null default true,  -- comentário escrito pela IA e ainda não revisado
  fact jsonb,                          -- { front, back } para o caderno de erros
  needs_image boolean not null default false,
  image_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'anulada')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prova, ano, numero)
);
alter table public.questions enable row level security;

create index if not exists questions_status_idx on public.questions (status, area);

drop policy if exists "ler publicadas" on public.questions;
create policy "ler publicadas" on public.questions
  for select to authenticated using (status = 'publicada' or (select public.is_admin()));

drop policy if exists "admin grava" on public.questions;
create policy "admin grava" on public.questions
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "admin edita" on public.questions;
create policy "admin edita" on public.questions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin apaga" on public.questions;
create policy "admin apaga" on public.questions
  for delete to authenticated using ((select public.is_admin()));

-- Administrador: a conta do Paulo.
insert into public.admins (user_id)
select id from auth.users where email = 'paulosergiox96@gmail.com'
on conflict do nothing;
