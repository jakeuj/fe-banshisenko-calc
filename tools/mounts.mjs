// 騎乘動物（坐騎）資料 —— game8 計算器沒有這部分，手動整理。
// 數值 = 友好 Lv5（滿級）時的加成。stat = 能力加成（顯示值直接 +），growth = 成長率加成（%）。
// 來源：game8.jp 各動物頁 (817423–817436, 817506–817508)、fire-emblem-fw.site misc.json（簡中 wiki）、
//       game8.jp 凱伊 × 野生馬 截圖（成長 HP/速/技/守/魔防 各 +5、能力 速+1 技+3 守+1）。
// 規則：鴕鳥/天馬/巴烏系 成長 = 能力 ×5；馬系成長分配不同（含 HP）。
// verified:false = 數值未確認（推算），UI 會標示。
// avail：capture = 凱伊篇（第1部5章起）與救世篇可捕獲；capture3 = 僅救世篇（稀有）；
//        io = 伊歐加入時附帶；alexandra = 亞歷山卓加入時附帶。

export const MOUNT_TYPES = {
  horse: { zh: '馬', jp: '馬' },
  ornius: { zh: '飛鴕', jp: '飛駝（オルニウス系）', alias: ['駝鳥', '鴕鳥'] },
  pegasus: { zh: '天馬', jp: '天馬（ペガサス系）', alias: ['飛馬'] },
  bau: { zh: '飛龍', jp: '飛竜（バウ系）', alias: ['巴烏'] },
  elephant: { zh: '象', jp: '象' },
};

// 職業（game8 日文名）→ 可配屬的坐騎類型
export const CLASS_MOUNT_TYPE = {
  '軽騎兵': 'horse', '戦車兵': 'horse', 'フォレストナイト': 'horse', 'バーディンガー': 'horse',
  'トルバドール': 'horse', 'カタフラクト': 'horse', 'オリハルディア': 'horse', 'ボウナイト': 'horse',
  'グレートナイト': 'horse', 'ヴァルキュリウム': 'horse', 'ハイエピタフ': 'horse', 'ザ・キャバリアー': 'horse',
  '飛駝兵': 'ornius', '騎甲駝兵': 'ornius', 'カラドリオス': 'ornius',
  '天翼兵': 'pegasus', '聖天翼兵': 'pegasus',
  'ドラグーン': 'bau', 'ドラゴンマスター': 'bau',
  '戦象兵': 'elephant',
};

// 成長加成倍率（戰車兵用兩匹馬拉車 → 坐騎成長加成 ×2）
export const MOUNT_GROWTH_MULT = { '戦車兵': 2 };

const S = (o) => o;

