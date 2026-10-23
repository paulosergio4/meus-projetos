import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer } from '../js/grade.js';

test('acentos, plural e caixa não atrapalham', () => {
  assert.equal(gradeAnswer('Cataratas', [['catarata']]).ok, true);
  assert.equal(gradeAnswer('aumento da REABSORÇÃO óssea', [['reabsorcao ossea']]).ok, true);
});

test('sinônimos dentro do grupo e todos os grupos quando são poucos', () => {
  const kw = [['calcitriol'], ['citrato']];
  assert.equal(gradeAnswer('calcitriol e citrato de cálcio', kw).ok, true);
  assert.equal(gradeAnswer('calcitriol e carbonato de cálcio', kw).ok, false);
});

test('maioria dos grupos quando são muitos (60%)', () => {
  const kw = [['ptu', 'metimazol'], ['propranolol'], ['lugol'], ['hidrocortisona']];
  assert.equal(gradeAnswer('PTU, propranolol e lugol', kw).ok, true);
  assert.equal(gradeAnswer('metimazol e propranolol', kw).ok, false);
});

test('números com zero à esquerda e termos colados', () => {
  assert.equal(gradeAnswer('07 unidades', [['7', 'sete']]).ok, true);
  assert.equal(gradeAnswer('Calcular o FIB-4 e pedir fibroscan', [['fib4', 'fib 4'], ['elastografia', 'fibroscan']]).ok, true);
  assert.equal(gradeAnswer('L1L4 e corpo inteiro', [['l1 l4'], ['corpo inteiro']]).ok, true);
});

test('palavra curta exige palavra exata', () => {
  assert.equal(gradeAnswer('naoo sei', [['nao']]).ok, false);
  assert.equal(gradeAnswer('Não.', [['nao']]).ok, true);
});

test('mínimo explícito', () => {
  const kw = [['prolactina'], ['ferritina'], ['ressonancia', 'rm de sela']];
  assert.equal(gradeAnswer('prolactina e RM de sela', kw, 2).ok, true);
  assert.equal(gradeAnswer('prolactina', kw, 2).ok, false);
});
