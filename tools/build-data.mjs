// 產生 ../data.js
// 用法：node tools/build-data.mjs            （使用 tools/raw/game8.json 快取，沒有才下載）
//       node tools/build-data.mjs --refresh  （重新下載 game8 資料）
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIT_ZH, FACTION_ZH, CLASS_ZH, TIER_ZH, SKILL_ZH } from './names-zh.mjs';
import { MOUNT_TYPES, CLASS_MOUNT_TYPE, MOUNT_GROWTH_MULT, MOUNTS, ROUTES } from './mounts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, 'raw', 'game8.json');
const OUT = join(here, '..', 'data.js');
const SRC_URL = 'https://assets.game8.jp/tools/script_template/fe_banshisenko_ikusei_sim.json';

// game8 欄位順序（已用 レダ速65/技50、戦車兵速-5/技+25 與 ソフィア 試算確認）
const STATS = [
  { key: 'hp', zh: 'HP', jp: 'HP' },
  { key: 'str', zh: '力量', jp: '力' },
  { key: 'mag', zh: '魔力', jp: '魔力' },
  { key: 'spd', zh: '速度', jp: '速さ' },
  { key: 'dex', zh: '技巧', jp: '技' },
  { key: 'def', zh: '防守', jp: '守備' },
  { key: 'res', zh: '魔防', jp: '魔防' },
  { key: 'lck', zh: '幸運', jp: '幸運' },
  { key: 'cha', zh: '魅力', jp: '魅力' },
];
const KEYS = STATS.map((s) => s.key);

// 資料修正（game8.jp 與其他來源/遊戲截圖不符者）
const CORRECTIONS = [
  { cls: 'バーディンガー', field: 'growth', stat: 'dex', to: 0,
    why: 'game8.jp 凱伊（バーディンガー）遊戲截圖技巧成長 45 = 個人 45 + 職業 0；game8.co 亦為 0。' },
  { cls: '戦車兵', field: 'growth', stat: 'dex', to: 15,
    why: 'game8.co、繁中社群表、簡中 wiki 皆為 +15；game8.jp 的 +25 疑似含「戰車兵之道」等級加成。' },
];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace('+', ''));
  return Number.isFinite(n) ? n : null;
};
const cols = (row, from) => KEYS.map((_, i) => num(row['col_' + (from + i)]) ?? 0);
const split = (s) => (s ? String(s).split(':').filter(Boolean) : []);
const zhSkill = (s) => SKILL_ZH[s] ?? s;

async function loadRaw() {
  const refresh = process.argv.includes('--refresh');
  if (!refresh && existsSync(RAW)) return JSON.parse(await readFile(RAW, 'utf8'));
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error('下載失敗 ' + res.status);
  const text = await res.text();
  await mkdir(dirname(RAW), { recursive: true });
  await writeFile(RAW, text);
  return JSON.parse(text);
}

const raw = await loadRaw();
const table = (id) => raw.find((t) => t.id === id).db_data;
const warnings = [];

// ── 職業 ──
const classes = table(23029).map((r) => {
  const jp = r.title;
  const tier = TIER_ZH[r.col_1];
  if (!tier) warnings.push('未知階級 ' + jp + ' ' + r.col_1);
  const name = CLASS_ZH[jp];
  if (!name) warnings.push('職業缺中文名：' + jp);
  const unlock = {
    kai: r.col_56 || '', dietrich: r.col_57 || '', theodora: r.col_58 || '', leda: r.col_59 || '', common: r.col_60 || '',
  };
  const tierRank = tier ? tier.rank : 0;
  const special =
    (tierRank === 3 && Object.values(unlock).some(Boolean)) ||
    (tierRank === 3 && ['踊り子', '鍛冶師', '戦象兵'].includes(jp)) ||
    (tierRank === 4 && unlock.common && unlock.common !== '救世篇1区分クリア');
  const req = [];
  for (const [a, b] of [[42, 43], [44, 45], [46, 47]]) if (r['col_' + a]) req.push(zhSkill(r['col_' + a]) + ' ' + r['col_' + b]);
  const sel = [];
  for (const [a, b] of [[48, 49], [50, 51], [52, 53]]) if (r['col_' + a]) sel.push(zhSkill(r['col_' + a]) + ' ' + r['col_' + b]);
  const mountType = CLASS_MOUNT_TYPE[jp] || null;
  const moveType = r.col_33 || '';
  return {
    id: jp,
    jp,
    zh: name ? name.zh : jp,
    zhTentative: !!(name && name.t),
    alias: (name && name.alias) || [],
    tier: tierRank,
    tierZh: tier ? tier.zh : r.col_1,
    femaleOnly: r.col_2 === '女性限定',
    moveType,
    mounted: /騎|飛行/.test(moveType),
    move: num(r.col_34),
    recLv: num(r.col_31),
    fame: num(r.col_32),
    growth: cols(r, 3),
    mod: cols(r, 12),
    weapons: split(r.col_35).map(zhSkill),
    req: req.join('、'),
    reqSelect: sel.join(' / '),
    license: r.col_41 || '',
    mountType,
    mountMult: mountType && mountType !== 'elephant' ? MOUNT_GROWTH_MULT[jp] || 1 : 0,
    special: !!special,
    unlock,
    url: r.url || '',
  };
});
const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
for (const jp of Object.keys(CLASS_MOUNT_TYPE)) if (!classById[jp]) warnings.push('坐騎對照表的職業不存在：' + jp);
for (const c of classes) if (c.mounted && !c.mountType) warnings.push('騎乘職業未指定坐騎類型：' + c.jp);

