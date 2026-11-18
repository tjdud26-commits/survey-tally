'use strict';
// 페이지가 외부 자원·네트워크·저장소를 쓰지 않는지, 규칙과 화면이 나뉘어 있는지 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { INDEX } = require('./load-core');

const html = fs.readFileSync(INDEX, 'utf8');
const ROOT = path.join(__dirname, '..');

test('외부 자원을 불러오지 않음', () => {
  assert.doesNotMatch(html, /\b(src|href|action|poster|srcset)\s*=/i);
  assert.doesNotMatch(html, /url\s*\(/i);
  assert.doesNotMatch(html, /@import|@font-face/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('네트워크·저장소 API를 쓰지 않음', () => {
  for (const api of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'Worker', 'window.open',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'serviceWorker']) {
    assert.ok(!html.includes(api), `${api} 사용 금지`);
  }
});

test('CSP로 외부 요청을 막음', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m);
  assert.match(m[1], /default-src 'none'/);
  assert.doesNotMatch(m[1], /https?:|\*/);
});

test('규칙과 화면 스크립트가 나뉘어 있고, 규칙 쪽은 DOM을 쓰지 않음', () => {
  const core = html.match(/<script id="game-core">([\s\S]*?)<\/script>/);
  const ui = html.match(/<script id="game-ui">([\s\S]*?)<\/script>/);
  assert.ok(core && ui);
  assert.doesNotMatch(core[1], /\b(document|window)\b/);
  assert.doesNotMatch(ui[1], /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.equal((html.match(/<script\b/g) || []).length, 2);
});

test('저장소 맨 위에 빈 .nojekyll', () => {
  const p = path.join(ROOT, '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});
