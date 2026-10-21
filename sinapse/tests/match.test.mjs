import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, normalizeAnswer, parseCloze } from '../js/match.js';
import { buildPlan } from '../js/plan.js';
import { SEED_CARDS } from '../js/data.js';
import { QUESTIONS, CASES } from '../js/questions.js';

test('ignora acentos, maiúsculas e artigo no início', () => {
  assert.equal(normalizeAnswer('A Cardioversão Elétrica'), 'cardioversao eletrica');
  assert.ok(checkAnswer('cardioversao eletrica sincronizada', ['cardioversão elétrica sincronizada']).ok);
});

test('aceita sinônimos da lista', () => {
  assert.ok(checkAnswer('CVE sincronizada', ['cardioversão elétrica sincronizada', 'CVE sincronizada']).ok);
});

test('aceita pequeno erro de digitação em palavras longas', () => {
  const r = checkAnswer('gluconato de calsio', ['gluconato de cálcio']);
  assert.ok(r.ok);
  assert.ok(r.close);
});

test('números precisam ser exatos, com vírgula ou ponto', () => {
  assert.ok(checkAnswer('6,5', ['6,5']).ok);
  assert.ok(checkAnswer('6.5', ['6,5']).ok);
  assert.ok(!checkAnswer('6', ['6,5']).ok);
  assert.ok(!checkAnswer('127', ['126']).ok);
});

test('resposta em branco ou diferente está errada', () => {
  assert.ok(checkAnswer('', ['inferior']).empty);
  assert.ok(!checkAnswer('anterior', ['inferior']).ok);
});

test('parseCloze separa texto, lacunas e sinônimos', () => {
  const { parts, gaps } = parseCloze('Vai da classe {{I}} à classe {{IV|4}}.');
  assert.equal(gaps.length, 2);
  assert.deepEqual(gaps[1].answers, ['IV', '4']);
  assert.equal(parts.filter((p) => p.gap != null).length, 2);
});

test('toda lacuna dos cards de exemplo aceita a própria resposta', () => {
  for (const c of SEED_CARDS.filter((x) => x.type === 'cloze')) {
    for (const g of parseCloze(c.text).gaps) {
      assert.ok(checkAnswer(g.display, g.answers).ok, `${c.id}: ${g.display}`);
    }
  }
});

test('questões e casos têm 5 alternativas e gabarito válido', () => {
  for (const q of QUESTIONS.concat(CASES.flatMap((c) => c.stages))) {
    assert.equal(q.options.length, 5);
    assert.ok(q.answer >= 0 && q.answer < 5);
    assert.ok(q.explanation.length > 10);
  }
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
});

test('cronograma distribui o conteúdo até a reta final', () => {
  const now = new Date(2026, 9, 21, 10).getTime();
  const plan = buildPlan({ now, examDate: '2026-12-20', newLeft: 600 });
  assert.equal(plan.daysLeft, 60);
  assert.equal(plan.newPerDay, 12); // 600 cards em 53 dias
  assert.equal(plan.phase, 'content');
  assert.ok(plan.onTrack);
});

test('cronograma: última semana sem conteúdo novo e mínimo de 5 por dia', () => {
  const now = new Date(2026, 9, 21, 10).getTime();
  assert.equal(buildPlan({ now, examDate: '2026-10-25', newLeft: 30 }).phase, 'final');
  assert.equal(buildPlan({ now, examDate: '2027-06-01', newLeft: 30 }).newPerDay, 5);
});
