// 由 favicon.svg 產生網站圖示與社群分享圖：favicon.ico、apple-touch-icon.png、icon-192/512.png、og-image.png
// 用法：node tools/build-icons.mjs
// 以本機 Chrome／Edge 的 headless 模式截圖（可用環境變數 CHROME 指定執行檔）；分享圖的字型用系統的 Noto Serif TC / Noto Sans TC。
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'favicon.svg'), 'utf8');
// iOS 與 Android（maskable）會自己裁圓角，所以這兩種用滿版方形、不留透明角
const squareSvg = svg.replace(/ rx="[\d.]+"/, '');

const chrome = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!chrome) throw new Error('找不到 Chrome／Edge，請用環境變數 CHROME 指定執行檔路徑');

const tmp = mkdtempSync(join(tmpdir(), 'fe-icons-'));
const shot = (html, w, h, name) => {
  const page = join(tmp, `${name}.html`);
  const png = join(tmp, `${name}.png`);
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}</style>${html}`);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--user-data-dir=${join(tmp, 'profile')}`,
    `--window-size=${w},${h}`, `--screenshot=${png}`, pathToFileURL(page).href,
  ], { stdio: 'ignore' });
  return readFileSync(png);
};
const icon = (src, size, name) =>
  shot(`<img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}" width="${size}" height="${size}" style="display:block">`, size, size, name);

// ICO 內直接放 PNG（Windows Vista 起與所有現代瀏覽器都支援）
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
};

const OG = `
<style>
  body { font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; color: #fff4df;
    background: radial-gradient(circle at 78% -10%, rgba(215, 185, 117, .22), transparent 520px),
      repeating-linear-gradient(115deg, transparent 0 46px, rgba(215, 185, 117, .035) 46px 47px),
      linear-gradient(105deg, #182332, #282637 58%, #4a2b3b); }
  .frame { position: absolute; inset: 28px; border: 1px solid rgba(215, 185, 117, .45); }
  .frame::after { content: ""; position: absolute; inset: 7px; border: 1px solid rgba(215, 185, 117, .18); }
  .main { position: absolute; inset: 0 96px; display: flex; flex-direction: column; justify-content: center; gap: 44px; }
  .head { display: flex; align-items: center; gap: 72px; }
  .emblem { flex: none; width: 118px; height: 118px; margin: 0 12px; transform: rotate(45deg);
    border: 3px solid #d7b975; box-shadow: inset 0 0 0 10px rgba(215, 185, 117, .12);
    background: radial-gradient(circle, #e8cc8c 0 16px, transparent 17px); }
  .eyebrow { color: #d7b975; font-size: 23px; letter-spacing: .12em; white-space: nowrap; }
  h1 { margin: 6px 0 0; font: 700 76px/1.25 "Noto Serif TC", serif; letter-spacing: .06em; white-space: nowrap; }
  p { margin: 10px 0 0; color: #d1c5ba; font-size: 28px; letter-spacing: .03em; white-space: nowrap; }
  .chips { display: flex; justify-content: center; gap: 16px; }
  .chips span { padding: 7px 24px; border: 1.5px solid rgba(215, 185, 117, .6); border-radius: 999px;
    background: rgba(215, 185, 117, .1); color: #f0dcae; font-size: 25px; letter-spacing: .06em; }
  .url { position: absolute; left: 0; right: 0; bottom: 52px; text-align: center; color: rgba(215, 185, 117, .75);
    font-size: 20px; letter-spacing: .12em; }
</style>
<div class="frame"></div>
<div class="main">
  <div class="head">
    <div class="emblem"></div>
    <div>
      <div class="eyebrow">聖火降魔錄 萬縷千絲 · FORTUNE'S WEAVE</div>
      <h1>萬紫千紅 培養計算器</h1>
      <p>從目前等級與實際數值出發，預測轉職路線的成長</p>
    </div>
  </div>
  <div class="chips"><span>期望值</span><span>機率區間</span><span>成長判定</span><span>坐騎加成</span><span>自動推薦</span></div>
</div>
<div class="url">fe-banshisenko-calc.jakeuj.com</div>`;

try {
  const out = {
    'favicon.ico': ico([16, 32, 48].map((size) => ({ size, data: icon(svg, size, `ico-${size}`) }))),
    'apple-touch-icon.png': icon(squareSvg, 180, 'apple'),
    'icon-192.png': icon(squareSvg, 192, 'icon-192'),
    'icon-512.png': icon(squareSvg, 512, 'icon-512'),
    'og-image.png': shot(OG, 1200, 630, 'og'),
  };
  for (const [name, data] of Object.entries(out)) {
    writeFileSync(join(root, name), data);
    console.log(`${name}  ${(data.length / 1024).toFixed(1)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
