-- Renovação automática no cartão (assinaturas do Mercado Pago).
alter table public.subscriptions add column if not exists mp_preapproval_id text;
alter table public.subscriptions add column if not exists auto_renew boolean not null default false;
alter table public.subscriptions add column if not exists next_charge timestamptz;

-- Lista do painel passa a mostrar se renova sozinho.
drop function if exists public.admin_subscribers();
create function public.admin_subscribers()
returns table (user_id uuid, email text, name text, plan text, valid_until timestamptz, source text, note text, updated_at timestamptz, auto_renew boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  return query
    select s.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')::text,
      s.plan, s.valid_until, s.source, s.note, s.updated_at, s.auto_renew
    from public.subscriptions s join auth.users u on u.id = s.user_id
    where s.plan <> 'gratis'
    order by s.updated_at desc;
end;
$$;
revoke all on function public.admin_subscribers() from public, anon;
grant execute on function public.admin_subscribers() to authenticated;
