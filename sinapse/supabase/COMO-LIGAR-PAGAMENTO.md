# Ligar o pagamento (Mercado Pago)

Tudo já está pronto no app e no servidor (funções `pagamento` e `mp-webhook`). Faltam os passos da sua conta.

1. Crie a conta em https://www.mercadopago.com.br (pode ser como pessoa física; depois dá para trocar para CNPJ).
2. Entre em https://www.mercadopago.com.br/developers/panel/app → **Criar aplicação**:
   - Nome: Sinapse · Tipo: **Pagamentos on-line** · Produto: **Checkout Pro**.
3. Na aplicação, **Credenciais de produção** → copie o **Access Token** (começa com `APP_USR-`).
4. No Supabase → Edge Functions → **Secrets** (https://supabase.com/dashboard/project/ayfgyfilupghdwgjmxot/functions/secrets):
   - `MP_ACCESS_TOKEN` = o Access Token.
5. Na aplicação do Mercado Pago → **Webhooks** → Configurar notificações:
   - Modo produção · URL: `https://ayfgyfilupghdwgjmxot.supabase.co/functions/v1/mp-webhook`
   - Evento: **Pagamentos** → Salvar.
   - Copie a **Assinatura secreta** e crie no Supabase o segredo `MP_WEBHOOK_SECRET`.
6. Avise o Claude: ele liga `COBRANCA_ATIVA` no app e no servidor e faz um pagamento de teste.

As chaves ficam só no Supabase. Nunca mande por mensagem.

## Como funciona

- O aluno toca em **Assinar**, paga na página do Mercado Pago (Pix ou cartão; anual em até 12x) e volta para o app.
- O Mercado Pago avisa a função `mp-webhook`, que confere o pagamento direto na API (aprovado, em reais, valor certo) e libera o plano: mensal = 31 dias, anual = 366 dias. Se já tinha o mesmo plano, soma ao prazo.
- Cada pagamento libera uma vez só (tabela `payments`).
- Taxas do Mercado Pago saem do valor recebido (confira as taxas atuais no site deles).
