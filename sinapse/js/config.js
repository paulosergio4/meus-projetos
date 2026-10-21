// Configuração do app. Nada aqui é segredo: a URL do Supabase, a chave publicável
// e o Client ID do Google podem ficar no repositório público.

// Supabase (login com Google + progresso salvo na conta).
// Em supabase.com → seu projeto → Project Settings → API:
//   SUPABASE_URL = "Project URL"   (ex.: https://abcdefgh.supabase.co)
//   SUPABASE_KEY = "Publishable key" (sb_publishable_...) ou a antiga "anon public"
// Vazios = o app funciona só no aparelho, como antes.
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

// Login com Google sem Supabase (opcional, só identifica a pessoa, não salva na nuvem).
// Com o Supabase configurado, este campo não é usado: o Client ID vai no painel do Supabase.
export const GOOGLE_CLIENT_ID = '';
