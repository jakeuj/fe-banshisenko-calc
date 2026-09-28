// 讀取騰訊文件《火焰之纹章 万紫千红》在线数据表，與目前 data.js 比對（唯讀，不改專案檔案）。
//
//   node .agents/skills/fe-research/scripts/qq-sheet.mjs tabs            列出分頁
//   node .agents/skills/fe-research/scripts/qq-sheet.mjs compare         角色／職業／坐騎／戰車 與 data.js 比對，只列差異
//   node .agents/skills/fe-research/scripts/qq-sheet.mjs dump <tab> [檔名] 把一個分頁輸出成 TSV（研究用，勿提交進專案）
//
// 文件擁有者設定「禁止檢視者複製」、坐騎截圖浮水印「禁止转载」：只用來比對個別數值並註明出處，不要整表搬進專案。
// 每次執行約 1–4 次請求；先抓頁面取得 cookie（TOK、hashkey），沒有 cookie 時 opendoc API 會回 401。
//
// 格式（逆向而來，無官方文件）：opendoc JSON 的 clientVars.collab_client_vars.initialAttributedText.text[0]
// 裡的 related_sheet（或 block_datas[].related_sheet）是 base64 → zlib → protobuf。
// 找「子欄位 6（儲存格）最多、且有子欄位 5（值池）」的節點：
//   - 值池（欄位 5）的子項依種類分開編號：1＝字串、2＝富文字（段落文字在其子欄位 3）、3＝數字（double）
//   - 儲存格：1＝列（預設 0）、2＝欄（預設 0）、3＝值 { 1: 型別, 2: { 1: 索引 } }
//     型別 4＝字串池索引；型別 2＝數字：索引 ≤128 直接是數值，≥129 取數字池[索引−129]（負數、較大的數）；
//     型別 6＝富文字池索引；型別 5＝公式（只顯示 [公式]）
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import vm from 'node:vm';

const DOC = 'DV0N0VUZLSXRmUWFq';
const PAGE = `https://docs.qq.com/sheet/${DOC}`;
const UA = 'Mozilla/5.0';
const TABS = { units: 'sd3o0k', classes: 'lnafol', mounts: 'bxlbpf' };
// 表上有成長率、但 game8 沒資料（不在 data.js）的客串角色
const GUESTS = new Set(['索雷尔', '欧若拉']);

const here = dirname(fileURLToPath(import.meta.url));
const root = existsSync(join(process.cwd(), 'data.js')) ? process.cwd() : resolve(here, '../../../..');
const { CN_UNIT, CN_CLASS, CN_MOUNT } = await import(pathToFileURL(join(root, 'tools', 'names-zh.mjs')).href);

// ── 網路 ──
let cookie = '';
async function ensureCookie() {
  if (cookie) return;
  const r = await fetch(PAGE, { headers: { 'User-Agent': UA } });
  cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [])
    .map((c) => c.split(';')[0])
    .join('; ');
  await r.text();
}
async function opendoc(tab) {
  await ensureCookie();
  const url = `https://docs.qq.com/dop-api/opendoc?id=${DOC}&tab=${tab}&outformat=1&normal=1&noEscape=1&startrow=0&endrow=5000`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: `${PAGE}?tab=${tab}`, Cookie: cookie } });
  if (!r.ok) throw new Error(`opendoc ${tab} HTTP ${r.status}（401 通常是沒帶到 cookie 或請求太頻繁，隔一段時間再試）`);
  return r.json();
}

// ── protobuf（無 schema）──
function varint(b, p) {
  let r = 0n;
  let s = 0n;
  let x;
  do {
    x = b[p.i++];
    r |= BigInt(x & 0x7f) << s;
    s += 7n;
  } while (x & 0x80);
  return r;
}
function pb(b, depth = 0) {
  const p = { i: 0 };
  const out = [];
  while (p.i < b.length) {
    const key = Number(varint(b, p));
    const f = key >> 3;
    const wt = key & 7;
    if (!f) throw new Error('bad field');
    if (wt === 0) out.push({ f, wt, v: varint(b, p) });
    else if (wt === 1) {
      out.push({ f, wt, v: b.readDoubleLE(p.i) });
      p.i += 8;
    } else if (wt === 5) {
      out.push({ f, wt, v: b.readFloatLE(p.i) });
      p.i += 4;
    } else if (wt === 2) {
      const len = Number(varint(b, p));
      const sub = b.subarray(p.i, p.i + len);
      p.i += len;
      if (p.i > b.length) throw new Error('overflow');
      let child = null;
      if (depth < 14 && len) {
        try {
          child = pb(sub, depth + 1);
        } catch {
          child = null;
        }
      }
      const str = sub.toString('utf8');
      const isStr = !/[\x00-\x08\x0e-\x1f]/.test(str) && Buffer.from(str, 'utf8').equals(sub);
      out.push({ f, wt, str: isStr ? str : null, child });
    } else throw new Error('wire type ' + wt);
  }
  return out;
}
const field = (node, f) => (node && node.child ? node.child.find((x) => x.f === f) : null);
const intOf = (node, f) => {
  const x = field(node, f);
  return x ? Number(x.v) : 0;
};

