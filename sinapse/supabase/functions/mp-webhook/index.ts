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
  if (!dataId) return ok('ignorado');
  const assinatura = /subscription_preapproval|preapproval/.test(tipo) && !/authorized_payment/.test(tipo);
  const cobranca = /subscription_authorized_payment|authorized_payment/.test(tipo);
  if (tipo && tipo !== 'payment' && !assinatura && !cobranca) return ok('ignorado');

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
  const mpGet = (path: string) => fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const admin0 = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Assinatura criada, autorizada, pausada ou cancelada: guarda o id e se renova sozinho.
  if (assinatura) {
    const r = await mpGet(`/preapproval/${encodeURIComponent(dataId)}`);
    if (r.status === 404) return ok('assinatura não encontrada');
    if (!r.ok) return new Response('erro ao consultar', { status: 502 });
    const pre = await r.json();
    const [userId, plan] = String(pre.external_reference || '').split('|');
    if (!userId || !PRECOS[plan]) return ok('referência inválida');
    const ativa = pre.status === 'authorized';
    const patch: Record<string, unknown> = { auto_renew: ativa, updated_at: new Date().toISOString() };
    if (ativa) { patch.mp_preapproval_id = String(pre.id); patch.next_charge = pre.next_payment_date || null; }
    const { data: existe } = await admin0.from('subscriptions').select('user_id, mp_preapproval_id').eq('user_id', userId).maybeSingle();
    if (!existe) { if (ativa) await admin0.from('subscriptions').insert({ user_id: userId, plan: 'gratis', source: 'pagamento', ...patch }); }
    else if (ativa) await admin0.from('subscriptions').update(patch).eq('user_id', userId);
    // Cancelamento/pausa só desliga a renovação se for a assinatura atual (não uma antiga).
    else if (existe.mp_preapproval_id === String(pre.id)) await admin0.from('subscriptions').update({ ...patch, next_charge: null }).eq('user_id', userId);
    console.log('assinatura', pre.id, pre.status, userId);
    return ok(`assinatura ${pre.status}`);
  }

  // Cobrança mensal/anual da assinatura: libera o período quando o pagamento for aprovado.
  let paymentId = dataId;
  let refAssinatura = '';
  if (cobranca) {
    const r = await mpGet(`/authorized_payments/${encodeURIComponent(dataId)}`);
    if (r.status === 404) return ok('cobrança não encontrada');
    if (!r.ok) return new Response('erro ao consultar', { status: 502 });
    const ap = await r.json();
    if (!ap.payment?.id) return ok(`cobrança ${ap.status}`);
    paymentId = String(ap.payment.id);
    if (ap.preapproval_id) {
      const pr = await mpGet(`/preapproval/${encodeURIComponent(ap.preapproval_id)}`);
      if (pr.ok) { const pre = await pr.json(); refAssinatura = String(pre.external_reference || ''); if (pre.next_payment_date) await admin0.from('subscriptions').update({ next_charge: pre.next_payment_date }).eq('user_id', refAssinatura.split('|')[0]); }
    }
  }
  const resp = await mpGet(`/v1/payments/${encodeURIComponent(paymentId)}`);
  if (resp.status === 404) { console.warn('pagamento não encontrado', dataId); return ok('pagamento não encontrado'); }
  if (!resp.ok) { console.error('mp', resp.status); return new Response('erro ao consultar', { status: 502 }); }
  const pay = await resp.json();
  if (pay.status !== 'approved' || pay.currency_id !== 'BRL') return ok(`status ${pay.status}`);

  const [userId, plan, period] = String(pay.external_reference || refAssinatura || '').split('|');
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
    user_id: userId, plan, valid_until: ate, source: 'pagamento', note: `Mercado Pago ${pay.id}${cobranca || refAssinatura ? ' (renovação)' : ''}`, updated_at: new Date().toISOString(),
  });
  if (subErr) { console.error('subscriptions', subErr.message); return new Response('erro ao liberar', { status: 500 }); }
  console.log('plano liberado', userId, plan, period, ate);
  return ok('liberado');
});
