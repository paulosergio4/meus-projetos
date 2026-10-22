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

// redirectTo opcional: o painel de administração volta pelo endereço do app (já autorizado no Supabase).
export async function signInWithGoogle(redirectTo) {
  const c = await loadCloud();
  if (!c) throw new Error('Não foi possível conectar ao servidor.');
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo || returnUrl() } });
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
  const { data, error } = await c.from('subscriptions').select('plan, valid_until, auto_renew, next_charge').eq('user_id', userId).maybeSingle();
  if (error) return undefined;
  return data || null;
}

// ---------- banco de questões ----------
const Q_FIELDS = 'id, banca, prova, ano, numero, area, sub, stem, options, answer, explanation, explanation_ai, fact, image_url, needs_image, status, updated_at';

// Questões publicadas (todas as páginas de 1.000).
export async function fetchPublishedQuestions() {
  const c = await loadCloud();
  if (!c) return null;
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.from('questions').select(Q_FIELDS).eq('status', 'publicada')
      .order('ano', { ascending: false }).order('prova').order('numero').range(from, from + 999);
    if (error) return null;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

export async function checkIsAdmin() {
  const c = await loadCloud();
  if (!c) return false;
  const { data, error } = await c.rpc('is_admin');
  return !error && data === true;
}

export async function adminQuestions(status) {
  const c = await loadCloud();
  if (!c) return [];
  const { data, error } = await c.from('questions').select(Q_FIELDS).eq('status', status).order('ano', { ascending: false }).order('prova').order('numero').limit(500);
  if (error) throw error;
  return data;
}

// Questões já gravadas de um ano (prova, número e enunciado), para achar a prova de um PDF e o que falta.
export async function adminQuestionsOfYear(ano) {
  const c = await loadCloud();
  if (!c) return [];
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.from('questions').select('prova, numero, stem').eq('ano', ano).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Rascunhos que precisam de imagem e ainda não têm (de uma prova ou de todas).
export async function adminImageDrafts(prova, ano) {
  const c = await loadCloud();
  if (!c) return [];
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = c.from('questions').select('id, prova, ano, numero, stem').eq('status', 'rascunho').eq('needs_image', true).is('image_url', null);
    if (prova) q = q.eq('prova', prova).eq('ano', ano);
    const { data, error } = await q.order('ano').order('prova').order('numero').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function adminProvas() {
  const c = await loadCloud();
  if (!c) return [];
  const { data, error } = await c.from('questions').select('prova, ano, banca, status').limit(10000);
  if (error) throw error;
  const map = new Map();
  for (const r of data) {
    const k = `${r.prova}|${r.ano}`;
    const e = map.get(k) || { prova: r.prova, ano: r.ano, banca: r.banca, publicada: 0, rascunho: 0, anulada: 0 };
    e[r.status] += 1;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.ano - a.ano || a.prova.localeCompare(b.prova));
}

export async function adminUpdateQuestion(id, patch) {
  const c = await loadCloud();
  const { error } = await c.from('questions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteQuestion(id) {
  const c = await loadCloud();
  const { error } = await c.from('questions').delete().eq('id', id);
  if (error) throw error;
}

export async function callImportarProva(body) {
  const c = await loadCloud();
  if (!c) throw Object.assign(new Error('Sem conexão com o servidor. Confira a internet.'), { code: 'rede' });
  const { data, error } = await c.functions.invoke('importar-prova', { body });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* sem corpo */ }
    throw Object.assign(new Error(info.message || 'Não foi possível importar agora. Tente de novo.'), { code: info.error || 'falha', info });
  }
  return data;
}

// Envia a imagem de uma questão (já reduzida no aparelho) e devolve o endereço público.
export async function uploadQuestionImage(questionId, blob) {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const path = `${questionId}.jpg`;
  const { error } = await c.storage.from('questoes').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  const { data } = c.storage.from('questoes').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ---------- painel: administradores e edição ----------
export async function adminList() {
  const c = await loadCloud();
  const { data, error } = await c.rpc('admin_list');
  if (error) throw error;
  return data || [];
}

export async function adminAdd(email) {
  const c = await loadCloud();
  const { error } = await c.rpc('admin_add', { p_email: email });
  if (error) throw new Error(error.message);
}

export async function adminRemove(userId) {
  const c = await loadCloud();
  const { error } = await c.rpc('admin_remove', { p_user: userId });
  if (error) throw new Error(error.message);
}

export async function adminSearchQuestions({ status = 'publicada', prova = '', area = '', text = '', from = 0, size = 50 } = {}) {
  const c = await loadCloud();
  let q = c.from('questions').select(Q_FIELDS, { count: 'exact' }).eq('status', status);
  if (prova) { const [p, a] = prova.split('|'); q = q.eq('prova', p).eq('ano', Number(a)); }
  if (area) q = q.eq('area', area);
  if (text) q = q.ilike('stem', `%${text.replace(/[%_]/g, '')}%`);
  const { data, error, count } = await q.order('ano', { ascending: false }).order('prova').order('numero').range(from, from + size - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function currentSessionUser() {
  const c = await loadCloud();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? data.session.user : null;
}

export async function callOrganizarPasta(arquivos) {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const { data, error } = await c.functions.invoke('organizar-pasta', { body: { arquivos } });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* sem corpo */ }
    throw new Error(info.message || 'Não foi possível organizar a pasta.');
  }
  return data;
}

// ---------- relatos de erro ----------
export async function sendReport({ questionId = null, ref = null, refText = null, reason, message }) {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const { error } = await c.from('question_reports').insert({ question_id: questionId, ref, ref_text: refText ? String(refText).slice(0, 600) : null, reason, message: message ? String(message).slice(0, 1000) : null });
  if (error) throw error;
}

export async function adminReports(status = 'aberto') {
  const c = await loadCloud();
  const { data, error } = await c.from('question_reports')
    .select(`id, reason, message, ref, ref_text, status, created_at, question_id, questions (${Q_FIELDS})`)
    .eq('status', status).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data || [];
}

export async function adminResolveReport(id, status) {
  const c = await loadCloud();
  const { data: s } = await c.auth.getSession();
  const { error } = await c.from('question_reports').update({ status, resolved_at: new Date().toISOString(), resolved_by: s.session ? s.session.user.id : null }).eq('id', id);
  if (error) throw error;
}

export async function adminOpenReportsCount() {
  const c = await loadCloud();
  const { count, error } = await c.from('question_reports').select('id', { count: 'exact', head: true }).eq('status', 'aberto');
  return error ? 0 : count || 0;
}

// ---------- pagamento e acessos ----------
export async function startCheckout(plan, period) {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const { data, error } = await c.functions.invoke('pagamento', { body: { plan, period } });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* sem corpo */ }
    throw new Error(info.message || 'Não foi possível abrir o pagamento.');
  }
  return data.url;
}

export async function adminSubscribers() {
  const c = await loadCloud();
  const { data, error } = await c.rpc('admin_subscribers');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminGrant(email, plan, until, note) {
  const c = await loadCloud();
  const { error } = await c.rpc('admin_grant', { p_email: email, p_plan: plan, p_until: until, p_note: note || '' });
  if (error) throw new Error(error.message);
}

export async function adminRevoke(userId) {
  const c = await loadCloud();
  const { error } = await c.rpc('admin_revoke', { p_user: userId });
  if (error) throw new Error(error.message);
}

// Assinatura com renovação automática no cartão (Mercado Pago). email = e-mail da conta do Mercado Pago.
export async function startCardSubscription(plan, period, email) {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const { data, error } = await c.functions.invoke('pagamento', { body: { action: 'assinar', plan, period, email } });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* sem corpo */ }
    throw new Error(info.message || 'Não foi possível abrir a assinatura.');
  }
  return data.url;
}

export async function cancelRenewal() {
  const c = await loadCloud();
  if (!c) throw new Error('Sem conexão com o servidor.');
  const { error } = await c.functions.invoke('pagamento', { body: { action: 'cancelar' } });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (e) { /* sem corpo */ }
    throw new Error(info.message || 'Não foi possível cancelar agora.');
  }
}
