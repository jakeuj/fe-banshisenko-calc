# 資料來源

## game8.jp（日文，本專案基準）

- 計算器資料 JSON：https://assets.game8.jp/tools/script_template/fe_banshisenko_ikusei_sim.json
  - 內嵌計算器的頁面：https://game8.jp/fe-banshisenko/816448（索緋雅頁）、816377（キャラ一覧・成長率）
- 兵種一覧 816408、クラスチェンジ 816464、最上級職一覧 816721、神将職一覧 816952
- 捕獲・飼育（坐騎系統）816904；各動物頁 817423–817436、817506–817508
- 戦車兵 816658、戦象兵 816718、育成要素まとめ 816791、因果融合 817191、スカウト条件 816618
- 各角色/職業頁的網址在 JSON 每列的 `url` 欄
- 網址格式：`https://game8.jp/fe-banshisenko/<id>`

## game8.co（英文）

- 首頁：https://game8.co/games/Fire-Emblem-Fortunes-Weave
- 成長率 archives/618974、坐騎 624329、職業一覽 620256、角色一覽 619779、轉職 618925、因果融合 626047、戰車兵 624047
- 網址格式：`https://game8.co/games/Fire-Emblem-Fortunes-Weave/archives/<id>`

## 簡中 wiki：fire-emblem-fw.site

原始 JSON，可直接 curl：

- `https://fire-emblem-fw.site/data/characters.json`：角色名（簡中）、成長率、陣營 `faction`、初始職業/等級/能力、`tentative` 暫定名旗標
- `https://fire-emblem-fw.site/data/classes.json`：職業名（簡中）、階級、成長率、`baseStats`（職業補正）
- `https://fire-emblem-fw.site/data/misc.json`：`mounts`（坐騎名、能力 `bonus`、成長 `growth`、食物、地點、技能）

簡中轉繁時注意用字（飛鴕、天馬/飛馬、巴烏），轉出來的名稱在 `names-zh.mjs` 標 `t: true`。

## 繁中社群 Google 試算表

- ID：`11muXOag_ZV67Rgg87Q2LyLvQ3FryG62FbCMorpxZbtE`
- 以分頁名稱取 CSV：`https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&sheet=<分頁名>`
- 已知 gid：952042760（角色中文總覽）；`/export?format=csv&gid=<gid>` 也可用（會 307 轉址）
- 有用的分頁：
  - 角色招募表：英文名 → 繁中名（57 人）、四條路線加入條件
  - 角色中文總覽 / 角色基本成長率：繁中名與成長率（部分數值與 game8 不同）
  - 兵種技能表：初級、中級職業的繁中名、轉職條件、兵種技能（上級以上中文名空白）
  - 一轉～四轉職業成長率：職業成長率（職業名為英文）
- 沒有：日文名、加入等級、坐騎表、能力上限

## 其他

- GameWith（日文）：https://gamewith.jp/fefw/ 坐騎 577527、職業 573025、角色 573109、戰車兵 577357。常見速/技對調，單獨使用要小心。
- AppMedia 成長率：https://appmedia.jp/fe_banshisenkou/80407168
- Serenes Forest 成長率：https://serenesforest.net/fortunes-weave/characters/growth-rates/
- PegasusKnight wiki（日文，含玩家留言實測）：https://www.pegasusknight.com/wiki/fe18/
- Fextralife（英文，職業能力補正）：https://fortunesweave.wiki.fextralife.com/
- 巴哈姆特討論（繁中職業/坐騎名的出處之一）：https://forum.gamer.com.tw/C.php?bsn=553&snA=6487
- GNN 新聞（繁中職業名）：https://gnn.gamer.com.tw/detail.php?sn=309776
- 玩家實測匯整：fireembs.blog.jp/archives/40851540.html（戰車兵×2）、game9820.com/fe-9222039/（坐騎成長加成）

無法存取（HTTP 403）：Serenes Forest 論壇、GameFAQs、altema.jp、h1g.jp、hyperts.net。

## 搜尋關鍵字

- 繁中正式標題是「聖火降魔錄 萬縷千絲」，玩家常叫「萬紫千紅」；兩個都要搜。
- 日文：ファイアーエムブレム 万紫千紅、FE万紫千紅、騎乗動物、友好レベル、戦車兵の道
- 英文：Fire Emblem Fortune's Weave, mount, bond level, Charioteer
