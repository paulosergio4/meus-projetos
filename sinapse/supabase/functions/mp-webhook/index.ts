// Sinapse · mp-webhook: o Mercado Pago avisa aqui quando um pagamento muda.
// Nunca confia no aviso: busca o pagamento na API do Mercado Pago com a nossa credencial e só
// libera o plano se estiver aprovado, em reais e com o valor certo. Cada pagamento libera uma vez só.
// Segredos: MP_ACCESS_TOKEN e (recomendado) MP_WEBHOOK_SECRET, a "assinatura secreta" do webhook.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PRECOS: Record<string, Record<string, number>> = {
  pro: { mensal: 29.9, anual: 239 },
  residencia: { mensal: 59.9, anual: 479 },
};
const DIAS: Record<string, number> = { mensal: 31, anual: 366 };

const ok = (msg = 'ok') => new Response(msg, { status: 200 });

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok();
  const u = new URL(req.url);
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* alguns avisos vêm só na URL */ }
  const tipo = String(body.type || body.topic || u.searchParams.get('type') || u.searchParams.get('topic') || '');
  const dataId = String(u.searchParams.get('data.id') || body?.data?.id || u.searchParams.get('id') || '');
  if (!dataId || (tipo && tipo !== 'payment')) return ok('ignorado');

  // Confere a assinatura do aviso (quando o segredo estiver configurado).
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (secret) {
    const sig = req.headers.get('x-signature') || '';
    const reqId = req.headers.get('x-request-id') || '';
    const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=')));
    const manifest = `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};request-id:${reqId};ts:${parts.ts};`;
    // Só registra: a segurança de verdade é conferir o pagamento na API logo abaixo.
    if (!parts.ts || !parts.v1 || (await hmacHex(secret, manifest)) !== parts.v1) console.warn('assinatura não confere', dataId);
    else console.log('assinatura ok', dataId);
  }

  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) return new Response('sem token', { status: 503 });
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) { console.error('mp', resp.status); return new Response('erro ao consultar', { status: 502 }); }
  const pay = await resp.json();
  if (pay.status !== 'approved' || pay.currency_id !== 'BRL') return ok(`status ${pay.status}`);

  const [userId, plan, period] = String(pay.external_reference || '').split('|');
  const preco = PRECOS[plan]?.[period];
  if (!userId || !preco) { console.error('referência inválida', pay.external_reference); return ok('referência inválida'); }
  if (Number(pay.transaction_amount) + 0.01 < preco) { console.error('valor menor', pay.id, pay.transaction_amount); return ok('valor menor'); }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Registra o pagamento; se já existe, este aviso é repetido e não libera de novo.
  const { error: insErr } = await admin.from('payments').insert({
    id: String(pay.id), user_id: userId, plan, period, amount: pay.transaction_amount, status: pay.status, method: pay.payment_method_id || pay.payment_type_id || null,
  });
  if (insErr) {
    if (String(insErr.code) === '23505') return ok('já processado');
    console.error('payments', insErr.message);
    return new Response('erro ao registrar', { status: 500 });
  }

  // Soma o tempo: se já tem o mesmo plano em vigor, estende a partir da validade atual.
  const { data: sub } = await admin.from('subscriptions').select('plan, valid_until').eq('user_id', userId).maybeSingle();
  const agora = Date.now();
  const atual = sub && sub.plan === plan && sub.valid_until ? new Date(sub.valid_until).getTime() : 0;
  const base = Math.max(agora, atual);
  const ate = new Date(base + DIAS[period] * 86400_000).toISOString();
  const { error: subErr } = await admin.from('subscriptions').upsert({
    user_id: userId, plan, valid_until: ate, source: 'pagamento', note: `Mercado Pago ${pay.id}`, updated_at: new Date().toISOString(),
  });
  if (subErr) { console.error('subscriptions', subErr.message); return new Response('erro ao liberar', { status: 500 }); }
  console.log('plano liberado', userId, plan, period, ate);
  return ok('liberado');
});
