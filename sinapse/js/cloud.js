// Nuvem: login com Google pelo Supabase e progresso salvo na conta.
// Só é carregado quando SUPABASE_URL e SUPABASE_KEY estão preenchidos em config.js.
import { SUPABASE_URL, SUPABASE_KEY, CLOUD_LOGIN_READY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/dist/umd/supabase.js';
const TABLE = 'progress';

let client = null;
let loading = null;

export function cloudEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && CLOUD_LOGIN_READY);
}

export function loadCloud() {
  if (!cloudEnabled()) return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SUPABASE_JS;
    s.async = true;
    s.onload = () => {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
        resolve(client);
      } catch (e) {
        resolve(null);
      }
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

// Volta para a mesma página do app depois do Google (funciona no GitHub Pages e no localhost).
function returnUrl() {
  return location.origin + location.pathname;
}

export async function signInWithGoogle() {
  const c = await loadCloud();
  if (!c) throw new Error('Não foi possível conectar ao servidor.');
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
  if (error) throw error;
}

export async function currentCloudUser() {
  const c = await loadCloud();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? data.session.user : null;
}

export function userFromSession(u) {
  const m = u.user_metadata || {};
  return { name: m.full_name || m.name || '', email: u.email || '', picture: m.avatar_url || m.picture || '', provider: 'google', cloud: true, id: u.id, createdAt: u.created_at || null };
}

export async function signOutCloud() {
  const c = await loadCloud();
  if (c) await c.auth.signOut();
}

export async function pullProgress(userId) {
  const c = await loadCloud();
  if (!c) return null;
  const { data, error } = await c.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function pushProgress(userId, payload) {
  const c = await loadCloud();
  if (!c) return;
  const { error } = await c.from(TABLE).upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteCloudProgress(userId) {
  const c = await loadCloud();
  if (!c) return;
  const { error } = await c.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}

// A volta do Google traz ?code= na URL; o app mostra "Entrando..." enquanto troca o código pela sessão.
export function isOAuthReturn() {
  return /[?&]code=/.test(location.search) || /access_token=/.test(location.hash);
}

// IA: chama a função gerar-cards no servidor (a chave da IA fica só lá).
// body: { action: 'uso' } para consultar o limite, ou { pdf | text, area, sub, count, types, fase }.
export async function callGerarCards(body) {
  const c = await loadCloud();
  if (!c) throw Object.assign(new Error('Sem conexão com o servidor. Confira a internet.'), { code: 'rede' });
  const { data, error } = await c.functions.invoke('gerar-cards', { body });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* resposta sem corpo */ }
    const msg = info.message || (error.name === 'FunctionsFetchError' ? 'Sem conexão com o servidor. Confira a internet.' : 'Não foi possível gerar agora. Tente de novo.');
    throw Object.assign(new Error(msg), { code: info.error || 'falha', info });
  }
  return data;
}

// Plano da pessoa (tabela subscriptions; sem linha = Grátis).
export async function fetchSubscription(userId) {
  const c = await loadCloud();
  if (!c) return undefined;
  const { data, error } = await c.from('subscriptions').select('plan, valid_until').eq('user_id', userId).maybeSingle();
  if (error) return undefined;
  return data || null;
}
