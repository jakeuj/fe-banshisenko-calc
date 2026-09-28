// node tools/test-calc.mjs —— 驗證計算引擎與資料
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(join(root, 'calc.js'));
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'data.js'), 'utf8'), ctx);
const D = JSON.parse(JSON.stringify(ctx.window.FE_DATA)); // 轉回本 realm 的陣列

const unit = (jp) => D.units.find((u) => u.jp === jp);
const cls = (jp) => D.classes.find((c) => c.jp === jp);
const mount = (id) => D.mounts.find((m) => m.id === id);
let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('✓ ' + name);
  } catch (e) {
    console.log('✗ ' + name + '\n  ' + e.message.split('\n').join('\n  '));
    process.exitCode = 1;
  }
};

// 欄位順序：HP 力 魔 速 技 守 魔防 運 魅
test('資料筆數', () => {
  assert.ok(D.units.length >= 64);
  assert.equal(D.classes.length, 60);
  assert.equal(D.mounts.length, 19);
  assert.deepEqual(unit('レダ').growth, [40, 35, 35, 65, 50, 30, 35, 25, 55]);
});

test('ソフィア推薦路線 = game8 計算器輸出', () => {
  const u = unit('ソフィア');
  const j = u.join;
  assert.equal(j.classId, '呪い師');
  assert.equal(j.lv, 8);
  const r = C.project(
    u,
    { lv: j.lv, cls: cls(j.classId), mount: null, displayed: j.stats },
    [
      { toLv: 20, cls: cls('呪い師') },
      { toLv: 35, cls: cls('プリースト') },
      { toLv: 45, cls: cls('ビショップ') },
      { toLv: 99, cls: cls('ワイズマン') },
    ]
  );
  assert.deepEqual(r.rows[0].expected, [30, 9, 22, 10, 14, 8, 18, 11, 12]);
  assert.equal(r.rows[0].total, 134);
  assert.deepEqual(r.rows[1].expected, [36, 13, 30, 15, 21, 11, 28, 19, 20]);
  assert.equal(r.rows[1].total, 194);
  assert.equal(r.rows[2].total, 241);
  assert.deepEqual(r.rows[3].expected, [69, 29, 76, 36, 52, 20, 75, 53, 53]);
  assert.equal(r.rows[3].total, 463);
  // PMF 總和 = 1、平均 = 期望
  for (const row of r.rows) {
    row.pmf.forEach((p, k) => {
      const sum = p.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, 'PMF 總和 ' + sum);
      assert.ok(Math.abs(row.base[k] + C.pmfMean(p) - row.mean[k]) < 1e-9);
    });
  }
});

test('馬吉迪 + 戰車兵 + 多輪升級後戰車 + 汗血馬 = 玩家實測 HP95 力80 技65 防90', () => {
  const u = unit('マジーデ');
  const c = cls('戦車兵');
  assert.equal(c.chariot, true);
  const upgraded = D.chariotStages.find((x) => x.id === 'upgraded').growth;
  // 戰車兵職業 + 升級後戰車 = 實測的後期戰車兵職業成長
  assert.deepEqual(c.growth.map((v, k) => v + upgraded[k]), [20, 20, 0, 0, 25, 30, 5, 10, 20]);
  const g = C.effectiveGrowth(u, c, mount('kanketsu'), null, upgraded);
  assert.equal(g[0], 95); // HP
  assert.equal(g[1], 80); // 力
  assert.equal(g[4], 65); // 技
  assert.equal(g[5], 90); // 守
  assert.equal(C.mountGrowthMult(c, mount('kanketsu')), 2);
  // project 會把 bonus 算進成長
  const r = C.project(u, { lv: 20, cls: c, displayed: new Array(9).fill(10) }, [{ toLv: 21, cls: c, mount: mount('kanketsu'), bonus: upgraded }]);
  assert.equal(r.rows[0].growth[0], 95);
});

test('資料修正：多來源一致、只有 game8.jp 不同的值', () => {
  assert.equal(cls('軽騎兵').growth[4], 0);
  assert.deepEqual([cls('騎甲駝兵').growth[3], cls('騎甲駝兵').growth[4]], [10, 5]);
  assert.equal(cls('フォレストナイト').growth[4], 10);
  assert.deepEqual([cls('マスターアーチ').growth[3], cls('マスターアーチ').growth[4]], [15, 20]);
  assert.deepEqual([cls('聖天翼兵').growth[3], cls('聖天翼兵').growth[4]], [10, 5]);
  assert.deepEqual([cls('ドラゴンマスター').growth[3], cls('ドラゴンマスター').growth[4]], [5, 0]);
  assert.equal(unit('ナジャ').growth[1], 45);
  assert.ok(D.meta.corrections.every((c) => c.from !== c.to), 'game8 已自行修正的項目應從 CORRECTIONS 移除');
});

