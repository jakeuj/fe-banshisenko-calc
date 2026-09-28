// 在 index.html 引用的本機檔案後面加上內容雜湊版本參數（?v=xxxxxxxx），避免快取造成新舊檔案混用。
// 用法：node tools/stamp-assets.mjs          更新 index.html
//       node tools/stamp-assets.mjs --check  只檢查，版本過期時以代碼 1 結束
// 雜湊前會把 CRLF 轉成 LF，Windows（autocrlf）與其他系統算出的版本一致。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

const hashOf = (file) =>
  createHash('sha256')
    .update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex')
    .slice(0, 8);

const stamped = [];
const out = html.replace(/\b(src|href)="([^"?#:]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (m, attr, path) => {
  const file = join(root, path);
  if (!existsSync(file)) return m;
  const v = hashOf(file);
  stamped.push(`${path}?v=${v}`);
  return `${attr}="${path}?v=${v}"`;
});

if (process.argv.includes('--check')) {
  if (out !== html) {
    console.error('index.html 的版本參數已過期，請執行 node tools/stamp-assets.mjs');
    process.exit(1);
  }
  console.log('版本參數為最新：' + stamped.join('、'));
} else {
  if (out !== html) writeFileSync(htmlPath, out);
  console.log((out !== html ? '已更新：' : '無變更：') + stamped.join('、'));
}
