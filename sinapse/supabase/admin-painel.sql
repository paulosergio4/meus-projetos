-- Painel de administração: listar, adicionar e remover administradores.
-- Cada função confere se quem chama é administrador antes de fazer qualquer coisa.

create or replace function public.admin_list()
returns table (user_id uuid, email text, name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  return query
    select a.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')::text, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

create or replace function public.admin_add(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_id is null then
    raise exception 'Não há conta com esse e-mail. A pessoa precisa entrar no app uma vez com o Google.';
  end if;
  insert into public.admins (user_id) values (v_id) on conflict do nothing;
  return 'ok';
end;
$$;

create or replace function public.admin_remove(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Só administradores.'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'Precisa ficar pelo menos um administrador.'; end if;
  if p_user = (select auth.uid()) then raise exception 'Você não pode remover a si mesmo.'; end if;
  delete from public.admins where user_id = p_user;
  return 'ok';
end;
$$;

revoke all on function public.admin_list() from public, anon;
revoke all on function public.admin_add(text) from public, anon;
revoke all on function public.admin_remove(uuid) from public, anon;
grant execute on function public.admin_list() to authenticated;
grant execute on function public.admin_add(text) to authenticated;
grant execute on function public.admin_remove(uuid) to authenticated;
