'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();
const plain = (v) => JSON.parse(JSON.stringify(v));

// [행, 열] 목록을 차례대로 둔다. 흑부터 번갈아.
function playAll(moves, game = core.createGame()) {
  for (const [r, c] of moves) game = core.play(game, r, c);
  return game;
}

test('새 게임: 10×10 빈 판, 흑 차례, 3개 잇기', () => {
  const g = core.createGame();
  assert.equal(g.size, 10);
  assert.equal(g.winLength, 3);
  assert.equal(g.board.length, 10);
  assert.ok(g.board.every((row) => row.length === 10 && row.every((v) => v === null)));
  assert.equal(g.turn, 'black');
  assert.equal(g.status, 'playing');
});

test('번갈아 둠: 흑 → 백 → 흑', () => {
  let g = core.play(core.createGame(), 0, 0);
  assert.equal(g.board[0][0], 'black');
  assert.equal(g.turn, 'white');
  g = core.play(g, 5, 5);
  assert.equal(g.board[5][5], 'white');
  assert.equal(g.turn, 'black');
  assert.equal(g.moves, 2);
  assert.deepEqual(plain(g.last), [5, 5]);
});

test('원래 상태는 바뀌지 않음', () => {
  const g0 = core.createGame();
  const g1 = core.play(g0, 3, 3);
  assert.equal(g0.board[3][3], null);
  assert.equal(g0.turn, 'black');
  assert.notEqual(g0, g1);
});

test('이미 돌이 있는 칸이나 판 밖에는 못 둠', () => {
  const g = core.play(core.createGame(), 2, 2);
  assert.equal(core.play(g, 2, 2), g);
  for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10]]) {
    assert.equal(core.play(g, r, c), g, `${r},${c}`);
  }
});

const LINES = {
  가로: [[4, 2], [4, 3], [4, 4]],
  세로: [[1, 7], [2, 7], [3, 7]],
  '대각선 ↘': [[0, 0], [1, 1], [2, 2]],
  '대각선 ↙': [[2, 9], [3, 8], [4, 7]],
};

for (const [name, line] of Object.entries(LINES)) {
  test(`흑이 ${name}로 3개 이으면 승리`, () => {
    // 백은 멀리 떨어진 맨 아래 줄에 띄엄띄엄 둔다.
    const whites = [[9, 0], [9, 3]];
    const g = playAll([line[0], whites[0], line[1], whites[1], line[2]]);
    assert.equal(g.status, 'won');
    assert.equal(g.winner, 'black');
    assert.equal(g.turn, null);
    assert.deepEqual(plain(g.winLine), line);
  });
}

test('백도 이길 수 있음', () => {
  const g = playAll([[0, 0], [5, 5], [0, 2], [5, 6], [0, 9], [5, 7]]);
  assert.equal(g.status, 'won');
  assert.equal(g.winner, 'white');
});

test('2개로는 이기지 않음, 떨어진 3개도 이기지 않음', () => {
  let g = playAll([[0, 0], [9, 9], [0, 1], [9, 7]]);
  assert.equal(g.status, 'playing');
  g = playAll([[0, 0], [9, 9], [0, 1], [9, 7], [0, 3]]);
  assert.equal(g.status, 'playing');
});

test('가운데를 메워 3개를 만들어도 승리 (순서 무관)', () => {
  const g = playAll([[3, 3], [9, 0], [3, 5], [9, 3], [3, 4]]);
  assert.equal(g.status, 'won');
  assert.deepEqual(plain(g.winLine), [[3, 3], [3, 4], [3, 5]]);
});

test('3개 넘게 이어져도 승리 (예: 양쪽 2개 사이를 메워 5개)', () => {
  // 판을 직접 꾸며 흑 _ 흑 흑 _ 흑 흑 의 가운데를 메우는 상황을 만든다.
  const g0 = core.createGame();
  g0.board[6][1] = 'black'; g0.board[6][2] = 'black';
  g0.board[6][4] = 'black'; g0.board[6][5] = 'black';
  g0.moves = 4;
  const g = core.play(g0, 6, 3);
  assert.equal(g.status, 'won');
  assert.equal(g.winLine.length, 5);
});

test('판 가장자리에서도 정확히 판정 (줄이 반대편으로 넘어가지 않음)', () => {
  // (0,8),(0,9) 다음 칸은 (1,0)이지만 이어진 것이 아니다.
  const g = playAll([[0, 8], [5, 5], [0, 9], [5, 7], [1, 0]]);
  assert.equal(g.status, 'playing');
});

test('승부가 난 뒤에는 더 둘 수 없음', () => {
  const g = playAll([[0, 0], [9, 9], [0, 1], [9, 7], [0, 2]]);
  assert.equal(core.play(g, 5, 5), g);
});

test('판이 가득 차고 3개가 없으면 무승부', () => {
  // 4×4 판에서 3개가 생기지 않게 채운다 (흑백 배치는 아래 그림과 같다).
  // B B W W
  // W W B B
  // B B W W
  // W W B B
  const pattern = ['BBWW', 'WWBB', 'BBWW', 'WWBB'];
  const blacks = [];
  const whites = [];
  pattern.forEach((row, r) => [...row].forEach((ch, c) => (ch === 'B' ? blacks : whites).push([r, c])));
  const order = [];
  for (let i = 0; i < blacks.length; i++) order.push(blacks[i], whites[i]);
  const g = playAll(order, core.createGame(4, 3));
  assert.equal(g.status, 'draw');
  assert.equal(g.winner, null);
  assert.equal(g.turn, null);
});
