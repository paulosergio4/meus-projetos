// Configuração do app. Nada aqui é segredo: a URL do Supabase, a chave publicável
// e o Client ID do Google podem ficar no repositório público.

// Supabase (login com Google + progresso salvo na conta).
// Em supabase.com → seu projeto → Project Settings → API:
//   SUPABASE_URL = "Project URL"   (ex.: https://abcdefgh.supabase.co)
//   SUPABASE_KEY = "Publishable key" (sb_publishable_...) ou a antiga "anon public"
// Vazios = o app funciona só no aparelho, como antes.
export const SUPABASE_URL = 'https://ayfgyfilupghdwgjmxot.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Lnunh3Bpn7gbhoffmowW6w_vRnrCBHh';

// Liga o login com Google pela nuvem. Fica false até o provedor Google estar ativo no
// painel do Supabase (Authentication → Sign In / Providers → Google); antes disso o
// botão do Google entra em modo demonstração, para não levar a uma página de erro.
export const CLOUD_LOGIN_READY = true;

// Login obrigatório: quando true, some o "Continuar sem conta" e só entra quem fizer
// login com o Google. Fica false durante a fase de testes.
export const EXIGIR_LOGIN = true;

// Login com Google sem Supabase (opcional, só identifica a pessoa, não salva na nuvem).
// Com o Supabase configurado, este campo não é usado: o Client ID vai no painel do Supabase.
export const GOOGLE_CLIENT_ID = '';

// Cobrança dos planos. false = fase de testes: todo mundo usa tudo de graça (inclusive
// 1.000 cards de IA por mês) e a tela de planos mostra "em breve". Para começar a cobrar,
// basta trocar para true aqui e em supabase/functions/gerar-cards (COBRANCA_ATIVA) e
// ligar o pagamento (ver docs/PLANOS.md).
export const COBRANCA_ATIVA = false;
