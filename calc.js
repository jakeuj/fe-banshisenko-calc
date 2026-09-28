/* FE 萬紫千紅 培養計算引擎（瀏覽器：window.FECalc；Node：require('./calc.js')）
 *
 * 公式（與 game8 計算器相同，另加坐騎）：
 *   每級成長率 p_k = max(0, 個人_k + 職業_k + 倍率 × 坐騎成長_k + 自訂_k) / 100
 *   每次升級：+floor(p)，並以 (p − floor(p)) 的機率再 +1
 *   顯示值 = 內部值 + 職業補正 + 坐騎能力加成（兩者都只在該職業/騎乘時生效）
 *   期望顯示值 = round(E[內部值] + 1e-7) + 補正
 *   倍率：坐騎類型與職業相符時為 1，戰車兵為 2；不符或步行職業為 0。
 *   戰車兵另有「戰車」本身的成長加成（戰車兵之道），以 bonus 陣列加在成長率上。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FECalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const N = 9;
  const zeros = () => new Array(N).fill(0);
  const add = (a, b) => a.map((v, i) => v + (b ? b[i] || 0 : 0));

  // ── 坐騎 ──
  function mountFits(cls, mount) {
    return !!(cls && mount && cls.mountType && cls.mountType !== 'elephant' && mount.type === cls.mountType);
  }
  function mountGrowthMult(cls, mount) {
    return mountFits(cls, mount) ? cls.mountMult || 1 : 0;
  }
  function mountStat(cls, mount) {
    return mountFits(cls, mount) ? mount.stat.slice() : zeros();
  }

  // ── 成長率與補正 ──
  // bonus：職業附帶的額外成長加成（目前只有戰車兵的戰車），不是戰車兵時呼叫端傳 null
  function effectiveGrowth(unit, cls, mount, custom, bonus) {
    const mult = mountGrowthMult(cls, mount);
    const g = [];
    for (let k = 0; k < N; k++) {
      g.push(
        unit.growth[k] +
          (cls ? cls.growth[k] : 0) +
          (mult ? mult * mount.growth[k] : 0) +
          (custom ? Number(custom[k]) || 0 : 0) +
          (bonus ? Number(bonus[k]) || 0 : 0)
      );
    }
    return g;
  }
  function displayMod(cls, mount) {
    return add(cls ? cls.mod : zeros(), mountStat(cls, mount));
  }
  function toInternal(displayed, cls, mount) {
    const m = displayMod(cls, mount);
    return displayed.map((v, k) => (Number(v) || 0) - m[k]);
  }

  // ── 機率分布（每項能力：base + 增量的 PMF）──
  function pmfStep(pmf, p) {
    // 一次升級：增量為 floor(p) 或 floor(p)+1
    const q = Math.max(0, p) / 100;
    const whole = Math.floor(q + 1e-12);
    const frac = q - whole;
    const out = new Float64Array(pmf.length + whole + 1);
    for (let i = 0; i < pmf.length; i++) {
      const v = pmf[i];
      if (!v) continue;
      out[i + whole] += v * (1 - frac);
      out[i + whole + 1] += v * frac;
    }
    // 去掉尾端 0
    let end = out.length;
    while (end > 1 && out[end - 1] === 0) end--;
    return end === out.length ? out : out.slice(0, end);
  }
  function pmfMean(pmf) {
    let s = 0;
    for (let i = 0; i < pmf.length; i++) s += i * pmf[i];
    return s;
  }
  function pmfQuantile(pmf, q) {
    let c = 0;
    for (let i = 0; i < pmf.length; i++) {
      c += pmf[i];
      if (c >= q - 1e-9) return i;
    }
    return pmf.length - 1;
  }
  function pmfMin(pmf) {
    for (let i = 0; i < pmf.length; i++) if (pmf[i] > 0) return i;
    return 0;
  }
  function pmfMax(pmf) {
    for (let i = pmf.length - 1; i >= 0; i--) if (pmf[i] > 0) return i;
    return 0;
  }
  function convolve(a, b) {
    const out = new Float64Array(a.length + b.length - 1);
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (!x) continue;
      for (let j = 0; j < b.length; j++) out[i + j] += x * b[j];
    }
    return out;
  }

  /**
   * 預測
   * @param unit      角色資料
   * @param start     { lv, cls, mount, displayed[9], bonus? }（cls/mount 為物件）
   * @param segments  [{ toLv, cls, mount, custom[9], bonus? }]，toLv 遞增（bonus＝戰車加成等）
   * @returns { start: row, rows: [row], errors: [] }
   *   row = { lv, cls, mount, growth[9](有效成長率), mod[9], base[9](起點內部值), pmf[9], mean[9](內部期望),
   *           expected[9](期望顯示值), total }
   */
  function project(unit, start, segments) {
    const errors = [];
    const base = toInternal(start.displayed, start.cls, start.mount);
    let pmfs = base.map(() => Float64Array.of(1));
    let lv = Number(start.lv) || 1;
    const mkRow = (cls, mount, growth) => {
      const mod = displayMod(cls, mount);
      const mean = pmfs.map((p, k) => base[k] + pmfMean(p));
      const expected = mean.map((m, k) => Math.round(m + 1e-7) + mod[k]);
      return {
        lv, cls, mount, growth, mod, base, pmf: pmfs, mean, expected,
        // 合計與 game8 相同：先加總期望值再四捨五入（不是把四捨五入後的各項相加）
        total: Math.round(mean.reduce((a, b) => a + b, 0) + 1e-7) + mod.reduce((a, b) => a + b, 0),
      };
    };
    const startRow = Object.assign(mkRow(start.cls, start.mount, effectiveGrowth(unit, start.cls, start.mount, null, start.bonus)), {
      seg: start,
    });
    const rows = [];
    for (const seg of segments) {
      const to = Number(seg.toLv);
      if (!Number.isFinite(to)) continue;
      if (to < lv) {
        errors.push(`Lv${to} 低於前一段的 Lv${lv}`);
        continue;
      }
      const g = effectiveGrowth(unit, seg.cls, seg.mount, seg.custom, seg.bonus);
      const levels = to - lv;
      const next = pmfs.map((p, k) => {
        let cur = p;
        for (let i = 0; i < levels; i++) cur = pmfStep(cur, g[k]);
        return cur;
      });
      pmfs = next;
      lv = to;
      rows.push(Object.assign(mkRow(seg.cls, seg.mount, g), { levels, seg }));
    }
    return { start: startRow, rows, errors };
  }

  // ── 成長判定 ──
  const JUDGE_BANDS = [
    { max: 0.05, label: '神成長', cls: 'god' },
    { max: 0.25, label: '良成長', cls: 'good' },
    { max: 0.75, label: '普通', cls: 'avg', exclusive: true },
    { max: 1.01, label: '偏低', cls: 'low' },
  ];
  function band(top) {
    if (top <= 0.05) return JUDGE_BANDS[0];
    if (top <= 0.25) return JUDGE_BANDS[1];
    if (top < 0.75) return JUDGE_BANDS[2];
    return JUDGE_BANDS[3];
  }
  // pmf 為增量分布，gain = 實際內部值 − 起點內部值
  function judgeOne(pmf, gain) {
    const lo = pmfMin(pmf);
    const hi = pmfMax(pmf);
    if (gain > hi) return { top: 0, band: null, over: true, lo, hi };
    if (gain < lo) return { top: 1, band: null, under: true, lo, hi };
    let above = 0;
    for (let i = gain + 1; i < pmf.length; i++) above += pmf[i];
    const top = above + (pmf[gain] || 0) / 2;
    return { top, band: band(top), lo, hi };
  }
  const JUDGE_GROUPS = [
    { label: '合計', idx: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    { label: '物理（HP・力・速・技・防）', idx: [0, 1, 3, 4, 5] },
    { label: '魔法（HP・魔・速・魔防）', idx: [0, 2, 3, 6] },
    { label: '力量＋速度', idx: [1, 3] },
    { label: '魔力＋速度', idx: [2, 3] },
    { label: '防守＋魔防', idx: [5, 6] },
  ];
  /**
   * @param row     project() 產生的某列（提供 pmf/base/mod）
   * @param actual  該等級的實際顯示值[9]
   */
  function judge(row, actual) {
    const gains = actual.map((v, k) => (Number(v) || 0) - row.mod[k] - row.base[k]);
    const stats = row.pmf.map((p, k) => judgeOne(p, gains[k]));
    const groups = JUDGE_GROUPS.map((g) => {
      let pmf = Float64Array.of(1);
      let gain = 0;
      for (const k of g.idx) {
        pmf = convolve(pmf, row.pmf[k]);
        gain += gains[k];
      }
      return Object.assign({ label: g.label }, judgeOne(pmf, gain));
    });
    return { stats, groups };
  }

  // ── 自動推薦 ──
  function weightedPerLevel(growth, weights) {
    let s = 0;
    for (let k = 0; k < N; k++) s += (weights[k] || 0) * Math.max(0, growth[k]) / 100;
    return s;
  }
  function weightedSum(arr, weights) {
    let s = 0;
    for (let k = 0; k < N; k++) s += (weights[k] || 0) * arr[k];
    return s;
  }

  /** 可用職業篩選（性別、無法騎乘、階級、特殊解鎖、神將） */
  function eligibleClasses(data, unit, opts) {
    const female = opts.gender ? opts.gender === '女' : unit.gender === '女';
    return data.classes.filter((c) => {
      if (c.tier === 0) return false;
      if (c.femaleOnly && !female) return false;
      if (unit.noMount && c.mounted) return false;
      if (c.tier > (opts.maxTier || 4) && c.tier !== 5) return false;
      if (c.tier === 5 && !opts.includeDivine) return false;
      if (c.special && !opts.includeSpecial) return false;
      return true;
    });
  }

  /** 對某職業找最佳坐騎（per-level 加權收益 + 可選的最終顯示加成權重） */
  function bestMountFor(unit, cls, mounts, weights, levels, finalStage, bonus) {
    const candidates = [null];
    if (cls.mountType && cls.mountType !== 'elephant') {
      for (const m of mounts) if (m.type === cls.mountType) candidates.push(m);
    }
    let best = null;
    for (const m of candidates) {
      const g = effectiveGrowth(unit, cls, m, null, bonus);
      const per = weightedPerLevel(g, weights);
      const fin = finalStage ? weightedSum(displayMod(cls, m), weights) : 0;
      const score = per * levels + fin;
      if (!best || score > best.score + 1e-9) best = { cls, mount: m, growth: g, per, fin, score };
    }
    return best;
  }

  /**
   * @param opts {
   *   unit, startLv, startCls, targetLv, weights[9],
   *   tierLv: {1,2,3,4,5}（各階可轉職的等級）, maxTier, includeSpecial, includeDivine,
   *   mounts: 可用坐騎陣列, finalClassId, gender, topN, perStage,
   *   classBonus: (cls) => 額外成長陣列或 null（戰車兵的戰車加成）
   * }
   */
  function recommend(data, opts) {
    const unit = opts.unit;
    const weights = opts.weights;
    const startLv = Number(opts.startLv) || 1;
    const targetLv = Math.max(startLv, Number(opts.targetLv) || 99);
    const pool = eligibleClasses(data, unit, opts);
    const mounts = opts.mounts || [];
    const tierLv = opts.tierLv || { 1: 5, 2: 20, 3: 35, 4: 45, 5: 60 };
    const maxTier = opts.maxTier || 4;
    const bonusFor = (c) => (opts.classBonus ? opts.classBonus(c) : null);

    // 階段切點
    const cuts = new Set([startLv, targetLv]);
    for (let t = 1; t <= 5; t++) {
      const L = Number(tierLv[t]);
      if (t === 5 && !opts.includeDivine) continue;
      if (t < 5 && t > maxTier) continue;
      if (Number.isFinite(L) && L > startLv && L < targetLv) cuts.add(L);
    }
    const pts = [...cuts].sort((a, b) => a - b);
    const availTier = (L) => {
      let best = 0;
      for (let t = 1; t <= 5; t++) {
        if (t === 5 && !opts.includeDivine) continue;
        if (t < 5 && t > maxTier) continue;
        if (Number(tierLv[t]) <= L) best = t;
      }
      return best;
    };

    const perStage = opts.perStage || 6;
    const stages = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const from = pts[i];
      const to = pts[i + 1];
      const levels = to - from;
      const finalStage = i === pts.length - 2;
      const tierCap = availTier(from);
      let classes = pool.filter((c) => (c.tier === 5 ? tierCap === 5 : c.tier <= Math.min(tierCap, 4)));
      // 目前職業已取得證照，任何階段都可以繼續使用
      if (opts.startCls && !classes.includes(opts.startCls)) classes.push(opts.startCls);
      if (finalStage && opts.finalClassId) classes = data.classes.filter((c) => c.id === opts.finalClassId);
      const options = classes
        .map((c) => bestMountFor(unit, c, mounts, weights, levels, finalStage, bonusFor(c)))
        .sort((a, b) => b.score - a.score)
        .slice(0, perStage);
      stages.push({ from, to, levels, finalStage, tierCap, options });
    }

    // 若目標等級 = 起點（無升級），仍可比較最終職業的補正
    if (!stages.length) {
      let classes = pool.slice();
      if (opts.finalClassId) classes = data.classes.filter((c) => c.id === opts.finalClassId);
      const options = classes
        .map((c) => bestMountFor(unit, c, mounts, weights, 0, true, bonusFor(c)))
        .sort((a, b) => b.score - a.score)
        .slice(0, perStage);
      stages.push({ from: startLv, to: startLv, levels: 0, finalStage: true, tierCap: 4, options });
    }

    // 各階段 top-K 組合 → 前 N 條路線
    let combos = [{ picks: [], score: 0 }];
    for (const st of stages) {
      const next = [];
      for (const c of combos) for (const o of st.options) next.push({ picks: c.picks.concat(o), score: c.score + o.score });
      next.sort((a, b) => b.score - a.score);
      combos = next.slice(0, 200);
    }
    const topN = opts.topN || 5;
    const routes = combos.slice(0, topN).map((c) => {
      const segs = [];
      c.picks.forEach((p, i) => {
        const st = stages[i];
        const last = segs[segs.length - 1];
        if (last && last.cls === p.cls && last.mount === p.mount) last.toLv = st.to;
        else segs.push({ toLv: st.to, cls: p.cls, mount: p.mount, fromLv: st.from });
      });
      return { score: c.score, segments: segs };
    });

    // 成長率排行（不看等級門檻，只看篩選條件）
    const ranking = pool
      .map((c) => bestMountFor(unit, c, mounts, weights, 1, false, bonusFor(c)))
      .sort((a, b) => b.per - a.per);

    return { stages, routes, ranking };
  }

  return {
    N,
    mountFits,
    mountGrowthMult,
    mountStat,
    effectiveGrowth,
    displayMod,
    toInternal,
    project,
    judge,
    judgeOne,
    JUDGE_GROUPS,
    pmfMean,
    pmfQuantile,
    pmfMin,
    pmfMax,
    weightedPerLevel,
    eligibleClasses,
    recommend,
  };
});