const applied = [];
for (const fix of CORRECTIONS) {
  const c = classById[fix.cls];
  const i = KEYS.indexOf(fix.stat);
  const from = c[fix.field][i];
  c[fix.field][i] = fix.to;
  c.corrected = true;
  applied.push({ ...fix, from, clsZh: c.zh });
}

// ── 角色 ──
const initByName = Object.fromEntries(table(23049).map((r) => [r.title, r]));
const units = [];
for (const r of table(23026)) {
  const jp = r.title;
  if (!r.col_20) continue; // 無成長率資料（NPC 等）
  const name = UNIT_ZH[jp];
  if (!name) warnings.push('角色缺中文名：' + jp);
  const init = initByName[jp];
  let join = null;
  if (init && init.col_1 && init.col_2) {
    if (!classById[init.col_1]) warnings.push('加入職業不存在：' + jp + ' ' + init.col_1);
    join = { classId: init.col_1, lv: num(init.col_2), stats: cols(init, 3) };
  }
  const rec = [45, 46, 47, 48, 49].map((i) => r['col_' + i] || null);
  for (const c of rec) if (c && !classById[c]) warnings.push('推薦職業不存在：' + jp + ' ' + c);
  const gender = r.col_3 || (jp === '救世主' ? '男/女' : '');
  units.push({
    id: jp,
    jp,
    zh: name ? name.zh : jp,
    zhTentative: !!(name && name.t),
    note: (name && name.note) || '',
    order: num(r.col_57) ?? 999,
    gender,
    faction: r.col_2 || '',
    factionZh: FACTION_ZH[r.col_2] || '',
    growth: cols(r, 20),
    personalSkill: r.col_10 || '',
    good: split(r.col_12).map(zhSkill),
    weak: split(r.col_14).map(zhSkill),
    rec,
    join,
    noMount: ['オルヘル', 'ゴライアス'].includes(jp),
    rating: r.col_53 || '',
    url: r.url || '',
  });
}
units.sort((a, b) => a.order - b.order);

// ── 坐騎 ──
const toArr = (o) => KEYS.map((k) => o[k] || 0);
const mounts = MOUNTS.map((m) => ({
  ...m,
  alias: m.alias || [],
  verified: m.verified !== false,
  zhTentative: !!m.zhTentative,
  note: m.note || '',
  stat: toArr(m.stat),
  growth: toArr(m.growth),
}));

const data = {
  stats: STATS,
  units,
  classes,
  mounts,
  mountTypes: MOUNT_TYPES,
  routes: ROUTES,
  meta: {
    source: SRC_URL,
    builtAt: new Date().toISOString(),
    corrections: applied.map(({ cls, clsZh, field, stat, from, to, why }) => ({ cls, clsZh, field, stat, from, to, why })),
  },
};

const banner = '// 由 tools/build-data.mjs 產生，請勿手動修改。\n';
await writeFile(OUT, banner + 'window.FE_DATA = ' + JSON.stringify(data) + ';\n');

console.log(`角色 ${units.length}（有加入資料 ${units.filter((u) => u.join).length}）、職業 ${classes.length}、坐騎 ${mounts.length}`);
console.log('套用修正：', applied.map((a) => `${a.cls} ${a.stat} ${a.from}→${a.to}`).join('；'));
const tentative = [...units.filter((u) => u.zhTentative).map((u) => u.zh), ...classes.filter((c) => c.zhTentative).map((c) => c.zh)];
console.log('暫譯名稱：', tentative.join('、'));
if (warnings.length) {
  console.log('\n警告：');
  for (const w of warnings) console.log(' - ' + w);
}
