'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();
const plain = (v) => JSON.parse(JSON.stringify(v));
const first = () => 0; // 후보 중 첫 번째를 고르는 고정 rng

// 판 그림으로 게임 상태를 만든다. B=흑, W=백, .=빈칸. 차례는 돌 수로 정한다(같으면 흑).
function fromRows(rows) {
  const g = core.createGame();
  let b = 0, w = 0;
  rows.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === 'B') { g.board[r][c] = 'black'; b++; }
    if (ch === 'W') { g.board[r][c] = 'white'; w++; }
  }));
  g.moves = b + w;
  g.turn = b === w ? 'black' : 'white';
  return g;
}

const has = (cells, move) => cells.some(([r, c]) => r === move[0] && c === move[1]);

for (const level of ['easy', 'hard']) {
  test(`${level}: 첫 수는 판 가운데 네 칸 중 하나`, () => {
    for (const x of [0, 0.3, 0.6, 0.99]) {
      const m = plain(core.chooseMove(core.createGame(), level, () => x));
      assert.ok(has([[4, 4], [4, 5], [5, 4], [5, 5]], m), JSON.stringify(m));
    }
  });

  test(`${level}: 이길 수 있으면 이김 (막기보다 먼저)`, () => {
    // 흑 차례. 흑은 (2,3)에 두면 이기고, 백도 (6,3)에 두면 이긴다.
    const g = fromRows([
      '..........',
      '..........',
      '.BB.......',
      '..........',
      '..........',
      '..........',
      '.WW.......',
      '..........',
      '.........B',
      '.........W',
    ]);
    assert.equal(g.turn, 'black');
    const m = plain(core.chooseMove(g, level, first));
    const after = core.play(g, m[0], m[1]);
    assert.equal(after.status, 'won', JSON.stringify(m));
    assert.equal(after.winner, 'black');
  });

  test(`${level}: 상대가 다음 수에 이기면 막음`, () => {
    // 백 차례. 흑은 가로 B B 양 끝 (4,3)·(4,6) 중 한 곳에 두면 이긴다 → 막아야 한다.
    const g = fromRows([
      '..........',
      '..........',
      '..........',
      '..........',
      'W...BB.W..',
      '..........',
      '..........',
      '..........',
      '..........',
      '.........B',
    ]);
    assert.equal(g.turn, 'white');
    const m = plain(core.chooseMove(g, level, first));
    assert.ok(has([[4, 3], [4, 6]], m), JSON.stringify(m));
  });

  test(`${level}: 빈칸에만 두고, 게임이 끝나면 null`, () => {
    let g = core.createGame();
    let guard = 0;
    while (g.status === 'playing' && guard++ < 100) {
      const m = core.chooseMove(g, level);
      assert.equal(g.board[m[0]][m[1]], null);
      g = core.play(g, m[0], m[1]);
    }
    assert.notEqual(g.status, 'playing');
    assert.equal(core.chooseMove(g, level), null);
  });
}

test('hard: 두 곳을 동시에 노리는 수를 만듦', () => {
  // 흑 차례. (4,4)에 두면 가로 _BB_ 양쪽이 열려 이길 자리가 둘이 된다.
  const g = fromRows([
    '..........',
    '..........',
    '..........',
    '..........',
    '...B......',
    '..........',
    '..........',
    '..........',
    '........W.',
    '..........',
  ]);
  const m = plain(core.chooseMove(g, 'hard', first));
  g.board[m[0]][m[1]] = 'black';
  const wins = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (g.board[r][c]) continue;
    const t = core.play(Object.assign({}, g, { board: g.board, turn: 'black', status: 'playing' }), r, c);
    if (t.status === 'won') wins.push([r, c]);
  }
  assert.ok(wins.length >= 2, `${JSON.stringify(m)} → 이길 자리 ${wins.length}곳`);
});

test('hard: 상대가 양쪽 열린 2개를 만들 자리를 미리 막음', () => {
  // 백 차례이고 백 돌이 없어 스스로 노림수를 만들 수 없다.
  // 흑 (4,4) 둘레에 흑이 두면 양쪽 열린 2개가 되므로, 백은 그 둘레 한 칸 이내에 둬야 한다.
  const g = fromRows(['..........', '..........', '..........', '..........', '....B.....']);
  g.turn = 'white';
  const m = plain(core.chooseMove(g, 'hard', first));
  assert.ok(Math.max(Math.abs(m[0] - 4), Math.abs(m[1] - 4)) <= 1, JSON.stringify(m));
});

test('hard 흑은 쉬움 백을 이긴다 (여러 번)', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10; i++) {
    let g = core.createGame();
    while (g.status === 'playing') {
      const m = core.chooseMove(g, g.turn === 'black' ? 'hard' : 'easy', rng);
      g = core.play(g, m[0], m[1]);
    }
    assert.equal(g.winner, 'black', `게임 ${i + 1}`);
  }
});

test('hard 끼리 두면 흑(선수)이 이긴다: 3개 잇기는 선수필승', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10; i++) {
    let g = core.createGame();
    while (g.status === 'playing') {
      const m = core.chooseMove(g, 'hard', rng);
      g = core.play(g, m[0], m[1]);
    }
    assert.equal(g.winner, 'black', `게임 ${i + 1}`);
  }
});