test('補充加入資料（騰訊文件表，不含補正 → 自動加上職業補正）', () => {
  const a = unit('アンナ');
  assert.equal(a.join.classId, '戦象兵');
  assert.equal(a.join.lv, 30);
  // 表上 39 14 11 21 20 19 9 20 13 + 戰象兵補正 HP+10 力+2 速-5 技+3 守+7 魅+3
  assert.deepEqual(a.join.stats, [49, 16, 11, 16, 23, 26, 9, 20, 16]);
  assert.ok(unit('コウカ').join && unit('トロイア').join);
  assert.equal(unit('ソフィア').join.source, 'game8');
});

test('凱伊 + 榮光騎士(已修正) + 野生馬 = game8 截圖', () => {
  const u = unit('カイ');
  const c = cls('バーディンガー');
  assert.deepEqual(C.effectiveGrowth(u, c, null), [55, 55, 35, 45, 45, 40, 45, 45, 50]);
  assert.deepEqual(C.effectiveGrowth(u, c, mount('wild_horse')), [60, 55, 35, 50, 50, 45, 50, 45, 50]);
  assert.deepEqual(C.mountStat(c, mount('wild_horse')), [0, 0, 0, 1, 3, 1, 0, 0, 0]);
});

test('坐騎限制：牧師不能騎、輕騎兵不能配飛馬', () => {
  assert.equal(C.mountGrowthMult(cls('プリースト'), mount('wild_horse')), 0);
  assert.equal(C.mountGrowthMult(cls('軽騎兵'), mount('wild_pegasus')), 0);
  assert.equal(C.mountGrowthMult(cls('軽騎兵'), mount('wild_horse')), 1);
  assert.equal(C.mountGrowthMult(cls('戦象兵'), mount('wild_horse')), 0);
});

test('起點含坐騎能力加成時，內部值要扣掉', () => {
  const c = cls('軽騎兵');
  const m = mount('kanketsu');
  const disp = [30, 15, 5, 10, 10, 12, 5, 8, 8];
  const internal = C.toInternal(disp, c, m);
  assert.deepEqual(internal, disp.map((v, k) => v - c.mod[k] - m.stat[k]));
});

test('成長判定：期望值附近為普通、極端值為神成長/偏低', () => {
  const u = unit('ソフィア');
  const j = u.join;
  const r = C.project(u, { lv: 8, cls: cls('呪い師'), displayed: j.stats }, [{ toLv: 20, cls: cls('呪い師') }]);
  const row = r.rows[0];
  const mid = C.judge(row, row.expected);
  mid.stats.forEach((s) => assert.ok(s.top > 0.2 && s.top < 0.8, '期望值百分位 ' + s.top));
  const hi = C.judge(row, row.expected.map((v) => v + 4));
  assert.equal(hi.groups[0].band.label, '神成長');
  const lo = C.judge(row, row.expected.map((v) => v - 4));
  assert.equal(lo.groups[0].band.label, '偏低');
});

test('自動推薦：索緋雅 Lv29 牧師、魔法權重', () => {
  const u = unit('ソフィア');
  const w = [0.3, 0, 1, 1, 0.4, 0, 0.4, 0, 0];
  const res = C.recommend(D, {
    unit: u, startLv: 29, startCls: cls('プリースト'), targetLv: 60, weights: w,
    maxTier: 4, includeSpecial: false, includeDivine: false, mounts: D.mounts,
  });
  assert.ok(res.routes.length > 0);
  const top = res.routes[0];
  assert.equal(top.segments[top.segments.length - 1].toLv, 60);
  for (const s of top.segments) assert.ok(!s.cls.femaleOnly || u.gender === '女');
  console.log('  最佳：' + top.segments.map((s) => `Lv${s.toLv} ${s.cls.zh}${s.mount ? '+' + s.mount.zh : ''}`).join(' → '));
});

test('哥萊亞斯推薦不含騎乘職、男性不含天翼兵', () => {
  const g = unit('ゴライアス');
  const pool = C.eligibleClasses(D, g, { maxTier: 4, includeSpecial: true, includeDivine: true });
  assert.ok(pool.every((c) => !c.mounted));
  assert.ok(!pool.some((c) => c.femaleOnly));
});

console.log(`\n${passed} 項通過`);
