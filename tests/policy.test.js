'use strict';
// 모든 페이지가 외부 자원·네트워크·저장소를 쓰지 않는지, 규칙과 화면이 나뉘어 있는지 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./load-core');

const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 페이지별 계산 스크립트 id 와 화면 스크립트 id. 목록 페이지는 스크립트가 없다.
const SCRIPTS = {
  'index.html': [],
  'samok.html': ['game-core', 'game-ui'],
};

test('페이지 목록이 예상과 같음', () => {
  assert.deepEqual(PAGES, Object.keys(SCRIPTS).sort());
});

for (const page of PAGES) {
  const html = read(page);

  test(`${page}: 외부 자원을 불러오지 않음`, () => {
    assert.doesNotMatch(html, /\b(src|action|poster|srcset)\s*=/i);
    assert.doesNotMatch(html, /url\s*\(/i);
    assert.doesNotMatch(html, /@import|@font-face/i);
    assert.doesNotMatch(html, /https?:\/\//i);
  });

  test(`${page}: 링크는 이 저장소의 페이지로만`, () => {
    const hrefs = [...html.matchAll(/\bhref\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
    for (const h of hrefs) {
      assert.ok(PAGES.includes(h), `${h} 는 저장소 안의 페이지가 아닙니다`);
    }
  });

  test(`${page}: 네트워크·저장소 API를 쓰지 않음`, () => {
    for (const api of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'Worker', 'window.open',
      'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'serviceWorker']) {
      assert.ok(!html.includes(api), `${api} 사용 금지`);
    }
  });

  test(`${page}: CSP로 외부 요청을 막음`, () => {
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(m);
    assert.match(m[1], /default-src 'none'/);
    assert.doesNotMatch(m[1], /https?:|\*/);
  });

  test(`${page}: 규칙과 화면 스크립트가 나뉘어 있고, 규칙 쪽은 DOM을 쓰지 않음`, () => {
    const ids = SCRIPTS[page];
    assert.equal((html.match(/<script\b/g) || []).length, ids.length);
    if (!ids.length) return;
    const [coreId, uiId] = ids;
    const core = html.match(new RegExp(`<script id="${coreId}">([\\s\\S]*?)<\\/script>`));
    const ui = html.match(new RegExp(`<script id="${uiId}">([\\s\\S]*?)<\\/script>`));
    assert.ok(core && ui);
    assert.doesNotMatch(core[1], /\b(document|window)\b/);
    assert.doesNotMatch(ui[1], /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
}

test('저장소 맨 위에 빈 .nojekyll', () => {
  const p = path.join(ROOT, '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});
