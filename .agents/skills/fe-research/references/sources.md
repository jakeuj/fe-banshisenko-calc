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
- 成長率頁是靜態 HTML 表格（第一欄 `Unit` / `Class`，欄序 HP Str Mag Spd Dex Def Res Lck Cha），`node tools/check-sources.mjs` 會直接解析並與 `data.js` 比對；最後更新時間在 HTML 的 `dateModified`。它的穆是未加「成長之兆」+20 的原始值。
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

## 騰訊文件《火焰之纹章 万紫千红》在线数据表（簡中社群）

- 網址：https://docs.qq.com/sheet/DV0N0VUZLSXRmUWFq ，分頁以 `?tab=<id>` 指定
- 有用的分頁：
  - `bxlbpf`「12-【凯篇】骑乘、指导信息表」：坐騎能力/成長（滿級）、誘捕素材、喜好蔬菜、地點、技能、放生飾品；**戰車（初始）與戰車（多輪升級）的成長加成**；凱伊篇名聲指導（神鴕兵、馭龍兵、遊唱詩人的解鎖）。使用者傳來的深色底、浮水印「江雪之舞和小团体自制 禁止转载」的坐騎截圖就是這一頁，數值已整合，比對即可（見 `fe-research` 的「使用者提供的截圖／表格」）。
  - `sd3o0k`「01-全可加入角色信息」：角色（簡中名）、初始兵種、個人成長率、加入 Lv 與能力值（**不含職業補正**）
  - `lnafol`「02-兵种职业信息」：職業成長率修正、兵種基礎能力（補正）
  - `f3zvkv`「计算公式相关信息」：戰鬥公式、地形；沒有成長或能力上限
  - `467ohl`「马乱数表」：捕獲亂數，與成長無關
- 取得方式：**用 `.agents/skills/fe-research/scripts/qq-sheet.mjs`**（`tabs` / `compare` / `dump <分頁id> <檔名>`），不用自己再解。細節（腳本檔頭也有）：
  - 頁面是 canvas 繪製，`get_page_text` 讀不到儲存格。資料來自 `https://docs.qq.com/dop-api/opendoc?id=DV0N0VUZLSXRmUWFq&tab=<id>&outformat=1&normal=1`。
  - **要先抓一次頁面拿 cookie**（`TOK`、`hashkey`），再帶 cookie 與 `Referer` 呼叫 API；不帶 cookie 前幾次可能成功，之後一律 401。
  - 儲存格在 `clientVars.collab_client_vars.initialAttributedText.text[0].related_sheet`（有時在 `block_datas[].related_sheet`）：base64 → zlib → protobuf。值池依種類分開編號（字串、富文字、數字）；數字儲存格的索引 ≤128 就是數值本身，≥129 要查數字池（負數與較大的數都在那裡）；儲存格帶有列、欄索引。
- 文件擁有者設定了「禁止檢視者複製」、坐騎截圖有「禁止转载」浮水印：只用來比對個別數值、註明出處，不要整表搬進專案；`dump` 的輸出放 scratchpad。
- 與簡中 wiki 很可能同源（兩者的速/技對調幾乎一致），不算完全獨立；但也有不同處（重裝步兵防、衛士運等）。

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
