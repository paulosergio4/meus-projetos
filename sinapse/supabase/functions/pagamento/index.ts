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
  const plan = String(body.plan || '');
  const period = String(body.period || '');
  const preco = PRECOS[plan]?.[period];
  if (!preco) return json(400, { error: 'plano', message: 'Plano inválido.' });

  const app = Deno.env.get('APP_URL') || 'https://paulosergio4.github.io/meus-projetos/sinapse/';
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
