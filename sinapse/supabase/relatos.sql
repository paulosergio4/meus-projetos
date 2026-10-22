-- Relatos de erro enviados pelos alunos (questões e cards).
-- Qualquer pessoa logada envia; só administradores veem e resolvem.

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions (id) on delete cascade,  -- questão do banco (se for)
  ref text,                                                               -- card ou questão de exemplo
  ref_text text,                                                          -- texto do card, para contexto
  reason text not null check (reason in ('gabarito', 'enunciado', 'comentario', 'imagem', 'outro')),
  message text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido', 'descartado')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.question_reports enable row level security;
create index if not exists question_reports_status_idx on public.question_reports (status, created_at desc);

drop policy if exists "aluno envia relato" on public.question_reports;
create policy "aluno envia relato" on public.question_reports
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'aberto');

drop policy if exists "admin vê relatos" on public.question_reports;
create policy "admin vê relatos" on public.question_reports
  for select to authenticated using ((select public.is_admin()) or (select auth.uid()) = user_id);

drop policy if exists "admin resolve relatos" on public.question_reports;
create policy "admin resolve relatos" on public.question_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin apaga relatos" on public.question_reports;
create policy "admin apaga relatos" on public.question_reports
  for delete to authenticated using ((select public.is_admin()));
