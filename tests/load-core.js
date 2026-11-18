'use strict';
// 페이지 HTML 에서 계산용 <script id="..."> 블록만 꺼내 실행해 그 전역 객체를 돌려준다.
// 화면에서 실제로 쓰는 코드 그대로를 시험하기 위함이다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadScript(file, scriptId, globalName) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = html.match(new RegExp(`<script id="${scriptId}">([\\s\\S]*?)<\\/script>`));
  if (!m) throw new Error(`${file} 에 <script id="${scriptId}"> 가 없습니다`);
  // 빈 컨텍스트: DOM 없이 돌아가는지도 함께 확인된다.
  return vm.runInNewContext(`${m[1]}\n;${globalName}`, Object.create(null));
}

const loadCore = () => loadScript('samok.html', 'game-core', 'GameCore');
const loadMancala = () => loadScript('mancala.html', 'mancala-core', 'MancalaCore');

module.exports = { ROOT, loadScript, loadCore, loadMancala };
