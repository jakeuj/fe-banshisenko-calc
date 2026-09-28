// 檢查資料來源有沒有更新（只讀取、不改任何檔案）：
//   1. game8.jp 計算器 JSON：線上版與 tools/raw/game8.json 快取逐格比對
//   2. game8.co 成長率頁（archives/618974）：角色與職業成長率與目前 data.js 比對
// 用法：node tools/check-sources.mjs
// 看完結果後，要更新資料走 fe-data-update 技能；game8.co 的差異先對照
// .agents/skills/fe-research/references/conflicts.md，大多是已記錄的已知衝突。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { EN_UNIT, EN_CLASS } from './names-zh.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const G8JP_URL = 'https://assets.game8.jp/tools/script_template/fe_banshisenko_ikusei_sim.json';
const G8CO_URL = 'https://game8.co/games/Fire-Emblem-Fortunes-Weave/archives/618974';
const SHORT = ['HP', '力', '魔', '速', '技', '防', '魔防', '運', '魅'];
const num = (v) => Number(String(v ?? '').replace('+', '')) || 0;

const cachePath = join(root, 'tools', 'raw', 'game8.json');
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : null;
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'data.js'), 'utf8'), ctx);
const D = JSON.parse(JSON.stringify(ctx.window.FE_DATA));

// ── 1. game8.jp ──
async function checkGame8jp() {
  console.log('== game8.jp 計算器 JSON ==');
  if (!cache) {
    console.log('  沒有快取 tools/raw/game8.json，請先執行 node tools/build-data.mjs --refresh');
    return;
  }
  const live = await (await fetch(G8JP_URL)).json();
  const lines = [];
  for (const tb of live) {
    const ta = cache.find((t) => t.id === tb.id);
    if (!ta) {
      lines.push(`新表 ${tb.id}`);
      continue;
    }
    const old = Object.fromEntries(ta.db_data.map((r) => [r.title, r]));
    for (const r of tb.db_data) {
      const o = old[r.title];
      if (!o) {
        lines.push(`表 ${tb.id} 新增：${r.title}`);
        continue;
      }
      for (const k of Object.keys(r)) {
        if (k === 'image_url' || k.startsWith('l_col')) continue;
        if (JSON.stringify(r[k]) !== JSON.stringify(o[k]))
          lines.push(`表 ${tb.id} ${r.title} ${k}：${JSON.stringify(o[k]).slice(0, 40)} → ${JSON.stringify(r[k]).slice(0, 40)}`);
      }
    }
    for (const r of ta.db_data) if (!tb.db_data.some((x) => x.title === r.title)) lines.push(`表 ${tb.id} 刪除：${r.title}`);
  }
  if (!lines.length) console.log('  與快取完全相同，不需要重抓。');
  else {
    console.log(`  有 ${lines.length} 處變動（表 23026 角色、23029 職業、23049 加入資料）：`);
    for (const l of lines.slice(0, 80)) console.log('  - ' + l);
    if (lines.length > 80) console.log(`  …另有 ${lines.length - 80} 處`);
    console.log('  → 執行 node tools/build-data.mjs --refresh 並依 fe-data-update 處理。');
  }
}

// ── 2. game8.co ──
function parseTables(html) {
  const strip = (s) =>
    s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((t) =>
    [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => strip(c[1])))
  );
}
async function checkGame8co() {
  console.log('\n== game8.co 成長率頁 ==');
  const html = await (await fetch(G8CO_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const updated = (html.match(/"dateModified"\s*:\s*"([^"]+)"/) || [])[1];
  console.log(`  ${G8CO_URL}${updated ? `（最後更新 ${updated}）` : ''}`);
  const rawUnit = {};
  const rawCls = {};
  if (cache) {
    for (const r of cache.find((t) => t.id === 23026).db_data) rawUnit[r.title] = [20, 21, 22, 23, 24, 25, 26, 27, 28].map((i) => num(r['col_' + i]));
    for (const r of cache.find((t) => t.id === 23029).db_data) rawCls[r.title] = [3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => num(r['col_' + i]));
  }
  const tables = parseTables(html);
  const report = { unit: [], cls: [], unknown: [] };
  let seen = { unit: 0, cls: 0 };
  for (const rows of tables) {
    const head = rows[0] || [];
    const kind = head[0] === 'Unit' ? 'unit' : head[0] === 'Class' ? 'cls' : null;
    if (!kind || head[1] !== 'HP' || head[4] !== 'Spd' || head[5] !== 'Dex') continue; // 欄位順序變了就不比
    for (const r of rows.slice(1)) {
      const jp = (kind === 'unit' ? EN_UNIT : EN_CLASS)[r[0]];
      const item = jp && (kind === 'unit' ? D.units : D.classes).find((x) => x.jp === jp);
      if (!item) {
        report.unknown.push(r[0]);
        continue;
      }
      seen[kind]++;
      const co = r.slice(1, 10).map(Number);
      const cur = item.growth;
      const diffs = [];
      for (let k = 0; k < 9; k++) if (co[k] !== cur[k]) diffs.push(k);
      if (!diffs.length) continue;
      const raw = (kind === 'unit' ? rawUnit : rawCls)[jp];
      const delta = diffs.map((k) => cur[k] - co[k]);
      let tag = '';
      if (diffs.length === 9 && delta.every((d) => d === delta[0])) tag = `（全部差 ${delta[0] > 0 ? '+' : ''}${delta[0]}，可能是個人技能加成，例如穆的成長之兆）`;
      const parts = diffs.map((k) => {
        const fixed = raw && raw[k] !== cur[k] ? `，game8.jp 原為 ${raw[k]}＝已由 CORRECTIONS 修正` : '';
        return `${SHORT[k]} co ${co[k]}／目前 ${cur[k]}${fixed}`;
      });
      report[kind].push(`${item.zh}（${r[0]}）：${parts.join('；')}${tag}`);
    }
  }
  if (!seen.unit && !seen.cls) {
    console.log('  沒有解析到成長率表格：頁面結構可能改了，請手動檢查。');
    return;
  }
  console.log(`  比對角色 ${seen.unit}、職業 ${seen.cls}。`);
  console.log(`  角色不同 ${report.unit.length}：`);
  for (const l of report.unit) console.log('  - ' + l);
  console.log(`  職業不同 ${report.cls.length}：`);
  for (const l of report.cls) console.log('  - ' + l);
  if (report.unknown.length) console.log(`  對不到日文名（在 names-zh.mjs 的 EN_UNIT / EN_CLASS 補上）：${report.unknown.join('、')}`);
  console.log('  → 每一筆先對照 fe-research/references/conflicts.md；沒記錄過的才需要研究。');
}

await checkGame8jp().catch((e) => console.log('  game8.jp 讀取失敗：' + e.message));
await checkGame8co().catch((e) => console.log('  game8.co 讀取失敗：' + e.message));