function decodeSheet(b64) {
  const tree = pb(inflateSync(Buffer.from(b64, 'base64')));
  let best = null;
  let most = 0;
  const walk = (n) => {
    for (const x of n) {
      if (!x.child) continue;
      const cells = x.child.filter((y) => y.f === 6).length;
      if (cells > most && x.child.some((y) => y.f === 5)) {
        most = cells;
        best = x.child;
      }
      walk(x.child);
    }
  };
  walk(tree);
  if (!best) return [];
  const pool = best.find((x) => x.f === 5).child || [];
  const strs = pool.filter((x) => x.f === 1).map((x) => (field(x, 1) || {}).str ?? '');
  const rich = pool
    .filter((x) => x.f === 2)
    .map((x) => {
      const parts = [];
      const w = (n) => {
        for (const y of n || []) {
          if (y.f === 3 && y.str !== null && !(y.child && y.child.length && /^[\x00-\x7f]*$/.test(y.str))) parts.push(y.str);
          else if (y.child) w(y.child);
        }
      };
      w(x.child);
      return parts.join('').trim();
    });
  const nums = pool.filter((x) => x.f === 3).map((x) => Number((field(x, 1) || { v: 0 }).v));
  const rows = [];
  for (const c of best.filter((x) => x.f === 6)) {
    const r = intOf(c, 1);
    const col = intOf(c, 2);
    const v = field(c, 3);
    if (!v) continue;
    const type = intOf(v, 1);
    const idx = intOf(field(v, 2), 1);
    let val = '';
    if (type === 4) val = strs[idx] ?? '';
    else if (type === 2) val = idx <= 128 ? idx : nums[idx - 129];
    else if (type === 6) val = rich[idx] ?? '';
    else if (type === 5) val = '[公式]';
    (rows[r] ||= [])[col] = val;
  }
  return Array.from(rows, (r) => Array.from(r || [], (x) => (x === undefined ? '' : x)));
}
async function readTab(tab) {
  const j = await opendoc(tab);
  const t = j.clientVars.collab_client_vars.initialAttributedText.text[0];
  const blocks = t.block_datas ? t.block_datas.map((b) => b.related_sheet) : [t.related_sheet];
  return blocks.filter(Boolean).flatMap(decodeSheet);
}

// ── 比對 ──
function loadData() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(root, 'data.js'), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.FE_DATA));
}
const SHORT = ['HP', '力', '魔', '速', '技', '防', '魔防', '運', '魅'];
const cellName = (s) => String(s ?? '').split('\n')[0].trim();
const numArr = (row, from) => Array.from({ length: 9 }, (_, k) => Number(row[from + k]) || 0);
const diffText = (theirs, ours) =>
  theirs
    .map((v, k) => (v !== ours[k] ? `${SHORT[k]} 表 ${v}／目前 ${ours[k]}` : ''))
    .filter(Boolean)
    .join('、');
// 找表頭：含 key 的那一列，以及它下面第一個含 'HP' 的列
function headerOf(rows, key) {
  const a = rows.findIndex((r) => r && r.some((c) => cellName(c) === key));
  if (a < 0) return null;
  const b = rows.findIndex((r, i) => i >= a && r && r.includes('HP'));
  return { a, b, keyCol: rows[a].findIndex((c) => cellName(c) === key) };
}
const hpCols = (row) => row.map((c, i) => (c === 'HP' ? i : -1)).filter((i) => i >= 0);

