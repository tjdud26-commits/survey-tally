'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadMancala } = require('./load-core');

const M = loadMancala();
const { SOUTH, NORTH } = M;
const plain = (v) => JSON.parse(JSON.stringify(v));
const total = (g) => g.board.reduce((a, b) => a + b, 0);

// 판을 직접 꾸민다. south: 0~5, north: 7~12 (오른쪽→왼쪽), 창고 6·13.
function make(south, north, stores = [0, 0], turn = SOUTH) {
  const g = M.createGame();
  g.board = [...south, stores[0], ...north, stores[1]];
  g.turn = turn;
  return g;
}

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('새 게임: 구덩이 6개씩 씨앗 4개, 창고 0, 아래쪽 먼저', () => {
  const g = M.createGame();
  assert.deepEqual(plain(g.board), [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(g.turn, SOUTH);
  assert.equal(g.status, 'playing');
  assert.equal(M.createGame(undefined, NORTH).turn, NORTH);
});

test('맞은편 구덩이 번호', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(M.opposite), [12, 11, 10, 9, 8, 7]);
});

test('뿌리기: 시계 반대 방향으로 한 칸에 하나씩', () => {
  const g = M.play(M.createGame(), 0);
  assert.deepEqual(plain(g.board), [0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
  assert.equal(g.turn, NORTH);
  assert.equal(g.last.landed, 4);
});

test('내 창고에 들어가며 상대 구덩이까지 이어 뿌림', () => {
  const g = M.play(M.createGame(), 5);
  assert.deepEqual(plain(g.board), [4, 4, 4, 4, 4, 0, 1, 5, 5, 5, 4, 4, 4, 0]);
});

test('마지막 씨앗이 내 창고에 들어가면 한 번 더', () => {
  const g = M.play(M.createGame(), 2); // 2에서 4개 → 3,4,5,6(창고)
  assert.equal(g.last.extraTurn, true);
  assert.equal(g.turn, SOUTH);
  const n = M.play(M.createGame(undefined, NORTH), 9); // 9에서 4개 → 10,11,12,13(창고)
  assert.equal(n.last.extraTurn, true);
  assert.equal(n.turn, NORTH);
});

test('상대 창고는 건너뜀', () => {
  // 아래쪽 5번 구덩이에 씨앗 9개: 6(내 창고),7~12,  13(상대 창고) 건너뛰고 0,1
  // (1번에 씨앗을 미리 둬서 따내기가 일어나지 않게 한다)
  const g = M.play(make([0, 1, 0, 0, 0, 9], [1, 1, 1, 1, 1, 1]), 5);
  assert.equal(g.board[13], 0);
  assert.equal(g.board[6], 1);
  assert.deepEqual(plain(g.board.slice(0, 2)), [1, 2]);
  assert.equal(g.last.landed, 1);
  assert.equal(g.last.captured, 0);
  // 위쪽도 아래쪽 창고(6)를 건너뜀
  const n = M.play(make([1, 1, 1, 1, 1, 1], [0, 1, 0, 0, 0, 9], [0, 0], NORTH), 12);
  assert.equal(n.board[6], 0);
  assert.equal(n.board[13], 1);
});

test('13개 이상이면 한 바퀴 돌아 내 구덩이에도 다시 뿌림', () => {
  const g = M.play(make([13, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]), 0);
  assert.equal(g.last.landed, 0); // 13칸 돌아 제자리
  assert.equal(total(g), 13 + 6);
});

test('따내기: 내 빈 구덩이에서 끝나고 맞은편에 씨앗이 있으면 둘 다 내 창고로', () => {
  // 0번 씨앗 2개 → 1, 2. 2번은 비어 있었고 맞은편 10번에 5개.
  const g = M.play(make([2, 0, 0, 1, 1, 1], [1, 1, 1, 5, 1, 1]), 0);
  assert.equal(g.last.captured, 6);
  assert.equal(g.last.capturedFrom, 10);
  assert.equal(g.board[2], 0);
  assert.equal(g.board[10], 0);
  assert.equal(g.board[6], 6);
  assert.equal(g.turn, NORTH);
});

test('맞은편이 비어 있으면 따내지 않음', () => {
  const g = M.play(make([2, 0, 0, 1, 1, 1], [1, 1, 1, 0, 1, 1]), 0);
  assert.equal(g.last.captured, 0);
  assert.equal(g.board[2], 1);
});

test('상대 쪽 빈 구덩이에서 끝나면 따내지 않음', () => {
  // 5번 씨앗 3개 → 6, 7, 8. 8은 상대 구덩이.
  const g = M.play(make([1, 1, 1, 1, 1, 3], [1, 0, 1, 1, 1, 1]), 5);
  assert.equal(g.last.captured, 0);
  assert.equal(g.board[8], 1);
});

test('한 바퀴 돌아 비어 있던 구덩이로 돌아와도 1개면 따냄', () => {
  // 0번 13개: 한 바퀴 돌아 0번(방금 비운 칸)에 마지막 1개 → 맞은편 12번 따냄
  const g = M.play(make([13, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]), 0);
  assert.ok(g.last.captured > 0);
  assert.equal(g.last.capturedFrom, 12);
});

test('둘 수 없는 수는 무시: 상대 구덩이, 빈 구덩이, 창고, 끝난 게임', () => {
  const g = M.createGame();
  for (const i of [6, 7, 12, 13, -1, 14]) assert.equal(M.play(g, i), g, String(i));
  const empty = make([0, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]);
  assert.equal(M.play(empty, 0), empty);
  assert.deepEqual(plain(M.legalMoves(empty)), [1, 2, 3, 4, 5]);
});

test('한쪽 구덩이가 모두 비면 끝: 남은 씨앗은 각자 창고로', () => {
  // 아래쪽 5번 1개 → 창고. 아래쪽이 모두 비어 끝난다.
  const g = M.play(make([0, 0, 0, 0, 0, 1], [2, 0, 3, 0, 0, 1], [20, 21]), 5);
  assert.equal(g.status, 'over');
  assert.equal(g.turn, null);
  assert.equal(g.last.extraTurn, false);
  assert.equal(g.board[6], 21);
  assert.equal(g.board[13], 27);
  assert.equal(g.winner, NORTH);
  assert.deepEqual(plain(M.legalMoves(g)), []);
  assert.equal(M.play(g, 0), g);
});

test('창고가 같으면 무승부', () => {
  const g = M.play(make([0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0], [23, 23]), 5);
  assert.equal(g.status, 'over');
  assert.equal(g.winner, null);
});

test('원래 상태는 바뀌지 않음', () => {
  const g0 = M.createGame();
  M.play(g0, 0);
  assert.deepEqual(plain(g0.board), [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
});

test('무작위로 끝까지 두어도 씨앗 48개가 그대로이고 반드시 끝남', () => {
  for (let k = 0; k < 200; k++) {
    let g = M.createGame();
    let guard = 0;
    while (g.status === 'playing') {
      const moves = M.legalMoves(g);
      assert.ok(moves.length > 0);
      g = M.play(g, moves[Math.floor(rng() * moves.length)]);
      assert.equal(total(g), 48);
      assert.ok(++guard < 500);
    }
    assert.equal(g.board.filter((v, i) => i !== 6 && i !== 13 && v !== 0).length, 0);
  }
});

/* ---------- 컴퓨터 ---------- */

for (const level of ['easy', 'normal', 'hard']) {
  test(`${level}: 언제나 둘 수 있는 구덩이를 고르고, 끝나면 null`, () => {
    let g = M.createGame();
    while (g.status === 'playing') {
      const m = M.chooseMove(g, level, rng);
      assert.ok(M.legalMoves(g).includes(m), `${m}`);
      g = M.play(g, m);
    }
    assert.equal(M.chooseMove(g, level, rng), null);
  });
}

test('normal·hard: 큰 따내기를 놓치지 않음', () => {
  // 아래쪽 차례. 0번(2개)을 두면 2번에서 끝나 맞은편 10번 9개를 따낸다.
  // 4번(1개)은 5번에서 끝나 맞은편 7번 1개만 따낸다. 한 번 더 두는 수는 없다.
  const g = make([2, 0, 0, 0, 1, 0], [1, 1, 1, 9, 1, 1], [10, 10]);
  for (const level of ['normal', 'hard']) {
    assert.equal(M.chooseMove(g, level, rng), 0, level);
  }
});

test('hard: 한 번 더 두는 수를 이어 이기는 수를 찾음 (위쪽 차례에서도)', () => {
  // 위쪽 차례. 12번 1개 → 창고(한 번 더), 그다음 11번 2개 → 12, 13(창고)... 결국 위쪽 구덩이가 비어 끝나며 이긴다.
  const g = make([0, 0, 0, 0, 0, 3], [0, 0, 0, 0, 2, 1], [20, 22], NORTH);
  const m = M.chooseMove(g, 'hard', rng);
  assert.equal(m, 12);
});

function playMatch(levelSouth, levelNorth, first) {
  let g = M.createGame(undefined, first);
  while (g.status === 'playing') {
    g = M.play(g, M.chooseMove(g, g.turn === SOUTH ? levelSouth : levelNorth, rng));
  }
  return g.winner;
}

test('hard 는 easy 를 대부분 이김 (먼저·나중 모두)', () => {
  let wins = 0;
  for (let k = 0; k < 10; k++) {
    if (playMatch('hard', 'easy', k % 2 ? NORTH : SOUTH) === SOUTH) wins++;
  }
  assert.ok(wins >= 9, `hard ${wins}/10승`);
});

test('normal 은 easy 를 이기는 일이 더 많음', () => {
  let wins = 0, losses = 0;
  for (let k = 0; k < 20; k++) {
    const w = playMatch('normal', 'easy', k % 2 ? NORTH : SOUTH);
    if (w === SOUTH) wins++; else if (w === NORTH) losses++;
  }
  assert.ok(wins > losses, `normal ${wins}승 ${losses}패`);
});

test('hard 한 수 고르기가 충분히 빠름 (첫 수 0.5초 미만)', () => {
  const t = process.hrtime.bigint();
  M.chooseMove(M.createGame(), 'hard', rng);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.ok(ms < 500, `${ms.toFixed(0)}ms`);
});
