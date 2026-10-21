-- Parte da IA: plano de cada pessoa e uso mensal de cards gerados.
-- O app só lê; quem grava é a função gerar-cards (com a chave de serviço, no servidor).

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratis' check (plan in ('gratis', 'pro', 'residencia')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,              -- 'AAAA-MM', fuso de Brasília
  cards integer not null default 0,
  generations integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.subscriptions enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "ver o próprio plano" on public.subscriptions;
create policy "ver o próprio plano" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ver o próprio uso de IA" on public.ai_usage;
create policy "ver o próprio uso de IA" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Soma o uso de forma atômica. Só a chave de serviço (a função no servidor) pode chamar.
create or replace function public.ai_add_usage(p_user uuid, p_month text, p_cards integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, month, cards, generations, updated_at)
  values (p_user, p_month, p_cards, 1, now())
  on conflict (user_id, month) do update
    set cards = u.cards + excluded.cards, generations = u.generations + 1, updated_at = now()
  returning cards;
$$;

revoke all on function public.ai_add_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.ai_add_usage(uuid, text, integer) to service_role;
