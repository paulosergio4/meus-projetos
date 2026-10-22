# Planos do Sinapse

Modelo **freemium com login obrigatório**: a pessoa entra com a conta Google, usa de graça com limites e assina quando bate o limite ou quer recursos a mais. Aprovado em 21/10/2026; preços revistos em 21/10/2026 (Pro R$ 29,90, anual com cerca de 33% de desconto). Preços são o ponto de partida, para ajustar com os primeiros alunos.

| | Grátis | Pro | Residência |
|---|---|---|---|
| Preço mensal | R$ 0 | R$ 29,90 | R$ 49,90 |
| Preço anual | — | R$ 239 (R$ 19,92/mês) | R$ 399 (R$ 33,25/mês) |
| Revisão espaçada e decks prontos | ✓ | ✓ | ✓ |
| Cards novos por dia | 10 | Ilimitados | Ilimitados |
| Criar cards próprios | até 100 | Ilimitados | Ilimitados |
| Cards gerados por IA | 10 por mês | 300 por mês | 1.000 por mês |
| Questões com comentário | 5 por dia | Ilimitadas | Ilimitadas |
| Simulados | 1 por mês | 2 por mês | Ilimitados |
| Cronograma até a prova | Só a contagem | Completo | Completo |
| Caderno de erros e casos clínicos | — | — | ✓ |
| Sincronização, biometria, digitar resposta | ✓ | ✓ | ✓ |

## Regras

- **Teste:** ao criar a conta, 7 dias de Residência. Depois volta ao Grátis sem perder nada do que já estudou.
- **Limite atingido:** aviso com duas saídas, "voltar amanhã" ou "assinar". Nunca interrompe uma revisão em andamento.
- **Recurso de plano maior:** cadeado; ao tocar, abre a tela de planos.
- **A revisão do que já foi estudado nunca é bloqueada**, em nenhum plano.
- **Login obrigatório:** chave `EXIGIR_LOGIN` em `js/config.js`, desligada na fase de testes.

## Implementação

Pronto no app (versão 0.11):

- Tela **Planos** (Ajustes → Seu plano → Ver planos), com mensal e anual.
- Limites do Grátis e cadeados de Pro e Residência, em `js/plans.js`.
- Aviso de limite com "Ver planos" e "Agora não" ou "Volto amanhã". Nunca interrompe uma revisão.
- Teste de 7 dias do Residência contado a partir da criação da conta.
- Tabela `subscriptions` (plano de cada pessoa) e `ai_usage` (cards de IA no mês).
- Limite de IA checado no servidor (`gerar-cards`).

Hoje a chave **`COBRANCA_ATIVA` está desligada**: todo mundo usa tudo de graça e o servidor dá 1.000 cards de IA por mês a cada pessoa.

### Para começar a cobrar

1. Criar a conta no meio de pagamento (Mercado Pago, que aceita Pix e cartão, ou Stripe) e cadastrar os produtos com os preços acima.
2. Criar a função de webhook que recebe a confirmação do pagamento e grava o plano e a validade em `subscriptions`.
3. Ligar o botão "Assinar" ao link de pagamento.
4. Trocar `COBRANCA_ATIVA` para `true` em `js/config.js` e em `supabase/functions/gerar-cards/index.ts`, e publicar.

Os passos 2 a 4 o Claude faz; o 1 precisa da sua conta.

## Por que esses preços

- Custo de IA por assinante, usando o limite inteiro: Pro ~R$ 0,70/mês, Residência ~R$ 2,20/mês (Claude Haiku 5.5).
- Taxa do meio de pagamento (Pix/cartão): reservar uns 5% do preço.
- Pro a R$ 29,90: valor de "assinatura de estudo" do dia a dia, abaixo dos cursinhos de residência.
- Residência a R$ 49,90: teto pedido; inclui caderno de erros, casos e mais IA.
- Anual com ~33% de desconto (R$ 239 e R$ 399) para puxar quem vai estudar o ano todo até a prova.
