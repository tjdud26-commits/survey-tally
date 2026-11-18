'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();

// vm 컨텍스트에서 만든 객체는 프로토타입이 달라 deepStrictEqual 이 실패하므로 JSON 으로 옮긴다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const rows = (text) => plain(core.parseTsv(text));
const summary = (text) =>
  plain(core.tally(text).questions.map((q) => [q.name, q.valid, q.average, q.blank, q.excluded]));

test('칸 판정: 1~5는 유효', () => {
  for (const v of ['1', '2', '3', '4', '5']) {
    assert.deepEqual(plain(core.classifyCell(v)), { kind: 'valid', value: Number(v) });
  }
});

test('칸 판정: 앞뒤 공백은 지우고 본다', () => {
  assert.deepEqual(plain(core.classifyCell('  3 ')), { kind: 'valid', value: 3 });
  assert.deepEqual(plain(core.classifyCell(' 4　')), { kind: 'valid', value: 4 });
});

test('칸 판정: 비었거나 공백만 있으면 빈 응답', () => {
  for (const v of ['', ' ', '   ', ' ', '　', undefined]) {
    assert.equal(core.classifyCell(v).kind, 'blank', JSON.stringify(v));
  }
});

test('칸 판정: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '3.5', '5.0', '05', '+3', '-1', '３', '예', '3 4', 'N/A', '"3"x']) {
    assert.equal(core.classifyCell(v).kind, 'excluded', v);
  }
});

test('평균: 소수 셋째 자리에서 반올림해 둘째 자리까지', () => {
  assert.equal(core.formatAverage(3, 1), '3.00');
  assert.equal(core.formatAverage(10, 3), '3.33'); // 3.333…
  assert.equal(core.formatAverage(11, 3), '3.67'); // 3.666…
  assert.equal(core.formatAverage(7, 2), '3.50');
  assert.equal(core.formatAverage(5, 8), '0.63'); // 0.625 → 0.63
  assert.equal(core.formatAverage(201, 200), '1.01'); // 1.005 → 1.01 (부동소수로는 1.00이 되기 쉬움)
  assert.equal(core.formatAverage(2009, 2000), '1.00'); // 1.0045 → 1.00
  assert.equal(core.formatAverage(1001, 200), '5.01'); // 5.005 → 5.01
});

test('평균: 유효가 0이면 "-"', () => {
  assert.equal(core.formatAverage(0, 0), '-');
});

test('줄 구분 \\r\\n, \\n, \\r 모두 받음', () => {
  const want = [['a', 'b'], ['1', '2']];
  assert.deepEqual(rows('a\tb\r\n1\t2'), want);
  assert.deepEqual(rows('a\tb\n1\t2'), want);
  assert.deepEqual(rows('a\tb\r1\t2'), want);
});

test('끝 줄바꿈과 길이 0인 줄은 버림, 탭만 있는 줄은 남김', () => {
  assert.deepEqual(rows('a\tb\n1\t2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(rows('a\tb\n\n1\t2\n\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(rows('a\tb\n\t\n'), [['a', 'b'], ['', '']]);
});

test('엑셀 따옴표 칸을 품', () => {
  assert.deepEqual(rows('번호\t의견\n1\t"좋아요\n정말"\n2\t"그는 ""네""라고"'), [
    ['번호', '의견'],
    ['1', '좋아요\n정말'],
    ['2', '그는 "네"라고'],
  ]);
  assert.deepEqual(rows('a\t""\tc'), [['a', '', 'c']]);
});

test('형식이 맞지 않는 따옴표는 글자 그대로', () => {
  assert.deepEqual(rows('a\t"3"x\tc'), [['a', '"3"x', 'c']]);
  assert.deepEqual(rows('a\t"열린\tc'), [['a', '"열린', 'c']]);
});

test('집계: 기본 예시', () => {
  const text = [
    '응답번호\t만족도\t추천 의향',
    '1\t5\t4',
    '2\t4\t',
    '3\t3\t모름',
    '4\t 2 \t5',
  ].join('\n');
  const result = core.tally(text);
  assert.equal(result.status, 'ok');
  assert.equal(result.respondents, 4);
  assert.deepEqual(summary(text), [
    ['만족도', 4, '3.50', 0, 0],
    ['추천 의향', 2, '4.50', 1, 1],
  ]);
});

test('집계: 첫 열(응답번호)은 집계하지 않음', () => {
  const text = '번호\tQ1\n3\t1\n5\t1';
  const s = summary(text);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], ['Q1', 2, '1.00', 0, 0]);
});

test('집계: 머리글보다 칸이 모자란 줄은 모자란 칸을 빈 응답으로', () => {
  const text = '번호\tQ1\tQ2\tQ3\n1\t5\n2\n3\t4\t4\t4';
  assert.deepEqual(summary(text), [
    ['Q1', 2, '4.50', 1, 0],
    ['Q2', 1, '4.00', 2, 0],
    ['Q3', 1, '4.00', 2, 0],
  ]);
});

test('집계: 머리글보다 칸이 많은 줄은 넘치는 칸을 무시', () => {
  const text = '번호\tQ1\n1\t3\t9\t9';
  assert.deepEqual(summary(text), [['Q1', 1, '3.00', 0, 0]]);
});

test('집계: 유효가 없는 문항은 평균 "-"', () => {
  const text = '번호\tQ1\tQ2\n1\t\t6\n2\t \t예';
  assert.deepEqual(summary(text), [
    ['Q1', 0, '-', 2, 0],
    ['Q2', 0, '-', 0, 2],
  ]);
});

test('집계: 머리글만 있으면 응답 0', () => {
  const result = core.tally('번호\tQ1\tQ2\n');
  assert.equal(result.status, 'ok');
  assert.equal(result.respondents, 0);
  assert.deepEqual(summary('번호\tQ1\tQ2\n'), [
    ['Q1', 0, '-', 0, 0],
    ['Q2', 0, '-', 0, 0],
  ]);
});

test('집계: 문항 이름은 앞뒤 공백을 지우고, 비면 (열 N)', () => {
  const s = summary('번호\t  Q1 \t\tQ3\n1\t1\t2\t3');
  assert.deepEqual(s.map((q) => q[0]), ['Q1', '(열 3)', 'Q3']);
});

test('집계: 빈 입력과 문항 없는 입력', () => {
  assert.equal(core.tally('').status, 'empty');
  assert.equal(core.tally('\n\n').status, 'empty');
  assert.equal(core.tally('번호\n1\n2').status, 'no-questions');
});

test('집계: 따옴표 칸 안의 줄바꿈이 줄을 쪼개지 않음', () => {
  const text = '번호\t의견\tQ1\n1\t"첫째 줄\n둘째 줄"\t4\n2\t\t2';
  const result = core.tally(text);
  assert.equal(result.respondents, 2);
  assert.deepEqual(summary(text), [
    ['의견', 0, '-', 1, 1],
    ['Q1', 2, '3.00', 0, 0],
  ]);
});

test('집계: 각 문항에서 유효 + 빈 응답 + 제외 = 응답 줄 수', () => {
  const text = '번호\tA\tB\tC\n1\t1\t\tx\n2\t\n3\t5\t5\t5\t5\n4';
  const result = core.tally(text);
  for (const q of result.questions) {
    assert.equal(q.valid + q.blank + q.excluded, result.respondents, q.name);
  }
});
