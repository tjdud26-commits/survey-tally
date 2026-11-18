'use strict';
// 데이터가 브라우저 밖으로 나가거나 저장되지 않도록, 그리고 외부 자원을 쓰지 않도록 index.html 을 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { INDEX } = require('./load-core');

const html = fs.readFileSync(INDEX, 'utf8');
const ROOT = path.join(__dirname, '..');

test('외부 자원을 불러오지 않음 (src·href·url()·@import)', () => {
  assert.doesNotMatch(html, /\b(src|href|action|poster|srcset)\s*=/i, '속성으로 자원을 불러오면 안 됩니다');
  assert.doesNotMatch(html, /url\s*\(/i, 'CSS url() 금지');
  assert.doesNotMatch(html, /@import|@font-face/i, '외부 글꼴·스타일 금지');
  assert.doesNotMatch(html, /https?:\/\//i, '외부 주소 금지');
});

test('네트워크 API를 쓰지 않음', () => {
  for (const api of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts', 'Worker', 'window.open']) {
    assert.ok(!html.includes(api), `${api} 사용 금지`);
  }
});

test('저장소 API를 쓰지 않음', () => {
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches', 'serviceWorker']) {
    assert.ok(!html.includes(api), `${api} 사용 금지`);
  }
});

test('form 제출을 쓰지 않음', () => {
  assert.doesNotMatch(html, /<form\b/i);
});

test('CSP로 외부 요청을 막음', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta 가 있어야 합니다');
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /https?:|\*/, 'CSP 에 외부 출처를 허용하면 안 됩니다');
});

test('입력칸은 맞춤법 검사·자동완성을 끔', () => {
  const m = html.match(/<textarea\b[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test('계산과 화면 스크립트가 나뉘어 있고, 계산 쪽은 DOM을 쓰지 않음', () => {
  const core = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  const ui = html.match(/<script id="tally-ui">([\s\S]*?)<\/script>/);
  assert.ok(core && ui);
  assert.doesNotMatch(core[1], /\b(document|window|innerHTML)\b/);
  assert.doesNotMatch(ui[1], /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, '붙여넣은 값은 textContent 로만 넣어야 합니다');
  assert.equal((html.match(/<script\b/g) || []).length, 2, '스크립트는 두 블록뿐이어야 합니다');
});

test('저장소 맨 위에 빈 .nojekyll', () => {
  const p = path.join(ROOT, '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});
