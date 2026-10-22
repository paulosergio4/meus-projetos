// Sinapse · pagamento: cria o checkout do Mercado Pago (Pix ou cartão) para o plano escolhido.
// Segredo: MP_ACCESS_TOKEN (credencial de produção do Mercado Pago). Opcional: APP_URL.
// Os preços ficam aqui no servidor; o aparelho só escolhe plano e período.
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const PRECOS: Record<string, Record<string, number>> = {
  pro: { mensal: 29.9, anual: 239 },
  residencia: { mensal: 59.9, anual: 479 },
};
const NOMES: Record<string, string> = { pro: 'Pro', residencia: 'Residência' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'metodo' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json(401, { error: 'login', message: 'Entre com sua conta para assinar.' });

  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) return json(503, { error: 'sem_pagamento', message: 'O pagamento ainda não foi configurado.' });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'corpo', message: 'Pedido inválido.' }); }
  // Diagnóstico (só administradores): quais meios de pagamento a conta do Mercado Pago aceita.
  if (body.action === 'metodos') {
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', who.user.id).maybeSingle();
    if (!isAdmin) return json(403, { error: 'admin' });
    const r = await fetch('https://api.mercadopago.com/v1/payment_methods', { headers: { Authorization: `Bearer ${token}` } });
    const lista = r.ok ? await r.json() : [];
    const me = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${token}` } });
    const conta = me.ok ? await me.json() : {};
    return json(200, {
      metodos: (Array.isArray(lista) ? lista : []).map((m: any) => `${m.id}:${m.payment_type_id}:${m.status}`),
      conta: {
        id: conta.id, apelido: conta.nickname, nome: conta.first_name,
        email: typeof conta.email === 'string' ? conta.email.replace(/^(.{3}).*(@.*)$/, '$1***$2') : null,
        site: conta.site_id, tipo: conta.user_type, status: conta.status?.site_status,
        identidade: conta.status?.user_type?.status ?? conta.identification?.type ?? null,
        email_igual: conta.email === who.user.email,
      },
    });
  }
  const app = Deno.env.get('APP_URL') || 'https://paulosergio4.github.io/meus-projetos/sinapse/';
  const mp = (path: string, init: RequestInit = {}) => fetch(`https://api.mercadopago.com${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  // Cancelar a renovação automática: o plano continua até o fim do período já pago.
  if (body.action === 'cancelar') {
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sub } = await admin.from('subscriptions').select('mp_preapproval_id').eq('user_id', who.user.id).maybeSingle();
    if (!sub?.mp_preapproval_id) return json(400, { error: 'sem_assinatura', message: 'Não há renovação automática ativa.' });
    const r = await mp(`/preapproval/${sub.mp_preapproval_id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    if (!r.ok) { console.error('cancelar', r.status, (await r.text()).slice(0, 300)); return json(502, { error: 'mp', message: 'Não foi possível cancelar agora. Tente de novo.' }); }
    await admin.from('subscriptions').update({ auto_renew: false, next_charge: null, updated_at: new Date().toISOString() }).eq('user_id', who.user.id);
    return json(200, { ok: true });
  }

  const plan = String(body.plan || '');
  const period = String(body.period || '');
  const preco = PRECOS[plan]?.[period];
  if (!preco) return json(400, { error: 'plano', message: 'Plano inválido.' });

  // Assinatura com renovação automática (cartão de crédito).
  if (body.action === 'assinar') {
    const email = String(body.email || who.user.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'email', message: 'Informe o e-mail da sua conta do Mercado Pago.' });
    const r = await mp('/preapproval', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        reason: `Sinapse ${NOMES[plan]} · ${period === 'anual' ? 'anual' : 'mensal'} (renovação automática)`,
        external_reference: `${who.user.id}|${plan}|${period}|rec`,
        payer_email: email,
        auto_recurring: { frequency: period === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: preco, currency_id: 'BRL' },
        back_url: `${app}?assinatura=ok`,
        status: 'pending',
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('preapproval', r.status, t.slice(0, 400));
      const msg = /payer|email/i.test(t) ? 'O Mercado Pago não aceitou esse e-mail. Use o e-mail da sua conta do Mercado Pago.' : 'Não foi possível abrir a assinatura agora. Tente de novo.';
      return json(502, { error: 'mp', message: msg });
    }
    const out = await r.json();
    return json(200, { url: out.init_point, id: out.id });
  }

  const pref = {
    items: [{ id: `${plan}-${period}`, title: `Sinapse ${NOMES[plan]} · ${period === 'anual' ? '12 meses' : '1 mês'}`, quantity: 1, unit_price: preco, currency_id: 'BRL' }],
    payer: { email: who.user.email },
    external_reference: `${who.user.id}|${plan}|${period}`,
    back_urls: { success: `${app}?pagamento=aprovado`, pending: `${app}?pagamento=pendente`, failure: `${app}?pagamento=falhou` },
    auto_return: 'approved',
    notification_url: `${url}/functions/v1/mp-webhook`,
    statement_descriptor: 'SINAPSE',
    payment_methods: { installments: period === 'anual' ? 12 : 1 },
    metadata: { user_id: who.user.id, plan, period },
  };
  const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(pref),
  });
  if (!resp.ok) {
    console.error('mp', resp.status, (await resp.text()).slice(0, 400));
    return json(502, { error: 'mp', message: 'Não foi possível abrir o pagamento agora. Tente de novo.' });
  }
  const out = await resp.json();
  return json(200, { url: out.init_point });
});
