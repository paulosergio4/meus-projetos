import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleAll, newCardState, retrievability, intervalDays, formatInterval, DAY_MS, MIN_MS } from '../js/fsrs.js';

const NOW = Date.UTC(2026, 9, 21, 12);
const days = (card, now = NOW) => Math.round((card.due - now) / DAY_MS);

test('card novo: De novo volta em 1 minuto', () => {
  const r = scheduleAll(newCardState(), NOW)[1];
  assert.equal(r.state, 'learning');
  assert.equal(r.due - NOW, MIN_MS);
});

test('card novo: intervalos crescem de Difícil para Fácil', () => {
  const r = scheduleAll(newCardState(), NOW);
  assert.equal(days(r[2]), 1);
  assert.equal(days(r[3]), 4);
  assert.equal(days(r[4]), 14);
});

test('acertar de novo no vencimento aumenta a estabilidade', () => {
  const first = scheduleAll(newCardState(), NOW)[3];
  const later = first.due;
  const second = scheduleAll(first, later)[3];
  assert.ok(second.s > first.s, `${second.s} deveria ser maior que ${first.s}`);
  assert.ok(days(second, later) > days(first));
});

test('errar um card em revisão reduz a estabilidade e conta lapso', () => {
  const first = scheduleAll(newCardState(), NOW)[3];
  const lapse = scheduleAll(first, first.due)[1];
  assert.equal(lapse.state, 'learning');
  assert.equal(lapse.lapses, 1);
  assert.ok(lapse.s <= first.s);
});

test('ordem Difícil < Bom < Fácil vale também em revisão', () => {
  let card = scheduleAll(newCardState(), NOW)[3];
  for (let i = 0; i < 5; i += 1) {
    const at = card.due;
    const r = scheduleAll(card, at);
    assert.ok(days(r[2], at) < days(r[3], at));
    assert.ok(days(r[3], at) < days(r[4], at));
    card = r[3];
  }
});

test('retenção prevista é 90% quando o intervalo é igual à estabilidade', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.equal(intervalDays(10), 10);
});

test('formatação dos intervalos em português', () => {
  assert.equal(formatInterval(MIN_MS), '1 min');
  assert.equal(formatInterval(DAY_MS), '1 dia');
  assert.equal(formatInterval(4 * DAY_MS), '4 dias');
  assert.equal(formatInterval(60 * DAY_MS), '2 meses');
});
