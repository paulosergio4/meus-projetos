# Ligar a IA do Sinapse

O app e a função `gerar-cards` já estão prontos e publicados. Faltam os passos que usam a sua conta.

## 1. Tabelas (uma vez)

No Supabase, **SQL Editor → New query**, cole `supabase/ia.sql` e clique em **Run**.

## 2. Conta da API do Claude

1. Entre em https://platform.claude.com e crie a conta (é separada do plano do Claude.ai).
2. **Billing**: coloque créditos (o mínimo já dá para muitos testes).
3. **API Keys → Create Key**, nome `sinapse`. Copie a chave (começa com `sk-ant-`). Ela só aparece uma vez.

## 3. Guardar a chave no Supabase

Em https://supabase.com/dashboard/project/ayfgyfilupghdwgjmxot/functions/secrets

- **Name**: `ANTHROPIC_API_KEY`
- **Value**: a chave copiada
- **Save**

A chave fica só no servidor. Nunca coloque no código nem mande por mensagem.

Opcional: um segredo `AI_MODEL` troca o modelo (padrão `claude-haiku-5-5`, o mais barato e rápido; `claude-sonnet-5-5` escreve melhor e custa mais).

## Como funciona

- O app manda o PDF (até 10 MB) ou o texto para a função `gerar-cards`.
- A função confere o login, o plano e quantos cards a pessoa já gerou no mês (Grátis 10, Pro 300, Residência 1.000).
- Pede os cards ao Claude, usando só o conteúdo do material, e devolve para a pessoa aprovar.
- O uso fica na tabela `ai_usage`; o plano, na `subscriptions` (sem linha = Grátis).

## Dar um plano para alguém (enquanto não há pagamento)

```sql
insert into public.subscriptions (user_id, plan)
select id, 'residencia' from auth.users where email = 'email@da.pessoa'
on conflict (user_id) do update set plan = excluded.plan, updated_at = now();
```
