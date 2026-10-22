// Planos do Sinapse: o que cada um libera e os limites do Grátis.
// Enquanto COBRANCA_ATIVA for false, tudo fica liberado para todos.
import { COBRANCA_ATIVA } from './config.js';

const INF = Infinity;

export const PLANS = [
  {
    id: 'gratis', name: 'Grátis', tagline: 'Para começar a revisar',
    monthly: 0, yearly: 0,
    features: ['Revisão espaçada e decks prontos', '10 cards novos por dia', 'Até 100 cards próprios', '10 cards gerados por IA por mês', '5 questões comentadas por dia', '1 simulado por mês', 'Contagem até a prova'],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Para estudar todo dia', highlight: true,
    monthly: 29.9, yearly: 239,
    features: ['Cards novos ilimitados', 'Cards próprios ilimitados', '300 cards gerados por IA por mês', 'Questões comentadas ilimitadas', '2 simulados por mês', 'Cronograma completo até a prova'],
  },
  {
    id: 'residencia', name: 'Residência', tagline: 'Reta final para a prova',
    monthly: 59.9, yearly: 479,
    features: ['Tudo do Pro', '1.000 cards gerados por IA por mês', 'Simulados ilimitados', 'Caderno de erros', 'Casos clínicos', 'Prioridade em novidades'],
  },
];

export const LIMITS = {
  gratis: { newPerDay: 10, customCards: 100, aiPerMonth: 10, questionsPerDay: 5, simuladosPerMonth: 1, cronograma: false, erros: false, casos: false },
  pro: { newPerDay: INF, customCards: INF, aiPerMonth: 300, questionsPerDay: INF, simuladosPerMonth: 2, cronograma: true, erros: false, casos: false },
  residencia: { newPerDay: INF, customCards: INF, aiPerMonth: 1000, questionsPerDay: INF, simuladosPerMonth: INF, cronograma: true, erros: true, casos: true },
};

export const TRIAL_DAYS = 7;

export function cobrancaAtiva() {
  return COBRANCA_ATIVA;
}

export function planById(id) {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

// Plano em vigor. sub = linha da tabela subscriptions (ou null); createdAt = criação da conta.
export function effectivePlan(sub, createdAt) {
  if (!COBRANCA_ATIVA) return { id: 'residencia', trial: false, testing: true };
  const now = Date.now();
  if (sub && sub.plan && sub.plan !== 'gratis' && (!sub.valid_until || new Date(sub.valid_until).getTime() > now)) {
    return { id: sub.plan, trial: false, validUntil: sub.valid_until || null };
  }
  const created = createdAt ? new Date(createdAt).getTime() : 0;
  const trialEnd = created + TRIAL_DAYS * 86400000;
  if (created && now < trialEnd) return { id: 'residencia', trial: true, trialEnd };
  return { id: 'gratis', trial: false };
}

export function limitsFor(planId) {
  return LIMITS[planId] || LIMITS.gratis;
}

// Qual plano mínimo libera um recurso (para o texto do aviso).
export const FEATURE_INFO = {
  questoes: { title: 'Você fez as 5 questões grátis de hoje', text: 'Amanhã libera mais 5. No Pro, as questões comentadas são ilimitadas.', min: 'pro', daily: true },
  simulado: { title: 'Você já fez o simulado do mês', text: 'No Pro são 2 simulados por mês; no Residência, ilimitados.', min: 'pro' },
  cardsProprios: { title: 'Você chegou a 100 cards próprios', text: 'Os cards que você já criou continuam na revisão. No Pro, crie quantos quiser.', min: 'pro' },
  cronograma: { title: 'Cronograma completo é do Pro', text: 'No Grátis você vê a contagem até a prova. O Pro monta a meta de cada dia até lá.', min: 'pro' },
  erros: { title: 'Caderno de erros é do Residência', text: 'Refaça só o que você errou, com cards criados automaticamente a partir dos erros.', min: 'residencia' },
  casos: { title: 'Casos clínicos são do Residência', text: 'Treine a conduta passo a passo, como na prova prática.', min: 'residencia' },
  ia: { title: 'Você usou os cards de IA do mês', text: 'Eles renovam no dia 1º. No Pro são 300 por mês; no Residência, 1.000.', min: 'pro' },
};

export function fmtPrice(v) {
  return v ? `R$ ${v.toFixed(2).replace('.', ',')}` : 'R$ 0';
}