export const MOUNTS = [
  // ── 馬 ──
  { id: 'wild_horse', jp: '野生の馬', zh: '野生馬', type: 'horse', avail: 'capture',
    stat: S({ spd: 1, dex: 3, def: 1 }), growth: S({ hp: 5, spd: 5, dex: 5, def: 5, res: 5 }),
    food: '甜味蔬菜', where: '向陽嶺、奧雷安斯平原、落日之路、戴莫斯台地',
    skills: ['聯合疾行：【騎兵】移動力+1(2)', '聯合喚起：【騎兵】必殺迴避+5(10)'] },
  { id: 'kanketsu', jp: '汗血馬', zh: '汗血馬', type: 'horse', avail: 'capture',
    stat: S({ str: 2, dex: 1, def: 2 }), growth: S({ hp: 5, str: 5, dex: 5, def: 10 }),
    food: '辣味蔬菜', where: '落日之路（稀有）',
    skills: ['聯合猛戰技：【騎兵】使用戰技攻擊時，攻擊力+2(4)', '聯合戰技集中：【騎兵】使用戰技攻擊時，命中+10(15)'] },
  { id: 'monoceros', jp: 'モノケロース', zh: '莫諾凱洛斯', type: 'horse', avail: 'capture',
    stat: S({ spd: 1, dex: 1, lck: 3 }), growth: S({ hp: 5, spd: 5, dex: 5, res: 10 }),
    food: '珍饈蔬菜', where: '奧雷安斯平原（稀有）',
    skills: ['聯合奇蹟：【騎兵】幸運+3(5)', '聯合治癒：【騎兵】戰鬥後，小(中)幅回復自己的HP'] },
  { id: 'black_horse', jp: '黒馬', zh: '黑馬', type: 'horse', avail: 'capture3',
    stat: S({ str: 1, spd: 3, dex: 1 }), growth: S({ hp: 5, str: 5, spd: 10, dex: 5 }),
    food: '苦味蔬菜', where: '戴莫斯台地（救世篇・稀有）', zhTentative: true,
    skills: ['再移動：【騎兵】戰鬥後，最多可再移動1(2)格'] },
  { id: 'rocinante', jp: 'ロシナン', zh: '羅西南', type: 'horse', avail: 'io', zhTentative: true, verified: false,
    stat: S({ spd: 1, dex: 3, def: 2 }), growth: S({ hp: 5, spd: 5, dex: 5, def: 10, res: 5 }),
    food: '甜味蔬菜', where: '招募伊歐時附帶',
    note: '能力加成取自簡中 wiki；成長加成僅有友好 Lv4 實測 (HP5 速5 技5 守5 魔防5)，Lv5 的守備 +10 為推算。',
    skills: ['聯合疾行：【騎兵】移動力+1(2)'] },
  // ── 飛鴕（オルニウス系）──
  { id: 'wild_ornius', jp: '野生のオルニウス', zh: '野生飲魯尼魯斯', alias: ['野生歐魯尼烏斯'], type: 'ornius', avail: 'capture',
    stat: S({ spd: 2, dex: 3 }), growth: S({ spd: 10, dex: 15 }),
    food: '甜味魚', where: '埃利薩嶺、雀躍之徑、烏拉諾司山、法羅之森',
    skills: ['聯合隱密：【騎兵】戰鬥時，若自己處於有利地形，迴避+10(防禦+3)', '聯合疾行：【騎兵】移動力+1(2)'] },
  { id: 'white_ornius', jp: '白羽のオルニウス', zh: '白羽飲魯尼魯斯', alias: ['白羽歐魯尼烏斯'], type: 'ornius', avail: 'capture',
    stat: S({ spd: 1, dex: 1, res: 3 }), growth: S({ spd: 5, dex: 5, res: 15 }),
    food: '甜味魚', where: '法羅之森（稀有）',
    skills: ['聯合治癒：【騎兵】戰鬥後，小(中)幅回復自己的HP', '聯合淨化：【騎兵】自己的行動階段開始時，50%(100%)解除自己的中毒狀態'] },
  { id: 'meganius', jp: 'メガニウス', zh: '美加尼烏斯', type: 'ornius', avail: 'capture',
    stat: S({ str: 1, dex: 1, def: 3 }), growth: S({ str: 5, dex: 5, def: 15 }),
    food: '辣味魚', where: '亞庫席翁溪谷、烏拉諾司山、雀躍之徑',
    skills: ['聯合巨軀：【騎兵】體格+2(4)', '聯合疾行：【騎兵】移動力+1(2)'] },
  { id: 'red_meganius', jp: '赤羽のメガニウス', zh: '紅羽美加尼烏斯', type: 'ornius', avail: 'capture',
    stat: S({ str: 3, dex: 1, def: 1 }), growth: S({ str: 15, dex: 5, def: 5 }),
    food: '辣味魚', where: '亞庫席翁溪谷（稀有）',
    skills: ['聯合防護：【騎兵】受到必殺的一擊時，受到的傷害減少至70(50)%'] },
  { id: 'maginius', jp: 'マジニウス', zh: '瑪吉尼烏斯', type: 'ornius', avail: 'capture', zhTentative: true,
    stat: S({ mag: 3, dex: 2 }), growth: S({ mag: 15, dex: 10 }),
    food: '苦味魚', where: '獵首岩、沙漠入口、塔爾伯斯平原',
    skills: ['聯合魔法集中：【騎兵】裝備魔法時，命中+10(15)', '聯合疾行：【騎兵】移動力+1(2)'] },
  { id: 'black_maginius', jp: '黒羽のマジニウス', zh: '黑羽瑪吉尼烏斯', alias: ['黑羽美加尼烏斯'], type: 'ornius', avail: 'capture',
    stat: S({ mag: 2, spd: 2, dex: 1 }), growth: S({ mag: 10, spd: 10, dex: 5 }),
    food: '苦味魚', where: '獵首岩（稀有）',
    skills: ['聯合魔法尖銳：【騎兵】裝備魔法時，必殺+5(10)', '再移動：【騎兵】戰鬥後，最多可再移動1(2)格'] },
  // ── 天馬（ペガサス系）──
  { id: 'wild_pegasus', jp: '野生のペガサス', zh: '野生飛馬', alias: ['野生天馬'], type: 'pegasus', avail: 'capture',
    stat: S({ spd: 3, res: 2 }), growth: S({ spd: 15, res: 10 }),
    food: '甜味蔬菜', where: '天馬岩、巨鳥之頸、黑翼之谷',
    skills: ['聯合對魔：【飛行】戰鬥時，若敵人裝備魔法，攻擊力+3(5)', '聯合飛翔：【飛行】移動力+1(2)'] },
  { id: 'dark_pegasus', jp: 'ダークペガサス', zh: '暗飛馬', alias: ['暗天馬'], type: 'pegasus', avail: 'capture',
    stat: S({ mag: 3, spd: 2 }), growth: S({ mag: 15, spd: 10 }),
    food: '苦味蔬菜', where: '黑翼之谷（稀有）',
    skills: ['聯合飛翔：【飛行】移動力+1(2)'] },
  { id: 'falcon', jp: 'ファルコン', zh: '聖飛馬', alias: ['聖天馬'], type: 'pegasus', avail: 'capture',
    stat: S({ str: 1, spd: 3, dex: 1 }), growth: S({ str: 5, spd: 15, dex: 5 }),
    food: '珍饈蔬菜', where: '狂風海岸；巨鳥之頸、天馬岩（稀有）',
    note: '部分社群表寫成「3速2魔防」，那是野生飛馬的數值；game8.jp 與簡中 wiki 皆為 力1 速3 技1。',
    skills: ['飛行再移動：【飛行】戰鬥後，最多可再移動1(2)格'] },
  { id: 'bucephalus', jp: 'ブーケパラス', zh: '布克發拉斯', type: 'pegasus', avail: 'alexandra',
    stat: S({ str: 1, spd: 3, res: 2 }), growth: S({ str: 5, spd: 15, res: 10 }),
    food: '甜味蔬菜', where: '招募亞歷山卓時附帶',
    skills: ['聯合飛翔：【飛行】移動力+1(2)'] },
  { id: 'red_falcon', jp: 'レッドファルコン', zh: '紅聖飛馬', type: 'pegasus', avail: 'capture3', zhTentative: true, verified: false,
    stat: S({ str: 2, spd: 2, dex: 1 }), growth: S({ str: 10, spd: 10, dex: 5 }),
    food: '辣味蔬菜', where: '狂風海岸（救世篇・稀有）',
    note: '能力加成未確認；成長加成依天馬系 ×5 規則推算。',
    skills: ['聯合飛翔：【飛行】移動力+1(2)'] },
  // ── 飛龍（バウ系）──
  { id: 'wild_bau', jp: '野生のバウ', zh: '野生巴烏', type: 'bau', avail: 'capture', zhTentative: true,
    stat: S({ str: 2, spd: 1, dex: 2 }), growth: S({ str: 10, spd: 5, dex: 10 }),
    food: '甜味肉', where: '龍哮海岬、亞席羅堡壘、戰士之路、西德姆之谷',
    skills: ['聯合猛戰技：【飛行】使用戰技攻擊時，攻擊力+2(4)', '聯合飛翔：【飛行】移動力+1(2)'] },
  { id: 'red_bau', jp: 'レッドバウ', zh: '紅巴烏', type: 'bau', avail: 'capture3', zhTentative: true,
    stat: S({ str: 3, dex: 2 }), growth: S({ str: 15, dex: 10 }),
    food: '辣味肉', where: '亞席羅堡壘（救世篇・稀有）',
    skills: ['聯合戰技集中：【飛行】使用戰技攻擊時，命中+10(15)', '聯合飛翔：【飛行】移動力+1(2)'] },
  { id: 'black_bau', jp: 'ブラックバウ', zh: '黑巴烏', type: 'bau', avail: 'capture3', zhTentative: true,
    stat: S({ str: 2, spd: 3 }), growth: S({ str: 10, spd: 15 }),
    food: '苦味肉', where: '戰士之路、西德姆之谷（救世篇・稀有）',
    skills: ['聯合強韌：【飛行】受到有效攻擊時，傷害減少至70(50)%'] },
];

// 路線 → 可取得的坐騎來源
export const ROUTES = [
  { id: 'kai', zh: '凱伊篇（利貝拉之風）', avail: ['capture', 'io', 'alexandra'] },
  { id: 'dietrich', zh: '迪托利希篇', avail: ['io', 'alexandra'] },
  { id: 'theodora', zh: '賽奧朵拉篇', avail: ['io', 'alexandra'] },
  { id: 'leda', zh: '蕾達篇', avail: ['io', 'alexandra'] },
  { id: 'savior', zh: '救世篇（第3部，需凱伊篇解鎖馬廄）', avail: ['capture', 'capture3', 'io', 'alexandra'] },
];