function compareUnits(rows, D, out) {
  const h = headerOf(rows, '角色名称');
  if (!h || h.b < 0) return out.push('角色：找不到表頭（分頁結構可能改了）');
  const [g0, s0] = hpCols(rows[h.b]);
  const lvCol = rows[h.b].indexOf('LV');
  let n = 0;
  for (const r of rows.slice(h.b + 1)) {
    const cn = cellName(r && r[h.keyCol]);
    if (!cn) continue;
    const jp = CN_UNIT[cn];
    const u = jp && D.units.find((x) => x.jp === jp);
    const g = numArr(r, g0);
    if (!g.some(Boolean)) continue;
    if (!u) {
      if (!GUESTS.has(cn)) out.push(`角色 ${cn}：對不到（在 names-zh.mjs 的 CN_UNIT 補上）`);
      continue;
    }
    n++;
    const d = diffText(g, u.growth);
    if (d) out.push(`角色 ${u.zh}（${cn}）成長：${d}`);
    const lv = Number(r[lvCol]) || 0;
    if (lv && s0 >= 0 && !u.join) out.push(`角色 ${u.zh} 沒有預設加入資料，表上有：Lv${lv} ${cellName(r[h.keyCol + 1])} ${numArr(r, s0).join(' ')}（不含職業補正）`);
  }
  out.unshift(`角色：比對 ${n} 人`);
}
function compareClasses(rows, D, out) {
  const h = headerOf(rows, '兵种名称');
  if (!h || h.b < 0) return out.push('職業：找不到表頭（分頁結構可能改了）');
  const [g0, m0] = hpCols(rows[h.b]);
  let n = 0;
  const lines = [];
  for (const r of rows.slice(h.b + 1)) {
    const cn = cellName(r && r[h.keyCol]);
    if (!cn) continue;
    const jp = CN_CLASS[cn];
    const c = jp && D.classes.find((x) => x.jp === jp);
    if (!c) {
      lines.push(`職業 ${cn}：對不到（在 names-zh.mjs 的 CN_CLASS 補上）`);
      continue;
    }
    n++;
    const dg = diffText(numArr(r, g0), c.growth);
    const dm = m0 >= 0 && r.slice(m0, m0 + 9).some((x) => x !== '') ? diffText(numArr(r, m0), c.mod) : '';
    if (dg) lines.push(`職業 ${c.zh}（${cn}）成長：${dg}`);
    if (dm) lines.push(`職業 ${c.zh}（${cn}）補正：${dm}`);
  }
  out.push(`職業：比對 ${n} 個`, ...lines);
}
const STAT_WORD = { HP: 0, 力: 1, 魔防: 6, 魔: 2, 速: 3, 技: 4, 防: 5, 幸: 7, 魅: 8 };
function parseBonus(text) {
  const arr = Array(9).fill(0);
  for (const m of String(text).split('\n')[0].matchAll(/(\d+)\s*(HP|魔防|力|魔|速|技|防|幸|魅)/g)) arr[STAT_WORD[m[2]]] += Number(m[1]);
  return arr;
}
function compareMounts(rows, D, out) {
  const h = headerOf(rows, '属性加成（满级）');
  if (!h) return out.push('坐騎：找不到表頭（分頁結構可能改了）');
  const g0 = rows[h.a].indexOf('生命');
  let n = 0;
  const stageOf = { '战车（初始）': 'initial', '战车（多轮升级）': 'upgraded' };
  for (const r of rows.slice(h.a + 1)) {
    if (!r) continue;
    const cn = r.slice(0, 3).map(cellName).find((x) => CN_MOUNT[x] || stageOf[x]);
    if (!cn) continue;
    const g = numArr(r, g0);
    if (stageOf[cn]) {
      const st = D.chariotStages.find((x) => x.id === stageOf[cn]);
      const d = diffText(g, st.growth);
      out.push(`戰車 ${st.zh}：${d || '一致'}（表上合計 ${r[g0 + 9]}）`);
      continue;
    }
    const m = D.mounts.find((x) => x.id === CN_MOUNT[cn]);
    n++;
    const ds = diffText(parseBonus(r[h.keyCol]), m.stat);
    if (ds) out.push(`坐騎 ${m.zh}（${cn}）能力：${ds}`);
    if (g.some(Boolean)) {
      const dg = diffText(g, m.growth);
      if (dg) out.push(`坐騎 ${m.zh}（${cn}）成長：${dg}`);
    }
  }
  out.unshift(`坐騎：比對 ${n} 隻（表上成長欄空白的不比成長）`);
}

// ── 主程式 ──
const [cmd, arg, file] = process.argv.slice(2);
if (cmd === 'tabs') {
  const j = await opendoc(TABS.mounts);
  for (const t of j.clientVars.collab_client_vars.header[0].d) console.log(`${t.id}\t${t.name}`);
} else if (cmd === 'dump' && arg) {
  const rows = await readTab(arg);
  const tsv = rows.map((r) => r.map((x) => String(x).replace(/\t/g, ' ').replace(/\n/g, '⏎')).join('\t')).join('\n');
  if (file) {
    writeFileSync(file, tsv);
    console.log(`${arg}：${rows.length} 列 → ${file}`);
  } else console.log(tsv);
} else if (cmd === 'compare') {
  const D = loadData();
  const sections = [
    ['units', compareUnits],
    ['classes', compareClasses],
    ['mounts', compareMounts],
  ];
  for (const [key, fn] of sections) {
    const out = [];
    try {
      fn(await readTab(TABS[key]), D, out);
    } catch (e) {
      out.push(`${key} 讀取失敗：${e.message}`);
    }
    console.log(out.map((l, i) => (i ? '  - ' + l : '== ' + l)).join('\n'));
  }
  console.log('\n→ 每一筆先對照 fe-research/references/conflicts.md；已記錄的是已知衝突，沒記錄過的才需要研究。');
} else {
  console.log('用法：qq-sheet.mjs tabs | compare | dump <分頁id> [輸出檔]');
}
