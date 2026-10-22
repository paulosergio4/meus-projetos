-- Pagamentos (Mercado Pago) e acessos liberados pelo administrador.

-- De onde veio o plano: pagamento, cortesia (liberado no painel) ou teste.
alter table public.subscriptions add column if not exists source text not null default 'pagamento';
alter table public.subscriptions add column if not exists note text;
alter table public.subscriptions add column if not exists granted_by uuid references auth.users (id) on delete set null;

-- Cada pagamento aprovado (o id do Mercado Pago evita liberar duas vezes o mesmo pagamento).
create table if not exists public.payments (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  plan text not null,
  period text not null check (period in ('mensal', 'anual')),
  amount numeric(10, 2) not null,
  status text not null,
  method text,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists "ver os próprios pagamentos" on public.payments;
create policy "ver os próprios pagamentos" on public.payments
  for select to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));

-- Liberar acesso sem pagar. p_until nulo = sem prazo.
create or replace function public.admin_grant(p_email text, p_plan text, p_until timestamptz, p_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  if p_plan not in ('pro', 'residencia') then raise exception 'Plano inválido.'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_id is null then raise exception 'Não há conta com esse e-mail. A pessoa precisa entrar no app uma vez com o Google.'; end if;
  insert into public.subscriptions (user_id, plan, valid_until, source, note, granted_by, updated_at)
  values (v_id, p_plan, p_until, 'cortesia', nullif(trim(p_note), ''), (select auth.uid()), now())
  on conflict (user_id) do update set plan = excluded.plan, valid_until = excluded.valid_until, source = 'cortesia',
    note = excluded.note, granted_by = excluded.granted_by, updated_at = now();
  return 'ok';
end;
$$;

create or replace function public.admin_revoke(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  update public.subscriptions set plan = 'gratis', valid_until = null, source = 'cortesia', note = 'revogado', updated_at = now() where user_id = p_user;
  return 'ok';
end;
$$;

-- Lista de quem tem plano (pago ou liberado).
create or replace function public.admin_subscribers()
returns table (user_id uuid, email text, name text, plan text, valid_until timestamptz, source text, note text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  return query
    select s.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')::text,
      s.plan, s.valid_until, s.source, s.note, s.updated_at
    from public.subscriptions s join auth.users u on u.id = s.user_id
    where s.plan <> 'gratis'
    order by s.updated_at desc;
end;
$$;

revoke all on function public.admin_grant(text, text, timestamptz, text) from public, anon;
revoke all on function public.admin_revoke(uuid) from public, anon;
revoke all on function public.admin_subscribers() from public, anon;
grant execute on function public.admin_grant(text, text, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke(uuid) to authenticated;
grant execute on function public.admin_subscribers() to authenticated;
