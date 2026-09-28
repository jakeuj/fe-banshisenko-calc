(function () {
  'use strict';

  const BASE = window.FE_DATA;
  const C = window.FECalc;
  const N = 9;
  const STORE_KEY = 'fe-bsk-calc-v1';
  const SHORT = ['HP', '力', '魔', '速', '技', '防', '魔防', '運', '魅'];
  const STAT_ZH = BASE.stats.map((s) => s.zh);
  const TIER_NAMES = { 0: '基本', 1: '初級', 2: '中級', 3: '上級', 4: '最上級', 5: '神將' };
  const TIER_ORDER = [1, 2, 3, 4, 5, 0];
  const DEFAULT_TIER_LV = { 1: 5, 2: 20, 3: 35, 4: 45, 5: 60 };
  const AVAIL_ZH = { capture: '凱伊篇・救世篇捕獲', capture3: '救世篇捕獲（稀有）', io: '伊歐附帶', alexandra: '亞歷山卓附帶' };
  const INTERVALS = { q25: [0.25, 0.75, '25%–75%'], q10: [0.1, 0.9, '10%–90%'] };

  const PRESETS = [
    { id: 'phys', zh: '物理輸出', w: [0.3, 1, 0, 1, 0.6, 0.3, 0, 0, 0] },
    { id: 'magic', zh: '魔法輸出', w: [0.3, 0, 1, 1, 0.4, 0, 0.4, 0, 0] },
    { id: 'tank', zh: '坦克', w: [0.8, 0.3, 0, 0.3, 0, 1, 1, 0, 0] },
    { id: 'speed', zh: '速度技巧', w: [0, 0.3, 0, 1, 1, 0, 0, 0.3, 0] },
    { id: 'healer', zh: '回復輔助', w: [0.3, 0, 1, 0.5, 0, 0, 0.8, 0.5, 0.5] },
    { id: 'all', zh: '均衡（合計）', w: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  ];

  // ───────────────────────── 工具 ─────────────────────────
  const el = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const int = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d === undefined ? 0 : d;
  };
  const numv = (v, d) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d === undefined ? 0 : d;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmtBonus = (arr) => arr.map((v, k) => (v ? SHORT[k] + v : '')).filter(Boolean).join(' ') || '—';
  const signed = (v) => (v > 0 ? '+' + v : String(v));
  const pct = (x) => {
    const v = x * 100;
    if (v < 0.1) return '<0.1%';
    if (v > 99.9) return '>99.9%';
    return (v < 10 ? v.toFixed(1) : v.toFixed(0)) + '%';
  };
  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  // ───────────────────────── 狀態 ─────────────────────────
  function defaultRec() {
    return {
      preset: 'phys',
      weights: PRESETS[0].w.slice(),
      targetLv: 99,
      tierLv: Object.assign({}, DEFAULT_TIER_LV),
      maxTier: 4,
      includeSpecial: false,
      includeDivine: false,
      finalClassId: '',
      ownedOnly: false,
      owned: [],
      showAllRank: false,
      chariot: 'initial',
    };
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return s && typeof s === 'object' ? s : {};
    } catch (e) {
      return {};
    }
  }
  const saveNow = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 私密視窗等情況無法儲存，忽略 */
    }
  };
  const save = debounce(saveNow, 250);

  const saved = loadState();
  const state = Object.assign(
    {
      unitId: 'ソフィア',
      route: 'kai',
      showAllMounts: false,
      interval: 'q25',
      tab: 'plan',
      plans: {},
      dataKind: 'classes',
      editId: '',
    },
    saved
  );
  state.rec = Object.assign(defaultRec(), saved.rec || {});
  state.rec.tierLv = Object.assign({}, DEFAULT_TIER_LV, (saved.rec && saved.rec.tierLv) || {});
  state.overrides = Object.assign({ units: {}, classes: {}, mounts: {} }, saved.overrides || {});

  // ───────────────────────── 資料（含使用者校正）─────────────────────────
  let D;
  function buildData() {
    D = JSON.parse(JSON.stringify(BASE));
    for (const kind of ['units', 'classes', 'mounts']) {
      const map = state.overrides[kind] || {};
      for (const id of Object.keys(map)) {
        const it = D[kind].find((x) => x.id === id);
        if (!it) continue;
        const o = map[id];
        for (const f of Object.keys(o)) {
          if (Array.isArray(o[f]) && o[f].length === N) {
            it[f] = o[f].map((v) => numv(v));
            it.overridden = true;
          }
        }
      }
    }
    D.unitById = Object.fromEntries(D.units.map((x) => [x.id, x]));
    D.classById = Object.fromEntries(D.classes.map((x) => [x.id, x]));
    D.mountById = Object.fromEntries(D.mounts.map((x) => [x.id, x]));
  }
  buildData();
  if (!D.unitById[state.unitId]) state.unitId = D.units[0].id;

  const unit = () => D.unitById[state.unitId];
  const clsOf = (id) => (id && D.classById[id]) || null;
  const mountOf = (id) => (id && D.mountById[id]) || null;
  const routeObj = () => D.routes.find((r) => r.id === state.route) || D.routes[0];
  const mountAvailable = (m) => state.showAllMounts || routeObj().avail.includes(m.avail);
  const typeZh = (t) => (D.mountTypes[t] ? D.mountTypes[t].zh : t);
  const genderOf = (u, p) => (u.gender === '男/女' ? (p && p.gender) || '男' : u.gender);

  // game8 風格的推薦路線：到達各階推薦等級時換成角色的推薦職業
  function recRoute(u, start, targetLv) {
    targetLv = targetLv || 99;
    const segs = [];
    let cur = start.classId;
    const curTier = clsOf(cur) ? clsOf(cur).tier : 0;
    // 起點已超過的階級：直接換成最高的推薦職業（與 game8 相同）
    let passed = null;
    for (let t = 1; t <= 4; t++) {
      const c = u.rec[t - 1];
      const L = (clsOf(c) && clsOf(c).recLv) || DEFAULT_TIER_LV[t];
      if (c && L <= start.lv && t > curTier) passed = c;
    }
    if (passed) cur = passed;
    for (let t = 1; t <= 4; t++) {
      const c = u.rec[t - 1];
      if (!c) continue;
      const L = (clsOf(c) && clsOf(c).recLv) || DEFAULT_TIER_LV[t];
      if (L <= start.lv || L >= targetLv) continue;
      if (c === cur) continue;
      segs.push({ toLv: L, classId: cur, mountId: '', custom: null });
      cur = c;
    }
    segs.push({ toLv: targetLv, classId: cur, mountId: '', custom: null });
    return segs;
  }
  function defaultPlan(u) {
    const j = u.join;
    const start = j
      ? { lv: j.lv, classId: j.classId, mountId: '', stats: j.stats.slice() }
      : { lv: 1, classId: '平民', mountId: '', stats: new Array(N).fill(0) };
    return {
      gender: u.gender === '男/女' ? '男' : u.gender,
      start,
      segments: recRoute(u, start),
      judge: { row: 0, stats: null },
    };
  }
  function plan() {
    let p = state.plans[state.unitId];
    if (!p || !p.start || !Array.isArray(p.segments)) {
      p = defaultPlan(unit());
      state.plans[state.unitId] = p;
    }
    if (!p.judge) p.judge = { row: 0, stats: null };
    return p;
  }

  // ───────────────────────── 共用片段 ─────────────────────────
  const statZhOf = (key) => STAT_ZH[BASE.stats.findIndex((s) => s.key === key)];
  function correctionText(kind, item) {
    const list = (D.meta.corrections || []).filter((c) => c.kind === kind && c.id === item.jp);
    return list
      .map((c) => `${item.zh}的${statZhOf(c.stat)}成長已由 game8 的 ${signed(c.from)} 修正為 ${signed(c.to)}：${c.why}`)
      .join('；');
  }
  // 戰車兵之道：戰車本身的成長加成（初始／多輪升級後／不計），預設為初始
  const CHARIOT_DEFAULT = 'initial';
  const chariotStage = (id) =>
    D.chariotStages.find((x) => x.id === (id || CHARIOT_DEFAULT)) || D.chariotStages.find((x) => x.id === CHARIOT_DEFAULT);
  const chariotBonus = (cls, id) => (cls && cls.chariot ? chariotStage(id).growth : null);
  function chariotSelect(attrs, cls, selectedId) {
    if (!cls || !cls.chariot) return '';
    const cur = chariotStage(selectedId).id;
    return `<label class="f"><span>戰車（戰車兵之道）</span><select ${attrs}>${D.chariotStages
      .map(
        (x) =>
          `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.zh)}${
            x.id === 'none' ? '' : '｜成長 ' + esc(fmtBonus(x.growth))
          }${x.verified || x.id === 'none' ? '' : '（未確認）'}</option>`
      )
      .join('')}</select></label>`;
  }
  function issuesFor(u, gender, cls, mount, chariotId) {
    const out = [];
    if (!cls) return out;
    if (cls.femaleOnly && gender !== '女') out.push(['err', `${cls.zh}為女性限定職業`]);
    if (u.noMount && cls.mounted) out.push(['err', `${u.zh}的個人技能使其無法轉職為騎兵或飛行兵種`]);
    if (mount) {
      if (!C.mountFits(cls, mount)) out.push(['warn', `${cls.zh}不能配屬「${mount.zh}」（${typeZh(mount.type)}系），坐騎加成不計入`]);
      else {
        if (!mountAvailable(mount)) out.push(['warn', `目前選的路線取得不到「${mount.zh}」（${AVAIL_ZH[mount.avail] || ''}）`]);
        if (!mount.verified) out.push(['warn', `「${mount.zh}」的數值未確認：${mount.note}`]);
      }
    }
    if (cls.chariot) {
      const st = chariotStage(chariotId);
      out.push([
        'info',
        '戰車兵：坐騎的成長加成 ×2（兩匹馬拉車），另外戰車本身也有成長加成（戰車兵之道）。戰車何時升級未公開，請依遊戲內狀況選「初始戰車」或「多輪升級後」。',
      ]);
      if (!st.verified && st.id !== 'none') out.push(['warn', `「${st.zh}」的數值未確認：${st.note}`]);
    }
    if (cls.jp === '戦象兵') out.push(['info', '戰象兵：沒有可捕獲的象坐騎。「戰象兵之道」會讓成長率隨等級提高，公式未公開，可用「✎ 修正」補差額。']);
    if (cls.corrected) out.push(['info', correctionText('class', cls)]);
    if (cls.overridden) out.push(['info', `${cls.zh}的數值已被你在「資料／校正」中修改`]);
    return out;
  }
  const notesHtml = (list) =>
    list.length ? `<ul class="notes">${list.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>` : '';

  function classSelect(attrs, selectedId, u, gender, opts) {
    opts = opts || {};
    let html = `<select ${attrs}>`;
    if (opts.emptyLabel) html += `<option value="">${esc(opts.emptyLabel)}</option>`;
    for (const t of TIER_ORDER) {
      const list = D.classes.filter((c) => c.tier === t);
      if (!list.length) continue;
      html += `<optgroup label="${TIER_NAMES[t]}">`;
      for (const c of list) {
        const bad = (c.femaleOnly && gender !== '女') || (u.noMount && c.mounted);
        const extra = [
          c.mountType && c.mountType !== 'elephant' ? typeZh(c.mountType) + (c.mountMult > 1 ? '×' + c.mountMult : '') : '',
          c.femaleOnly ? '女限' : '',
          c.special ? '特殊解鎖' : '',
        ]
          .filter(Boolean)
          .join('・');
        html += `<option value="${esc(c.id)}"${c.id === selectedId ? ' selected' : ''}>${bad ? '⚠ ' : ''}${esc(c.zh)}${
          extra ? '（' + esc(extra) + '）' : ''
        }</option>`;
      }
      html += '</optgroup>';
    }
    return html + '</select>';
  }
  function mountSelect(attrs, cls, selectedId) {
    if (!cls || !cls.mountType || cls.mountType === 'elephant') {
      const why = cls && cls.mountType === 'elephant' ? '沒有可捕獲的象' : '此職業不騎乘';
      return `<select ${attrs} disabled><option>—（${why}）</option></select>`;
    }
    const list = D.mounts.filter((m) => m.type === cls.mountType && (mountAvailable(m) || m.id === selectedId));
    let html = `<select ${attrs}><option value="">不配屬坐騎</option>`;
    for (const m of list) {
      html += `<option value="${esc(m.id)}"${m.id === selectedId ? ' selected' : ''}>${mountAvailable(m) ? '' : '⚠ '}${esc(m.zh)}｜成長 ${esc(
        fmtBonus(m.growth)
      )}${m.verified ? '' : '（未確認）'}</option>`;
    }
    return html + '</select>';
  }
  function growthChips(u, cls, mount, custom, bonus) {
    const g = C.effectiveGrowth(u, cls, mount, custom, bonus);
    const mult = C.mountGrowthMult(cls, mount);
    const chips = g.map((v, k) => {
      const mb = mult ? mult * mount.growth[k] : 0;
      const bb = bonus ? bonus[k] : 0;
      const cb = custom ? numv(custom[k]) : 0;
      const title = `個人 ${u.growth[k]} ＋ 職業 ${cls ? cls.growth[k] : 0}${mb ? ' ＋ 坐騎 ' + mb : ''}${bb ? ' ＋ 戰車 ' + bb : ''}${
        cb ? ' ＋ 自訂 ' + cb : ''
      }`;
      const parts = [mb ? '坐騎' + signed(mb) : '', bb ? '戰車' + signed(bb) : '', cb ? '自訂' + signed(cb) : ''].filter(Boolean);
      const extra = parts.length ? `<small> (${parts.join(' ')})</small>` : '';
      return `<span class="gchip${parts.length ? ' plus' : ''}" title="${esc(title)}">${SHORT[k]} <b>${v}</b>%${extra}</span>`;
    });
    const total = g.reduce((a, b) => a + Math.max(0, b), 0);
    return `<div class="growth-line">${chips.join('')}<span class="gchip">合計 <b>${total}</b></span></div>`;
  }

  // ───────────────────────── ⓪ 角色 ─────────────────────────
  function renderUnit() {
    const u = unit();
    const p = plan();
    const groups = [];
    const byKey = {};
    for (const x of D.units) {
      const key = x.factionZh || (x.join ? '其他（招募）' : '第2・3部／無加入資料');
      if (!byKey[key]) {
        byKey[key] = [];
        groups.push(key);
      }
      byKey[key].push(x);
    }
    const unitOpts = groups
      .map(
        (g) =>
          `<optgroup label="${esc(g)}">${byKey[g]
            .map(
              (x) =>
                `<option value="${esc(x.id)}"${x.id === u.id ? ' selected' : ''}>${esc(x.zh)}${x.zhTentative ? '（暫譯）' : ''}　${esc(x.jp)}</option>`
            )
            .join('')}</optgroup>`
      )
      .join('');
    const routeOpts = D.routes.map((r) => `<option value="${r.id}"${r.id === state.route ? ' selected' : ''}>${esc(r.zh)}</option>`).join('');
    const gender = genderOf(u, p);
    const genderSel =
      u.gender === '男/女'
        ? `<label class="f"><span>性別</span><select data-bind="gender"><option${gender === '男' ? ' selected' : ''}>男</option><option${
            gender === '女' ? ' selected' : ''
          }>女</option></select></label>`
        : '';
    const recNames = u.rec.map((c, i) => (c ? `${TIER_NAMES[i + 1]}：${clsOf(c) ? clsOf(c).zh : c}` : '')).filter(Boolean);
    const info = [];
    info.push(`<div><span class="muted">個人成長率</span>${growthChips(u, null, null, null)}</div>`);
    const bits = [];
    if (u.factionZh) bits.push(`所屬：${esc(u.factionZh)}`);
    bits.push(`性別：${esc(u.gender || '—')}`);
    if (u.join)
      bits.push(
        `${joinSourceZh(u.join)}預設加入：Lv${u.join.lv} ${esc(clsOf(u.join.classId) ? clsOf(u.join.classId).zh : u.join.classId)}`
      );
    else bits.push('無預設加入資料（請手動輸入起點）');
    if (u.good.length) bits.push(`得意：${esc(u.good.join('・'))}`);
    if (u.weak.length) bits.push(`苦手：${esc(u.weak.join('・'))}`);
    info.push(`<div class="small">${bits.join('　｜　')}</div>`);
    if (recNames.length) info.push(`<div class="small">game8 推薦職業：${esc(recNames.join(' → '))}</div>`);
    const tags = [];
    if (u.noMount) tags.push('<span class="tag warn">無法轉職騎兵／飛行</span>');
    if (u.zhTentative) tags.push('<span class="tag">中文名暫譯</span>');
    if (u.note) tags.push(`<span class="tag">${esc(u.note)}</span>`);
    if (u.overridden) tags.push('<span class="tag warn">成長率已自訂校正</span>');
    if (u.corrected) tags.push(`<span class="tag acc" title="${esc(correctionText('unit', u))}">成長率已依多個來源修正</span>`);
    if (u.url) tags.push(`<a class="small" href="${esc(u.url)}" target="_blank" rel="noopener">game8 角色頁 ↗</a>`);
    el('unit-panel').innerHTML = `
      <div class="unit-top">
        <label class="f"><span>角色</span><select data-bind="unitId">${unitOpts}</select></label>
        ${genderSel}
        <label class="f"><span>所在路線（決定可用坐騎）</span><select data-bind="route">${routeOpts}</select></label>
        <label class="check"><input type="checkbox" data-bind="showAllMounts"${state.showAllMounts ? ' checked' : ''}> 顯示所有坐騎（忽略路線限制）</label>
      </div>
      <div class="unit-info">${info.join('')}${tags.length ? `<div>${tags.join(' ')}</div>` : ''}${
        u.corrected ? notesHtml([['info', correctionText('unit', u)]]) : ''
      }</div>`;
  }
  const joinSourceZh = (j) => (j && j.source && j.source !== 'game8' ? j.source + ' ' : 'game8 ');

  // ───────────────────────── ① 起點 ─────────────────────────
  function startGrowthHtml() {
    const u = unit();
    const p = plan();
    const s = p.start;
    const cls = clsOf(s.classId);
    const m = mountOf(s.mountId);
    const internal = C.toInternal(s.stats.map((v) => int(v)), cls, m);
    const mod = C.displayMod(cls, m);
    return `
      <div class="small muted" style="margin-top:10px">目前職業＋坐騎的每級成長率（參考用；預測時以下方路線各段的職業計算）</div>
      ${growthChips(u, cls, m, null, chariotBonus(cls, s.chariot))}
      <div class="small muted" style="margin-top:6px">職業補正${m && C.mountFits(cls, m) ? '＋坐騎能力加成' : ''}：${esc(fmtBonus(mod))}　→　扣除後的內部值：${internal
        .map((v, k) => SHORT[k] + v)
        .join(' ')}</div>
      ${notesHtml(issuesFor(u, genderOf(u, p), cls, m, s.chariot))}`;
  }
  function renderStart() {
    const u = unit();
    const p = plan();
    const s = p.start;
    const cls = clsOf(s.classId);
    const joinCls = u.join ? clsOf(u.join.classId) : null;
    el('start-panel').innerHTML = `
      <h2>① 起點（目前狀態）<span class="hint">填遊戲內「現在」看到的等級、職業、坐騎與能力值（顯示值，含職業補正與坐騎加成）</span></h2>
      <div class="row">
        <label class="f"><span>等級</span><input type="number" class="lv" min="1" max="99" data-bind="start.lv" value="${esc(s.lv)}"></label>
        <label class="f"><span>職業</span>${classSelect('data-bind="start.classId"', s.classId, u, genderOf(u, p))}</label>
        <label class="f"><span>坐騎（友好 Lv5）</span>${mountSelect('data-bind="start.mountId"', cls, s.mountId)}</label>
        ${chariotSelect('data-bind="start.chariot"', cls, s.chariot)}
        <button class="btn" data-action="apply-join"${u.join ? '' : ' disabled'}>套用${u.join ? ' ' + esc(joinSourceZh(u.join)) : ' '}預設加入資料${
          u.join ? `（Lv${u.join.lv} ${esc(joinCls ? joinCls.zh : '')}）` : ''
        }</button>
      </div>
      <div class="stat-grid" style="margin-top:10px">${STAT_ZH.map(
        (z, k) =>
          `<label class="f"><span>${z}</span><input type="number" min="0" max="199" data-bind="start.stats.${k}" value="${esc(s.stats[k])}"></label>`
      ).join('')}</div>
      <div id="start-growth">${startGrowthHtml()}</div>`;
  }

  // ───────────────────────── ② 路線 ─────────────────────────
  function segFrom(i) {
    const p = plan();
    let prev = int(p.start.lv, 1);
    for (let j = 0; j < i; j++) prev = Math.max(prev, int(p.segments[j].toLv, prev));
    return prev;
  }
  function segGrowthHtml(i) {
    const u = unit();
    const p = plan();
    const sg = p.segments[i];
    if (!sg) return '';
    const cls = clsOf(sg.classId);
    const m = mountOf(sg.mountId);
    const from = segFrom(i);
    const to = int(sg.toLv, NaN);
    const issues = issuesFor(u, genderOf(u, p), cls, m, sg.chariot);
    if (!Number.isFinite(to)) issues.unshift(['err', '請輸入目標等級']);
    else if (to < from) issues.unshift(['err', `目標 Lv${to} 低於前一段的 Lv${from}，此段會被略過`]);
    else if (to > 99) issues.unshift(['warn', '等級上限為 99']);
    const levels = Number.isFinite(to) ? Math.max(0, to - from) : 0;
    return `<div class="small muted" style="margin-top:6px">Lv${from}→${Number.isFinite(to) ? to : '?'}，升級 ${levels} 次，每級成長率：</div>${growthChips(
      u,
      cls,
      m,
      sg.custom,
      chariotBonus(cls, sg.chariot)
    )}${notesHtml(issues)}`;
  }
  function customBox(i) {
    const sg = plan().segments[i];
    return `<div class="custom-box">
      <div class="small muted">自訂成長修正（%）：加在這一段的成長率上，例如坐騎未滿友好 Lv5、道具或其他效果。</div>
      <div class="stat-grid" style="margin-top:6px">${STAT_ZH.map(
        (z, k) =>
          `<label class="f"><span>${z}</span><input type="number" step="5" data-bind="seg.${i}.custom.${k}" value="${esc(sg.custom[k])}"></label>`
      ).join('')}</div>
      <button class="btn small" style="margin-top:6px" data-action="custom-clear" data-i="${i}">清除修正</button>
    </div>`;
  }
  function renderPlan() {
    const u = unit();
    const p = plan();
    const g = genderOf(u, p);
    const segs = p.segments
      .map((sg, i) => {
        const cls = clsOf(sg.classId);
        return `<div class="seg">
        <div class="seg-head">
          <span class="idx">#${i + 1}</span>
          <label class="f"><span>Lv${segFrom(i)} → 到</span><input type="number" class="lv" min="1" max="99" data-bind="seg.${i}.toLv" value="${esc(sg.toLv)}"></label>
          <label class="f grow"><span>這段期間的職業</span>${classSelect(`data-bind="seg.${i}.classId"`, sg.classId, u, g)}</label>
          <label class="f grow"><span>坐騎（友好 Lv5）</span>${mountSelect(`data-bind="seg.${i}.mountId"`, cls, sg.mountId)}</label>
          ${chariotSelect(`data-bind="seg.${i}.chariot"`, cls, sg.chariot)}
          <div class="seg-tools">
            <button class="btn small ghost" data-action="custom" data-i="${i}" title="自訂成長修正">${sg.custom ? '✎ 修正中' : '✎ 修正'}</button>
            <button class="btn small ghost" data-action="up" data-i="${i}"${i ? '' : ' disabled'} aria-label="上移">↑</button>
            <button class="btn small ghost" data-action="down" data-i="${i}"${i < p.segments.length - 1 ? '' : ' disabled'} aria-label="下移">↓</button>
            <button class="btn small ghost" data-action="del" data-i="${i}" aria-label="刪除">✕</button>
          </div>
        </div>
        <div data-growth="${i}">${segGrowthHtml(i)}</div>
        ${sg.custom ? customBox(i) : ''}
      </div>`;
      })
      .join('');
    el('plan-panel').innerHTML = `
      <h2>② 培養路線<span class="hint">每一段＝從上一段的等級升到「到 Lv」，期間使用的職業與坐騎；轉職不會重置等級</span></h2>
      ${segs || '<p class="muted">尚未設定路線。</p>'}
      <div class="row">
        <button class="btn primary" data-action="add">＋ 新增一段</button>
        <button class="btn" data-action="apply-rec-route">套用 game8 推薦路線</button>
        <button class="btn ghost" data-action="clear-plan">清空路線</button>
      </div>`;
  }

  // ───────────────────────── ③ 結果 ─────────────────────────
  function computeProjection() {
    const u = unit();
    const p = plan();
    const start = {
      lv: int(p.start.lv, 1),
      cls: clsOf(p.start.classId),
      mount: mountOf(p.start.mountId),
      displayed: p.start.stats.map((v) => int(v)),
      bonus: chariotBonus(clsOf(p.start.classId), p.start.chariot),
      chariotId: p.start.chariot,
    };
    const segs = p.segments.map((s) => ({
      toLv: int(s.toLv, NaN),
      cls: clsOf(s.classId),
      mount: mountOf(s.mountId),
      custom: s.custom ? s.custom.map((v) => numv(v)) : null,
      bonus: chariotBonus(clsOf(s.classId), s.chariot),
      chariotId: s.chariot,
    }));
    return C.project(u, start, segs);
  }
  function stageLabel(row) {
    const parts = [`<b>Lv${row.lv} ${esc(row.cls ? row.cls.zh : '—')}</b>`];
    if (row.cls && row.cls.chariot && row.seg) parts.push(`<span class="tag mount">${esc(chariotStage(row.seg.chariotId).zh)}</span>`);
    if (row.mount && C.mountFits(row.cls, row.mount))
      parts.push(`<span class="tag mount">${esc(row.mount.zh)}${row.cls.mountMult > 1 ? ' ×' + row.cls.mountMult : ''}</span>`);
    return parts.join(' ');
  }
  function renderResults(res) {
    const [qa, qb, qLabel] = INTERVALS[state.interval] || INTERVALS.q25;
    const head = `<tr><th class="l">階段</th>${STAT_ZH.map((z) => `<th>${z}</th>`).join('')}<th>合計</th></tr>`;
    const startRow = `<tr class="start"><td class="l stage">${stageLabel(res.start)}<span class="small muted">起點（實際值）</span></td>${res.start.expected
      .map((v) => `<td><span class="v">${v}</span></td>`)
      .join('')}<td><span class="v">${res.start.expected.reduce((a, b) => a + b, 0)}</span></td></tr>`;
    const body = res.rows
      .map((row) => {
        const cells = row.expected.map((v, k) => {
          const pmf = row.pmf[k];
          const off = row.base[k] + row.mod[k];
          const lo = C.pmfQuantile(pmf, qa);
          const hi = C.pmfQuantile(pmf, qb);
          const min = C.pmfMin(pmf);
          const max = C.pmfMax(pmf);
          const span = Math.max(1, max - min);
          const l = ((lo - min) / span) * 100;
          const w = Math.max(3, ((hi - lo) / span) * 100);
          const mk = ((row.mean[k] - row.base[k] - min) / span) * 100;
          return `<td title="可能範圍 ${min + off}–${max + off}"><span class="v">${v}</span><span class="r">${lo + off}–${hi + off}</span><span class="bar"><i style="left:${l.toFixed(
            1
          )}%;width:${w.toFixed(1)}%"></i><u style="left:calc(${mk.toFixed(1)}% - 1px)"></u></span></td>`;
        });
        return `<tr><td class="l stage">${stageLabel(row)}<span class="small muted">升級 ${row.levels} 次後的期望值</span></td>${cells.join('')}<td><span class="v">${
          row.total
        }</span></td></tr>`;
      })
      .join('');
    const errs = res.errors.map((e) => ['err', e]);
    el('result-panel').innerHTML = `
      <h2>③ 預測結果<span class="hint">大字＝期望值（與 game8 相同的四捨五入）；小字＝${qLabel} 機率區間；橫條＝可能範圍內的區間與期望位置</span></h2>
      <div class="row" style="margin-bottom:8px">
        <label class="f"><span>區間</span><select data-bind="interval">${Object.entries(INTERVALS)
          .map(([k, v]) => `<option value="${k}"${k === state.interval ? ' selected' : ''}>${v[2]}</option>`)
          .join('')}</select></label>
      </div>
      <div class="table-wrap"><table class="grid"><thead>${head}</thead><tbody>${startRow}${body}</tbody></table></div>
      ${notesHtml(errs)}
      <p class="small muted" style="margin:8px 0 0">合計為期望值加總後再四捨五入，可能與各項相加差 1。能力值上限在 game8 資料中沒有設定，因此這裡不設上限。</p>`;
  }

  // ───────────────────────── ④ 判定 ─────────────────────────
  function judgeActual(res) {
    const p = plan();
    const ri = clamp(int(p.judge.row, 0), 0, Math.max(0, res.rows.length - 1));
    const row = res.rows[ri];
    const actual = p.judge.stats && p.judge.stats.length === N ? p.judge.stats.map((v) => int(v)) : row.expected.slice();
    return { ri, row, actual };
  }
  function bandHtml(j) {
    if (j.over) return '<span class="band na">超出可能範圍</span>';
    if (j.under) return '<span class="band na">低於可能範圍</span>';
    return `<span class="band ${j.band.cls}">${j.band.label}</span>`;
  }
  function renderJudgeOut(res) {
    const box = el('judge-out');
    if (!box || !res.rows.length) return;
    const { row, actual } = judgeActual(res);
    const r = C.judge(row, actual);
    const statRow = r.stats
      .map((j) => `<td>${bandHtml(j)}<span class="r">${j.over || j.under ? '' : '前 ' + pct(j.top)}</span></td>`)
      .join('');
    const diff = actual.map((v, k) => {
      const d = v - row.expected[k];
      return `<td class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d ? signed(d) : '±0'}</td>`;
    });
    const groups = r.groups
      .map((g) => `<div><span>${esc(g.label)}</span><span>${g.over || g.under ? '' : '<span class="small muted">前 ' + pct(g.top) + '</span> '}${bandHtml(g)}</span></div>`)
      .join('');
    const anyOut = r.stats.some((j) => j.over || j.under);
    box.innerHTML = `
      <div class="table-wrap"><table class="grid compact"><thead><tr><th class="l"></th>${STAT_ZH.map((z) => `<th>${z}</th>`).join(
        ''
      )}</tr></thead><tbody>
        <tr><td class="l small">與期望值差</td>${diff.join('')}</tr>
        <tr><td class="l small">判定</td>${statRow}</tr>
      </tbody></table></div>
      <div class="judge-groups">${groups}</div>
      ${
        anyOut
          ? notesHtml([['warn', '有數值超出此路線的可能範圍：可能用了能力提升道具、起點數值或路線（職業/坐騎/等級）與實際不符。']])
          : ''
      }`;
  }
  function renderJudge(res) {
    const p = plan();
    if (!res.rows.length) {
      el('judge-panel').innerHTML = '<h2>④ 成長判定</h2><p class="muted">請先在「② 培養路線」加入至少一段。</p>';
      return;
    }
    const { ri, row, actual } = judgeActual(res);
    const rowOpts = res.rows
      .map((r, i) => `<option value="${i}"${i === ri ? ' selected' : ''}>Lv${r.lv} ${esc(r.cls ? r.cls.zh : '')}</option>`)
      .join('');
    el('judge-panel').innerHTML = `
      <h2>④ 成長判定<span class="hint">照路線練到某個等級後，輸入實際數值，看是「神成長」還是「偏低」（以起點為基準的機率分布）</span></h2>
      <div class="row">
        <label class="f"><span>判定時點</span><select data-bind="judge.row">${rowOpts}</select></label>
        <button class="btn small" data-action="judge-reset">填入期望值</button>
      </div>
      <div class="stat-grid" style="margin-top:10px">${STAT_ZH.map(
        (z, k) =>
          `<label class="f"><span>${z}</span><input type="number" min="0" max="199" data-bind="judge.stats.${k}" value="${esc(actual[k])}"></label>`
      ).join('')}</div>
      <div id="judge-out"></div>
      <p class="small muted" style="margin:8px 0 0">百分位＝結果比你好的機率＋與你相同的機率÷2。前 5% 以內為神成長、前 25% 以內為良成長、前 75% 以內為普通、其餘為偏低（與 game8 相同）。</p>`;
    renderJudgeOut(res);
  }

  // ───────────────────────── ⑤ 推薦 ─────────────────────────
  function recMounts() {
    const r = state.rec;
    if (r.ownedOnly) return D.mounts.filter((m) => r.owned.includes(m.id));
    return D.mounts.filter(mountAvailable);
  }
  function runRecommend() {
    const u = unit();
    const p = plan();
    const r = state.rec;
    return C.recommend(D, {
      unit: u,
      gender: genderOf(u, p),
      startLv: int(p.start.lv, 1),
      startCls: clsOf(p.start.classId),
      targetLv: clamp(int(r.targetLv, 99), 1, 99),
      weights: r.weights.map((v) => numv(v)),
      tierLv: r.tierLv,
      maxTier: int(r.maxTier, 4),
      includeSpecial: !!r.includeSpecial,
      includeDivine: !!r.includeDivine,
      finalClassId: r.finalClassId || '',
      mounts: recMounts(),
      classBonus: (c) => chariotBonus(c, r.chariot),
      topN: 5,
    });
  }
  function renderRecOut() {
    const box = el('rec-out');
    if (!box) return;
    const u = unit();
    const p = plan();
    const r = state.rec;
    const w = r.weights.map((v) => numv(v));
    if (!w.some((v) => v > 0)) {
      box.innerHTML = notesHtml([['warn', '請至少給一項能力大於 0 的權重。']]);
      return;
    }
    const res = runRecommend();
    const start = {
      lv: int(p.start.lv, 1),
      cls: clsOf(p.start.classId),
      mount: mountOf(p.start.mountId),
      displayed: p.start.stats.map((v) => int(v)),
      bonus: chariotBonus(clsOf(p.start.classId), p.start.chariot),
    };
    const finals = res.routes.map((rt) => {
      const proj = C.project(
        u,
        start,
        rt.segments.map((s) => ({ toLv: s.toLv, cls: s.cls, mount: s.mount, bonus: chariotBonus(s.cls, r.chariot) }))
      );
      return proj.rows[proj.rows.length - 1] || proj.start;
    });
    const scoreOf = (last) => last.mean.reduce((a, m, k) => a + (m + last.mod[k]) * w[k], 0);
    const bestW = finals.length ? scoreOf(finals[0]) : 0;
    const cards = res.routes
      .map((rt, idx) => {
        const last = finals[idx];
        const steps = rt.segments
          .map(
            (s) =>
              `<span class="step">Lv${s.fromLv}–${s.toLv} <b>${esc(s.cls.zh)}</b>${
                s.mount ? ` <small>＋${esc(s.mount.zh)}${s.cls.mountMult > 1 ? '×' + s.cls.mountMult : ''}</small>` : ''
              }</span>`
          )
          .join('<span class="arrow">→</span>');
        // 用未四捨五入的期望值計算，排名才會與演算法一致
        const wsum = scoreOf(last);
        return `<div class="route-card">
          <div class="top"><b>#${idx + 1}</b><span class="small muted">加權分數 ${wsum.toFixed(1)}${idx ? `（比 #1 少 ${(bestW - wsum).toFixed(1)}）` : '（最終期望值 × 權重）'}</span>
            <button class="btn small primary" data-action="apply-route" data-i="${idx}">套用到培養路線</button></div>
          <div class="steps">${steps}</div>
          <div class="table-wrap"><table class="grid compact"><thead><tr>${STAT_ZH.map((z) => `<th>${z}</th>`).join('')}<th>合計</th></tr></thead>
          <tbody><tr>${last.expected.map((v) => `<td>${v}</td>`).join('')}<td>${last.total}</td></tr></tbody></table></div>
        </div>`;
      })
      .join('');
    lastRecRoutes = res.routes;
    const rank = r.showAllRank ? res.ranking : res.ranking.slice(0, 15);
    const rankRows = rank
      .map(
        (o) =>
          `<tr><td class="l">${esc(o.cls.zh)} <span class="small muted">${TIER_NAMES[o.cls.tier]}</span></td><td class="l">${
            o.mount ? esc(o.mount.zh) + (o.cls.mountMult > 1 ? ' ×' + o.cls.mountMult : '') : '—'
          }</td>${o.growth.map((v) => `<td>${v}</td>`).join('')}<td><b>${o.per.toFixed(2)}</b></td></tr>`
      )
      .join('');
    const stageInfo = res.stages
      .map((s) => `Lv${s.from}→${s.to}（可用到${TIER_NAMES[Math.min(4, s.tierCap)] || '—'}${s.tierCap === 5 ? '＋神將' : ''}）`)
      .join('、');
    box.innerHTML = `
      <h3>推薦路線（前 ${res.routes.length} 名）</h3>
      <p class="small muted" style="margin-top:0">從起點 Lv${int(p.start.lv, 1)} ${esc(
        clsOf(p.start.classId) ? clsOf(p.start.classId).zh : ''
      )} 出發；階段：${esc(stageInfo)}。每個騎乘職業會自動配上此權重下最好的坐騎。</p>
      ${cards || '<p class="muted">沒有符合條件的路線。</p>'}
      <h3>成長率排行 <span class="small muted">（不看等級門檻；每級期望加權成長）</span></h3>
      <div class="table-wrap"><table class="grid compact"><thead><tr><th class="l">職業</th><th class="l">最佳坐騎</th>${SHORT.map(
        (z) => `<th>${z}</th>`
      ).join('')}<th>加權/級</th></tr></thead><tbody>${rankRows}</tbody></table></div>
      ${
        res.ranking.length > 15
          ? `<button class="btn small" style="margin-top:6px" data-action="rank-toggle">${r.showAllRank ? '只顯示前 15 名' : `顯示全部 ${res.ranking.length} 個`}</button>`
          : ''
      }`;
  }
  let lastRecRoutes = [];
  function renderRec() {
    const u = unit();
    const p = plan();
    const r = state.rec;
    const presetBtns = PRESETS.map(
      (ps) => `<button class="btn small" data-action="preset" data-id="${ps.id}" aria-pressed="${r.preset === ps.id}">${esc(ps.zh)}</button>`
    ).join('');
    const tierInputs = [1, 2, 3, 4, 5]
      .map(
        (t) =>
          `<label class="f"><span>${TIER_NAMES[t]}可轉 Lv</span><input type="number" class="lv" min="1" max="99" data-bind="rec.tierLv.${t}" value="${esc(
            r.tierLv[t]
          )}"></label>`
      )
      .join('');
    const avail = D.mounts.filter(mountAvailable);
    const mountChecks = avail
      .map(
        (m) =>
          `<label class="check"><input type="checkbox" data-bind="rec.owned" value="${esc(m.id)}"${r.owned.includes(m.id) ? ' checked' : ''}> ${esc(
            m.zh
          )} <span class="small muted">${typeZh(m.type)}</span></label>`
      )
      .join('');
    el('rec-panel').innerHTML = `
      <h2>自動推薦<span class="hint">依能力權重，從「① 起點」出發找出期望值最高的轉職＋坐騎路線</span></h2>
      <div class="presets">${presetBtns}</div>
      <div class="stat-grid">${STAT_ZH.map(
        (z, k) =>
          `<label class="f"><span>${z} 權重</span><input type="number" step="0.1" min="0" data-bind="rec.weights.${k}" value="${esc(r.weights[k])}"></label>`
      ).join('')}</div>
      <div class="row" style="margin-top:10px">
        <label class="f"><span>目標等級</span><input type="number" class="lv" min="1" max="99" data-bind="rec.targetLv" value="${esc(r.targetLv)}"></label>
        ${tierInputs}
        <label class="f"><span>最高可用階級</span><select data-bind="rec.maxTier">${[2, 3, 4]
          .map((t) => `<option value="${t}"${int(r.maxTier) === t ? ' selected' : ''}>${TIER_NAMES[t]}</option>`)
          .join('')}</select></label>
        <label class="f"><span>最終職業</span>${classSelect('data-bind="rec.finalClassId"', r.finalClassId, u, genderOf(u, p), {
          emptyLabel: '（自動）',
        })}</label>
      </div>
      <div class="row" style="margin-top:10px">
        <label class="check"><input type="checkbox" data-bind="rec.includeSpecial"${r.includeSpecial ? ' checked' : ''}> 包含特殊解鎖職（神鴕兵、馭龍兵、遊唱詩人、衛士、遊俠、舞者、重裝騎兵、鍛造師、戰象兵等）</label>
        <label class="check"><input type="checkbox" data-bind="rec.includeDivine"${r.includeDivine ? ' checked' : ''}> 包含神將職</label>
        ${chariotSelect('data-bind="rec.chariot"', D.classById['戦車兵'], r.chariot).replace('戰車（戰車兵之道）', '戰車兵的戰車加成')}
      </div>
      <details class="box"${r.ownedOnly ? ' open' : ''}>
        <summary>坐騎：${r.ownedOnly ? `只用勾選的 ${r.owned.length} 隻` : `使用目前路線可取得的全部 ${avail.length} 種`}</summary>
        <label class="check" style="margin-top:6px"><input type="checkbox" data-bind="rec.ownedOnly"${r.ownedOnly ? ' checked' : ''}> 只使用我已擁有（勾選）的坐騎</label>
        <div class="mount-picks">${mountChecks || '<span class="muted small">目前路線沒有可取得的坐騎。</span>'}</div>
      </details>
      <div id="rec-out"></div>
      <p class="small muted">演算法：每個職業（＋最佳坐騎）每升一級的期望加權收益＝Σ 權重 × 成長率；路線依各階可轉職等級切成數段，每段挑收益最高的職業（可沿用目前職業或較低階職業），最後一段再加上最終職業的補正值。沒有考慮證照考試、兵種熟練度、技能等級等限制。</p>`;
    renderRecOut();
  }

  // ───────────────────────── 資料／校正 ─────────────────────────
  const KIND_INFO = {
    units: { zh: '角色', fields: [['growth', '個人成長率']] },
    classes: { zh: '職業', fields: [['growth', '職業成長率'], ['mod', '職業補正（能力值）']] },
    mounts: { zh: '坐騎', fields: [['stat', '能力加成'], ['growth', '成長加成']] },
  };
  function renderData() {
    const kind = KIND_INFO[state.dataKind] ? state.dataKind : 'classes';
    const info = KIND_INFO[kind];
    const list = D[kind];
    const editing = state.editId ? list.find((x) => x.id === state.editId) : null;
    const baseList = BASE[kind];
    const cell = (item, f, k) => {
      const b = baseList.find((x) => x.id === item.id);
      const changed = b && b[f][k] !== item[f][k];
      return `<td class="${changed ? 'changed' : ''}">${item[f][k]}</td>`;
    };
    let head = '';
    let rows = '';
    if (kind === 'units') {
      head = `<tr><th class="l">角色</th><th class="l">日文</th><th>性別</th>${SHORT.map((z) => `<th>${z}</th>`).join('')}<th>合計</th><th class="l">加入</th><th></th></tr>`;
      rows = list
        .map(
          (x) =>
            `<tr><td class="l">${esc(x.zh)}${x.zhTentative ? ' <span class="tag">暫譯</span>' : ''}</td><td class="l small">${esc(x.jp)}</td><td>${esc(
              x.gender
            )}</td>${x.growth.map((_, k) => cell(x, 'growth', k)).join('')}<td>${x.growth.reduce((a, b) => a + b, 0)}</td><td class="l small">${
              x.join ? `Lv${x.join.lv} ${esc(clsOf(x.join.classId) ? clsOf(x.join.classId).zh : '')}` : '—'
            }</td><td><button class="btn small ghost" data-action="edit" data-id="${esc(x.id)}">編輯</button></td></tr>`
        )
        .join('');
    } else if (kind === 'classes') {
      head = `<tr><th class="l">職業</th><th>階級</th>${SHORT.map((z) => `<th>${z}</th>`).join('')}<th class="l">補正</th><th class="l">坐騎</th><th class="l">備註</th><th></th></tr>`;
      rows = TIER_ORDER.flatMap((t) => list.filter((c) => c.tier === t))
        .map((c) => {
          const tags = [];
          if (c.femaleOnly) tags.push('女限');
          if (c.special) tags.push('特殊解鎖');
          if (c.corrected) tags.push('已修正');
          if (c.overridden) tags.push('已校正');
          return `<tr><td class="l">${esc(c.zh)}${c.zhTentative ? ' <span class="tag">暫譯</span>' : ''}<br><span class="small muted">${esc(
            c.jp
          )}</span></td><td>${TIER_NAMES[c.tier]}</td>${c.growth.map((_, k) => cell(c, 'growth', k)).join('')}<td class="l small">${esc(
            fmtBonus(c.mod)
          )}</td><td class="l small">${c.mountType ? typeZh(c.mountType) + (c.mountMult > 1 ? ' ×' + c.mountMult : '') : '—'}</td><td class="l small">${esc(
            tags.join('・')
          )}</td><td><button class="btn small ghost" data-action="edit" data-id="${esc(c.id)}">編輯</button></td></tr>`;
        })
        .join('');
    } else {
      head = `<tr><th class="l">坐騎</th><th class="l">類型</th><th class="l">能力加成</th><th class="l">成長加成</th><th class="l">取得</th><th class="l">誘捕素材／地點</th><th class="l">技能</th><th></th></tr>`;
      rows = list
        .map(
          (m) =>
            `<tr><td class="l">${esc(m.zh)}${m.zhTentative ? ' <span class="tag">暫譯</span>' : ''}${m.verified ? '' : ' <span class="tag warn">未確認</span>'}${m.overridden ? ' <span class="tag warn">已校正</span>' : ''}<br><span class="small muted">${esc(
              m.jp
            )}</span></td><td class="l">${typeZh(m.type)}</td><td class="l small">${esc(fmtBonus(m.stat))}</td><td class="l small">${esc(
              fmtBonus(m.growth)
            )}</td><td class="l small">${esc(AVAIL_ZH[m.avail] || '')}</td><td class="l small">${esc(m.food)}<br>${esc(m.where)}</td><td class="l small skills">${m.skills
              .map(esc)
              .join('<br>')}${m.release ? `<br><span class="muted">放生可得：${esc(m.release)}</span>` : ''}${
              m.note ? `<br><span class="muted">${esc(m.note)}</span>` : ''
            }</td><td><button class="btn small ghost" data-action="edit" data-id="${esc(
              m.id
            )}">編輯</button></td></tr>`
        )
        .join('');
    }
    let editor = '';
    if (editing) {
      editor = `<div class="custom-box" style="margin-bottom:12px">
        <b>編輯：${esc(editing.zh)}</b> <span class="small muted">（只存在你這台裝置的瀏覽器）</span>
        ${info.fields
          .map(
            ([f, label]) => `<div class="small muted" style="margin-top:8px">${label}</div>
          <div class="stat-grid" style="margin-top:4px">${STAT_ZH.map(
            (z, k) => `<label class="f"><span>${z}</span><input type="number" data-edit="${f}.${k}" value="${esc(editing[f][k])}"></label>`
          ).join('')}</div>`
          )
          .join('')}
        <div class="row" style="margin-top:8px">
          <button class="btn primary small" data-action="edit-save">儲存校正</button>
          <button class="btn small" data-action="edit-reset">還原此項為預設</button>
          <button class="btn small ghost" data-action="edit-cancel">取消</button>
        </div></div>`;
    }
    const ovCount = Object.values(state.overrides).reduce((a, m) => a + Object.keys(m).length, 0);
    el('data-panel').innerHTML = `
      <h2>資料／校正<span class="hint">若遊戲內看到的成長率與這裡不同，可直接改成遊戲內的數值（例如職業在各網站間速度/技巧互換的情況）</span></h2>
      <div class="row" style="margin-bottom:10px">
        <label class="f"><span>資料表</span><select data-bind="dataKind">${Object.entries(KIND_INFO)
          .map(([k, v]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${v.zh}</option>`)
          .join('')}</select></label>
        <span class="small muted">已校正 ${ovCount} 項</span>
        <button class="btn small" data-action="ov-export"${ovCount ? '' : ' disabled'}>匯出校正 JSON</button>
        <label class="btn small">匯入校正 JSON<input type="file" accept="application/json,.json" data-action="ov-import" hidden></label>
        <button class="btn small ghost" data-action="ov-clear"${ovCount ? '' : ' disabled'}>清除全部校正</button>
      </div>
      ${editor}
      <div class="table-wrap"><table class="grid compact"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }

  // ───────────────────────── 說明 ─────────────────────────
  function renderHelp() {
    const corr = (D.meta.corrections || [])
      .map(
        (c) =>
          `<li>${c.kind === 'unit' ? '角色' : '職業'} ${esc(c.zh)}（${esc(c.id)}）${esc(statZhOf(c.stat))}成長 ${signed(c.from)} → ${signed(c.to)}：${esc(c.why)}</li>`
      )
      .join('');
    el('help-panel').innerHTML = `
      <h2>怎麼用</h2>
      <ol>
        <li>選角色與所在路線（凱伊篇才能捕獲坐騎）。</li>
        <li>在「① 起點」輸入遊戲內<b>目前</b>的等級、職業、坐騎與能力值。例如凱伊篇招募到的索緋雅是 Lv29 牧師，就填 Lv29、牧師和畫面上的 9 項數值。</li>
        <li>在「② 培養路線」安排之後每一段要用的職業與坐騎，「③ 預測結果」會算出每段結束時的期望值與機率區間。</li>
        <li>練到某個等級後，到「④ 成長判定」輸入實際數值，看看成長得好不好。</li>
        <li>「自動推薦」依你設定的能力權重，找出期望值最高的職業＋坐騎組合，可一鍵套用。</li>
      </ol>
      <h2>為什麼 game8 算的跟遊戲不一樣</h2>
      <ul>
        <li>game8 計算器固定從預設加入狀態（例如索緋雅 Lv8 詛咒師）開始算，把加入等級改成 29 時，會假設 Lv8→29 全程都是詛咒師的成長率；你實際拿到的是牧師，成長率與職業補正都不同。</li>
        <li>職業補正（例如詛咒師 魔+1 魔防+1、牧師 魔+1 魔防+3 運+2 魅+1）只在該職業時生效，換職業就換一組。</li>
        <li>每次升級各項能力是依機率成長，實際值本來就會偏離期望值。這個工具從你的實際數值開始算，就不會累積前面的誤差。</li>
      </ul>
      <h2>計算公式</h2>
      <ul>
        <li>每級成長率 = 個人成長率 + 職業成長率 + 坐騎成長加成 ×（戰車兵 2，其他騎乘職 1）+ 戰車加成（僅戰車兵）+ 自訂修正；低於 0 視為 0。</li>
        <li>每升一級：成長率 100% 以下時以該機率 +1；超過 100% 時先確定 +1，超出部分再以機率 +1。</li>
        <li>顯示值 = 內部值 + 目前職業補正 + 坐騎能力加成；轉職不重置等級、沒有轉職加成。</li>
        <li>期望值的四捨五入方式與 game8 相同（已用索緋雅 Lv8 詛咒師 → Lv99 賢士的路線逐項核對：Lv20 合計 134、Lv35 194、Lv45 241、Lv99 463）。</li>
      </ul>
      <h2>坐騎（騎乘動物）</h2>
      <ul>
        <li>只有凱伊篇（第 1 部第 5 章起）與救世篇能捕獲；其他路線只能用伊歐帶來的羅西南、亞歷山卓帶來的布克發拉斯。</li>
        <li>坐騎的能力與成長加成會隨友好度（Lv1–5）提高。這裡使用友好 <b>Lv5（滿級）</b>的數值；Lv1–4 各級怎麼分配目前沒有公開資料，若你的坐騎還沒滿級，可以用「✎ 修正」手動調整。</li>
        <li><b>成長加成不一定是能力加成 ×5</b>：鴕鳥（飲魯尼魯斯）、飛馬、巴烏系是 ×5；<b>馬系的成長分配不同，而且包含 HP</b>。例如汗血馬的能力加成是力2 技1 防2，成長加成卻是 HP+5 力+5 技+5 防+10。game8 有凱伊（榮光騎士）配野生馬的截圖可以佐證：成長率 HP/速/技/防/魔防 各 +5，能力 速+1 技+3 防+1。</li>
        <li>戰車兵用兩匹馬拉車，坐騎的<b>成長加成 ×2</b>。能力加成是否也 ×2 不確定，這裡以 ×1 計算。</li>
        <li><b>戰車兵之道</b>：戰車本身也有成長加成，會隨升級提高。初始戰車 HP+10 力+5 魔+5 速+5 技+5 防+10 魅+5（社群表寫合計 50、但各項加起來 45，未確認）；多輪升級後 HP+10 力+15 魔+5 速+5 技+10 防+20 魔防+5 運+5 魅+10（合計 85）。後者與馬吉迪的實測逐項吻合：個人＋戰車兵職業＋升級後戰車＋汗血馬×2＝HP95 力80 技65 防90。戰車何時升級未公開，請在每段路線選擇「初始戰車」或「多輪升級後」。</li>
        <li>友好度滿級的坐騎可以放生，換成能力值相同的飾品（例如野生馬 → 駿馬掛飾）；裝備飾品會讓顯示值變高，起點請照畫面上的值填。</li>
        <li>職業與坐騎類型：馬＝輕騎兵、戰車兵、森林騎士、榮光騎士、遊唱詩人、重裝騎兵、奧利哈鐵騎、弓騎士、英勇騎士、瓦爾基里姆、高階墓誌銘、烈駿神將；飛鴕＝飛鴕兵、騎甲鴕兵、神鴕兵；天馬＝天翼兵、聖天翼兵（女性限定）；飛龍＝馭龍兵、飛龍將領；戰象兵沒有可捕獲的象。</li>
        <li>歐露赫露、哥萊亞斯的個人技能讓他們無法轉職為騎兵或飛行兵種。</li>
        <li>社群表中「聖飛馬 3速2魔防」應是野生飛馬的數值；聖飛馬（ファルコン）為 力1 速3 技1。</li>
      </ul>
      <h2>資料修正與不確定的地方</h2>
      <ul>${corr}
        <li>戰車何時從「初始」升到「多輪升級後」、戰象兵之道的數值都未公開。</li>
        <li>紅聖飛馬的數值未確認。神鴕兵、馭龍兵、遊唱詩人、戰象兵、戰鬥將領、探影者、奧利哈鐵騎、德魯伊、賢士等職業在 game8 與 GameWith／簡中 wiki／騰訊文件表之間速度與技巧對調，兩邊都有多個來源，這裡維持 game8.jp 的數值；你可以在「資料／校正」改成遊戲內看到的值。</li>
        <li>紅花、特洛伊亞、安娜的預設加入資料取自騰訊文件社群表（原表不含職業補正，已自動加上）。</li>
        <li>最上級、神將職與少數角色的繁中名稱是由簡中轉換的暫譯。</li>
        <li>能力值上限、等級以外的轉職條件（證照、熟練度、名聲）沒有計入。</li>
      </ul>
      <h2>資料來源</h2>
      <ul>
        <li>角色／職業成長率、補正、加入資料：<a href="https://game8.jp/fe-banshisenko/816448" target="_blank" rel="noopener">game8.jp 育成方針計算ツール</a> 的資料檔</li>
        <li>坐騎、戰車：game8.jp 各動物頁、<a href="https://game8.co/games/Fire-Emblem-Fortunes-Weave" target="_blank" rel="noopener">game8.co</a>、簡中 wiki（fire-emblem-fw.site）、<a href="https://docs.qq.com/sheet/DV0N0VUZLSXRmUWFq" target="_blank" rel="noopener">騰訊文件《火焰之纹章 万紫千红》在线数据表</a></li>
        <li>資料修正的比對來源：game8.co、Serenes Forest、繁中社群 Google 試算表、簡中 wiki、騰訊文件表</li>
        <li>中文名稱：繁中社群整理的 Google 試算表、巴哈姆特／GNN 文章、簡中 wiki</li>
      </ul>
      <h2>本機資料</h2>
      <p>你的設定（每個角色的起點與路線、推薦條件、資料校正）只存在這台裝置的瀏覽器裡。</p>
      <button class="btn" data-action="reset-all">清除所有本機設定</button>`;
  }

  // ───────────────────────── 整體渲染 ─────────────────────────
  function renderTabs() {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    document.querySelectorAll('.tab-page').forEach((pg) => (pg.hidden = pg.dataset.page !== state.tab));
  }
  function renderPlanTab() {
    renderStart();
    renderPlan();
    const res = computeProjection();
    renderResults(res);
    renderJudge(res);
  }
  function renderCurrentTab() {
    if (state.tab === 'plan') renderPlanTab();
    else if (state.tab === 'rec') renderRec();
    else if (state.tab === 'data') renderData();
    else if (state.tab === 'help') renderHelp();
  }
  function renderAll() {
    renderUnit();
    renderTabs();
    renderCurrentTab();
    save();
  }
  // 數字輸入時的輕量更新（不重建正在輸入的欄位）
  function refreshPlanOutputs(opts) {
    opts = opts || {};
    const res = computeProjection();
    renderResults(res);
    if (opts.judgeOnly) renderJudgeOut(res);
    else renderJudge(res);
    const sg = el('start-growth');
    if (sg) sg.innerHTML = startGrowthHtml();
    plan().segments.forEach((_, i) => {
      const x = document.querySelector(`[data-growth="${i}"]`);
      if (x) x.innerHTML = segGrowthHtml(i);
    });
    save();
  }
  const refreshRecOut = debounce(() => {
    renderRecOut();
    save();
  }, 120);

  // ───────────────────────── 事件 ─────────────────────────
  function setPath(obj, parts, value) {
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }
  function fixMount(target) {
    const cls = clsOf(target.classId);
    const m = mountOf(target.mountId);
    if (m && !C.mountFits(cls, m)) target.mountId = '';
  }

  function onBind(t, isChange) {
    const b = t.dataset.bind;
    const parts = b.split('.');
    const p = plan();
    const v = t.type === 'checkbox' ? t.checked : t.value;

    switch (parts[0]) {
      case 'unitId':
        state.unitId = v;
        state.editId = '';
        return renderAll();
      case 'route':
      case 'showAllMounts':
      case 'interval':
        state[parts[0]] = v;
        if (parts[0] === 'interval') {
          renderResults(computeProjection());
          return save();
        }
        return renderAll();
      case 'gender':
        p.gender = v;
        return renderAll();
      case 'dataKind':
        state.dataKind = v;
        state.editId = '';
        renderData();
        return save();
      case 'start': {
        if (parts[1] === 'stats') {
          p.start.stats[int(parts[2])] = v === '' ? '' : int(v);
          if (!isChange) refreshPlanOutputs();
          return;
        }
        if (parts[1] === 'lv') {
          p.start.lv = v === '' ? '' : int(v);
          if (isChange) {
            renderPlan();
            refreshPlanOutputs();
          } else refreshPlanOutputs();
          return;
        }
        if (!isChange) return;
        p.start[parts[1]] = v;
        if (parts[1] === 'classId') fixMount(p.start);
        return renderPlanTab(), save();
      }
      case 'seg': {
        const i = int(parts[1]);
        const sg = p.segments[i];
        if (!sg) return;
        if (parts[2] === 'custom') {
          sg.custom[int(parts[3])] = v === '' ? '' : numv(v);
          if (!isChange) refreshPlanOutputs();
          return;
        }
        if (parts[2] === 'toLv') {
          sg.toLv = v === '' ? '' : int(v);
          if (isChange) {
            renderPlan();
            refreshPlanOutputs();
          } else refreshPlanOutputs();
          return;
        }
        if (!isChange) return;
        sg[parts[2]] = v;
        if (parts[2] === 'classId') fixMount(sg);
        renderPlan();
        return refreshPlanOutputs();
      }
      case 'judge': {
        const res = computeProjection();
        if (parts[1] === 'row') {
          if (!isChange) return;
          p.judge.row = int(v);
          p.judge.stats = null;
          renderJudge(res);
          return save();
        }
        if (parts[1] === 'stats') {
          const { actual } = judgeActual(res);
          p.judge.stats = actual.slice();
          p.judge.stats[int(parts[2])] = int(v);
          renderJudgeOut(res);
          return save();
        }
        return;
      }
      case 'rec': {
        const r = state.rec;
        if (parts[1] === 'weights') {
          r.weights[int(parts[2])] = v === '' ? 0 : numv(v);
          r.preset = '';
          document.querySelectorAll('.presets .btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          return refreshRecOut();
        }
        if (parts[1] === 'tierLv') {
          r.tierLv[parts[2]] = int(v, DEFAULT_TIER_LV[parts[2]]);
          return refreshRecOut();
        }
        if (parts[1] === 'targetLv') {
          r.targetLv = int(v, 99);
          return refreshRecOut();
        }
        if (!isChange) return;
        if (parts[1] === 'owned') {
          const set = new Set(r.owned);
          if (t.checked) set.add(t.value);
          else set.delete(t.value);
          r.owned = [...set];
          if (!r.ownedOnly && t.checked) r.ownedOnly = true;
          renderRec();
          return save();
        }
        if (parts[1] === 'maxTier') r.maxTier = int(v, 4);
        else r[parts[1]] = v;
        renderRec();
        return save();
      }
      default:
        setPath(state, parts, v);
        save();
    }
  }

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.bind && t.tagName === 'INPUT' && t.type === 'number') onBind(t, false);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.bind) onBind(t, true);
    else if (t.dataset && t.dataset.action === 'ov-import' && t.files && t.files[0]) importOverrides(t.files[0]);
  });

  function importOverrides(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const o = JSON.parse(reader.result);
        const next = { units: {}, classes: {}, mounts: {} };
        for (const kind of Object.keys(next)) {
          const map = (o && o[kind]) || {};
          for (const id of Object.keys(map)) {
            const clean = {};
            for (const f of Object.keys(map[id])) if (Array.isArray(map[id][f]) && map[id][f].length === N) clean[f] = map[id][f].map((x) => numv(x));
            if (Object.keys(clean).length) next[kind][id] = clean;
          }
        }
        state.overrides = next;
        buildData();
        renderAll();
      } catch (err) {
        alert('匯入失敗：檔案不是有效的校正 JSON');
      }
    };
    reader.readAsText(file);
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || t.tagName === 'INPUT') return;
    const a = t.dataset.action;
    const p = plan();
    const i = int(t.dataset.i, -1);
    switch (a) {
      case 'tab':
        state.tab = t.dataset.tab;
        renderTabs();
        renderCurrentTab();
        return save();
      case 'apply-join': {
        const u = unit();
        if (!u.join) return;
        p.start = { lv: u.join.lv, classId: u.join.classId, mountId: '', stats: u.join.stats.slice() };
        return renderPlanTab(), save();
      }
      case 'add': {
        const last = p.segments[p.segments.length - 1];
        const from = last ? int(last.toLv, int(p.start.lv, 1)) : int(p.start.lv, 1);
        p.segments.push({
          toLv: Math.min(99, from + 10),
          classId: last ? last.classId : p.start.classId,
          mountId: last ? last.mountId : p.start.mountId,
          custom: null,
          chariot: last ? last.chariot : p.start.chariot,
        });
        return renderPlan(), refreshPlanOutputs();
      }
      case 'apply-rec-route':
        p.segments = recRoute(unit(), { lv: int(p.start.lv, 1), classId: p.start.classId });
        p.judge = { row: 0, stats: null };
        return renderPlan(), refreshPlanOutputs();
      case 'clear-plan':
        p.segments = [];
        return renderPlan(), refreshPlanOutputs();
      case 'del':
        p.segments.splice(i, 1);
        return renderPlan(), refreshPlanOutputs();
      case 'up':
      case 'down': {
        const j = a === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= p.segments.length) return;
        // 只交換職業/坐騎/修正，保留等級順序
        const A = p.segments[i];
        const B = p.segments[j];
        [A.classId, B.classId] = [B.classId, A.classId];
        [A.mountId, B.mountId] = [B.mountId, A.mountId];
        [A.custom, B.custom] = [B.custom, A.custom];
        [A.chariot, B.chariot] = [B.chariot, A.chariot];
        return renderPlan(), refreshPlanOutputs();
      }
      case 'custom': {
        const sg = p.segments[i];
        if (!sg.custom) sg.custom = new Array(N).fill(0);
        return renderPlan(), refreshPlanOutputs();
      }
      case 'custom-clear':
        p.segments[i].custom = null;
        return renderPlan(), refreshPlanOutputs();
      case 'judge-reset':
        p.judge.stats = null;
        renderJudge(computeProjection());
        return save();
      case 'preset': {
        const ps = PRESETS.find((x) => x.id === t.dataset.id);
        if (!ps) return;
        state.rec.preset = ps.id;
        state.rec.weights = ps.w.slice();
        renderRec();
        return save();
      }
      case 'rank-toggle':
        state.rec.showAllRank = !state.rec.showAllRank;
        renderRecOut();
        return save();
      case 'apply-route': {
        const rt = lastRecRoutes[i];
        if (!rt) return;
        p.segments = rt.segments.map((s) => ({
          toLv: s.toLv,
          classId: s.cls.id,
          mountId: s.mount ? s.mount.id : '',
          custom: null,
          chariot: s.cls.chariot ? state.rec.chariot : undefined,
        }));
        p.judge = { row: 0, stats: null };
        state.tab = 'plan';
        renderTabs();
        renderPlanTab();
        save();
        el('plan-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      case 'edit':
        state.editId = t.dataset.id;
        renderData();
        el('data-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      case 'edit-cancel':
        state.editId = '';
        return renderData();
      case 'edit-save': {
        const kind = state.dataKind;
        const o = {};
        document.querySelectorAll('[data-edit]').forEach((inp) => {
          const [f, k] = inp.dataset.edit.split('.');
          if (!o[f]) o[f] = new Array(N).fill(0);
          o[f][int(k)] = numv(inp.value);
        });
        state.overrides[kind][state.editId] = o;
        state.editId = '';
        buildData();
        return renderAll();
      }
      case 'edit-reset':
        delete state.overrides[state.dataKind][state.editId];
        state.editId = '';
        buildData();
        return renderAll();
      case 'ov-export':
        return download('fe-banshisenko-calc-overrides.json', JSON.stringify(state.overrides, null, 2));
      case 'ov-clear':
        if (!confirm('確定清除全部資料校正？')) return;
        state.overrides = { units: {}, classes: {}, mounts: {} };
        buildData();
        return renderAll();
      case 'reset-all':
        if (!confirm('確定清除所有本機設定（所有角色的起點、路線、推薦條件與資料校正）？')) return;
        try {
          localStorage.removeItem(STORE_KEY);
        } catch (err) {
          /* 忽略 */
        }
        location.reload();
        return;
    }
  });

  el('data-meta').textContent = `資料：game8 計算器資料（${BASE.units.length} 名角色、${BASE.classes.length} 個職業）＋ ${BASE.mounts.length} 種坐騎｜產生於 ${BASE.meta.builtAt.slice(
    0,
    10
  )}`;
  renderAll();
})();
