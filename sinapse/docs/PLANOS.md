# Planos do Sinapse

Modelo **freemium com login obrigatório**: a pessoa entra com a conta Google, usa de graça com limites e assina quando bate o limite ou quer recursos a mais. Aprovado em 21/10/2026. Preços são o ponto de partida, para ajustar com os primeiros alunos.

| | Grátis | Pro | Residência |
|---|---|---|---|
| Preço mensal | R$ 0 | R$ 24,90 | R$ 49,90 |
| Preço anual | — | R$ 249 | R$ 499 |
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

## Implementação (quando sair da fase de testes)

1. Tabela `subscriptions` no Supabase (usuário, plano, status, validade, fim do teste) e contadores de uso por dia e por mês, com regras de segurança.
2. Tela de planos no app e cadeados nos recursos; limites checados no app e no servidor (a geração por IA só no servidor).
3. Cobrança com Mercado Pago ou Stripe (Pix e cartão), confirmando o pagamento por webhook numa Edge Function que atualiza o plano.
4. Ligar `EXIGIR_LOGIN`.
