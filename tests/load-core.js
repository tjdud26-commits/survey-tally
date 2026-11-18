'use strict';
// index.html 에서 <script id="tally-core"> 블록만 꺼내 실행해 TallyCore 를 돌려준다.
// 화면에서 실제로 쓰는 코드 그대로를 시험하기 위함이다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function loadCore() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html 에 <script id="tally-core"> 가 없습니다');
  // 빈 컨텍스트: DOM·네트워크 없이 돌아가는지도 함께 확인된다.
  return vm.runInNewContext(m[1] + '\n;TallyCore', Object.create(null));
}

module.exports = { loadCore, INDEX };
