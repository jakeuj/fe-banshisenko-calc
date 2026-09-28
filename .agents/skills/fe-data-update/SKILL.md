---
name: fe-data-update
description: 更新《萬紫千紅》培養計算器的遊戲資料（data.js）。當使用者說 game8 資料更新了、要重抓資料、「看看有沒有資料需要更新」、新增角色/職業/坐騎、補中文名稱、修正某個成長率或補正值、回報遊戲內看到的成長值、build-data 出現警告、或任何會動到 tools/build-data.mjs、tools/names-zh.mjs、tools/mounts.mjs、data.js 的需求時，都要使用這個技能——即使使用者只說「幫我更新一下資料」或「某角色數值不對」。
---

# 更新遊戲資料（data.js）

`data.js` 是產生檔，**不要手改**。它由 `tools/build-data.mjs` 合成三個來源：

| 來源 | 內容 | 檔案 |
|---|---|---|
| game8.jp 計算器 JSON | 角色成長率、職業成長率與補正值、加入 Lv/職業/初始值、推薦職業 | 下載到 `tools/raw/game8.json`（已 gitignore） |
| 手工對照表 | 日文 → 繁中名稱、陣營名、階級、技能名 | `tools/names-zh.mjs` |
| 手工坐騎表 | 坐騎能力/成長加成、職業↔坐騎類型、路線可取得性 | `tools/mounts.mjs` |

資料修正（game8 與遊戲不符時）寫在 `tools/build-data.mjs` 的 `CORRECTIONS` 陣列：職業用 `{ cls: '日文名', … }`、角色用 `{ unit: '日文名', … }`，每筆都要附 `why`（證據來源），頁面「說明」、職業提示與角色面板會直接顯示它。

game8 沒有加入資料的角色，可在 `build-data.mjs` 的 `EXTRA_JOIN` 補上（`base` 為**不含職業補正**的能力值，產生時自動加上該職業補正；`source` 會顯示在「套用預設加入資料」按鈕上）。game8 之後若補了資料，build 會警告，屆時把該筆刪掉。

## 先檢查有沒有東西要更新

使用者問「看看有沒有資料需要更新」、或給了新的參考網址／截圖時，先跑唯讀檢查，不要直接 `--refresh`：

```bash
node tools/check-sources.mjs
```

- **game8.jp**：線上 JSON 與 `tools/raw/game8.json` 快取逐格比對。「完全相同」就不用重抓；有變動才走下面的標準流程。
- **game8.co 成長率頁**（archives/618974）：角色與職業成長率和目前 `data.js` 比對，會標出「已由 CORRECTIONS 修正」與「全部差同一個數（個人技能加成，如穆 +20）」。其餘差異逐一對照 `fe-research/references/conflicts.md`；**已記錄的就是已知衝突，不要重改**，沒記錄過的才交給 `fe-research` 研究。
- 出現「對不到日文名」時，在 `names-zh.mjs` 的 `EN_UNIT` / `EN_CLASS` 補上英文名 → 日文名。
- 需要時再比對騰訊文件社群表：`node .agents/skills/fe-research/scripts/qq-sheet.mjs compare`（角色成長、職業成長與補正、坐騎、戰車）。它和簡中 wiki 大致同源，結果同樣先對照 `conflicts.md`；請求會被限流，不要短時間內重跑很多次。對不到名稱時補 `names-zh.mjs` 的 `CN_UNIT` / `CN_CLASS` / `CN_MOUNT`。
- 使用者給的圖片或表格：先依 `fe-research` 的「使用者提供的截圖／表格」判斷來源，和 `mounts.mjs`、`conflicts.md` 逐項比對，只補真正缺的欄位。

檢查完在 `conflicts.md` 更新「最近一次比對」那一行（日期、比對了哪些來源、結果）。

## 標準流程

1. 重新下載並產生：
   ```bash
   node tools/build-data.mjs --refresh
   ```
   不加 `--refresh` 會使用快取，適合只改了對照表或坐騎表時。
2. 讀輸出的四段資訊並逐一處理：
   - **筆數**：角色 / 有加入資料的角色 / 職業 / 坐騎。數量突然變少通常代表 game8 改了欄位，先看 `references/game8-columns.md` 的錨點檢查。
   - **套用修正**：若某筆顯示 `x→x`（from 等於 to），代表 game8 已自行修正，把那筆從 `CORRECTIONS` 移除。
   - **暫譯名稱**：只是提醒，找到正式繁中名時再改。
   - **警告**：每一條都要處理（對照下表）。
3. 跑測試：
   ```bash
   node tools/test-calc.mjs
   ```
4. 用本機預覽確認頁面（`node tools/serve.mjs` → http://localhost:8765/），看新角色/職業在下拉選單裡、名稱與提示正確、console 無錯誤。
5. 需要發布時改用 `fe-deploy-pages` 技能。

## 警告對照

| 警告 | 處理 |
|---|---|
| 角色缺中文名：X | 在 `UNIT_ZH` 加 `'X': { zh: '…' }`；只有簡中來源時加 `t: true` |
| 職業缺中文名：X | 在 `CLASS_ZH` 加；上級以上且只見於簡中來源時加 `t: true`，在繁中文章見過則 `seen: true` |
| 未知階級 | game8 新增了階級字串，在 `TIER_ZH` 加上並給 `rank` |
| 騎乘職業未指定坐騎類型：X | 在 `mounts.mjs` 的 `CLASS_MOUNT_TYPE` 加上 `'X': 'horse' / 'ornius' / 'pegasus' / 'bau' / 'elephant'`；若是戰車類（坐騎成長加成倍數不是 1）再加進 `MOUNT_GROWTH_MULT` |
| 坐騎對照表的職業不存在：X | game8 改了職業日文名，同步修改 `CLASS_MOUNT_TYPE` / `MOUNT_GROWTH_MULT` / `CORRECTIONS` / `CLASS_ZH` 的鍵 |
| 推薦職業不存在 / 加入職業不存在 | 同上，通常是職業改名 |

名稱與坐騎資料要去哪裡查，見 `fe-research` 技能。

### 不會出警告、要自己檢查的項目

`build-data.mjs` 不會對陣營名與得意/苦手技能名發出警告（缺了只會顯示日文，或把角色歸到「其他（招募）」）。重抓資料後跑一次：

```bash
node --input-type=module -e "import { FACTION_ZH, SKILL_ZH } from './tools/names-zh.mjs'; import { readFileSync } from 'node:fs'; const j = JSON.parse(readFileSync('tools/raw/game8.json', 'utf8')); const rows = j.find((t) => t.id === 23026).db_data.filter((r) => r.col_20); console.log('缺陣營中文：', [...new Set(rows.map((r) => r.col_2).filter((f) => f && !FACTION_ZH[f]))].join('、') || '無'); console.log('缺技能中文：', [...new Set(rows.flatMap((r) => [r.col_12, r.col_14]).filter(Boolean).flatMap((s) => s.split(':')).filter((s) => s && !SKILL_ZH[s]))].join('、') || '無');"
```

## 寫死在程式裡、要一起維護的地方

資料變動時，下面這些不會自動跟著變：

| 位置 | 內容 | 什麼時候要改 |
|---|---|---|
| `build-data.mjs` 的 `noMount` | 不能轉騎乘/飛行的角色（オルヘル、ゴライアス）| 新角色的個人技能寫著「騎兵や飛行の兵種になれない」之類的限制時 |
| `build-data.mjs` 的 `special` 判定 | 上級職裡額外算「特殊解鎖」的 `踊り子`、`鍛冶師`、`戦象兵` | game8 新增有特殊解鎖條件、但解鎖欄位是空的職業時 |
| `build-data.mjs` 的性別 | 救世主（`性別` 欄空白）特判為「男/女」| 新增可選性別的角色時 |
| `mounts.mjs` 的 `CHARIOT_CLASSES` / `CHARIOT_STAGES` | 有戰車加成的職業（戦車兵）與各階段成長加成 | 找到戰車升級時機、初始戰車確切數值，或戰象兵之道的資料時 |
| `app.js` 的 `AVAIL_ZH` | 坐騎取得方式的中文說明 | `mounts.mjs` 新增 `avail` 類型時（同時要在 `ROUTES` 設定哪些路線可取得）|
| `app.js` 的 `issuesFor()` | 戰車兵、戰象兵的提示文字 | 新增有坐騎倍率或特殊成長規則的職業時 |
| `app.js` 推薦面板 | 「包含特殊解鎖職（…）」的職業清單文字 | 特殊解鎖職有增減時 |
| `app.js` 的 `renderHelp()` | 說明頁的職業↔坐騎清單、坐騎規則、資料來源 | `CLASS_MOUNT_TYPE`、坐騎規則或來源改變時 |
| `tools/test-calc.mjs`「資料筆數」 | 寫死職業 60、坐騎 19 | game8 增減職業、或 `mounts.mjs` 增減坐騎時 |
| `names-zh.mjs` 的 `EN_UNIT` / `EN_CLASS` | 英文名 → 日文名（`check-sources.mjs` 比對 game8.co 用）| game8 新增角色／職業時；`check-sources.mjs` 會列出對不到的英文名 |
| `names-zh.mjs` 的 `CN_UNIT` / `CN_CLASS` / `CN_MOUNT` | 簡中名 → 日文名／坐騎 id（`qq-sheet.mjs` 比對騰訊文件表用，簡中 wiki 同名）| 新增角色／職業／坐騎時；`qq-sheet.mjs` 會列出對不到的簡中名 |
| `qq-sheet.mjs` 的 `GUESTS` | 騰訊文件表有、但 data.js 沒有的客串角色（索雷爾、歐若拉）| 表上新增其他客串角色時 |

### 日文名就是 id

角色、職業的 id 直接用 game8 的日文名（`title`），使用者瀏覽器裡存的路線（`state.plans`）與資料校正（`state.overrides`）都靠它對應。game8 如果改了某個職業/角色的日文名：

- 使用者已存的路線裡那一段會找不到職業，成長率只剩個人值（頁面不會壞，但數字會錯）。
- 要同步改 `names-zh.mjs`、`mounts.mjs`、`CORRECTIONS` 的鍵；並考慮在 `app.js` 載入狀態時把舊名換成新名（見 `fe-growth-engine` 的「狀態結構變更」）。

## 名稱規則（為什麼這樣定）

- 角色名優先採用繁中社群試算表「角色招募表」（它是玩家對照繁中版遊戲整理的），其次是巴哈姆特/GNN 繁中文章，最後才是簡中 wiki 轉繁體（標 `t: true`，頁面會顯示「暫譯」）。
- 已知陷阱：試算表把「盛托利翁」標成 Bertrand，實際是セントリオン；貝特蘭才是ベルトラン。
- 職業名的「駝」一律用「鴕」（飛鴕兵、騎甲鴕兵、神鴕兵），舊寫法放進 `alias`，讓使用者搜尋舊名也能找到。
- 坐騎名優先採用使用者提供的繁中社群表（例如「飲魯尼魯斯」「飛馬」），其他寫法放 `alias`。

## 坐騎表規則

`tools/mounts.mjs` 的每一筆：

- `stat` / `growth` 都是**友好 Lv5（滿級）**的數值，鍵為 `hp str mag spd dex def res lck cha`。Lv1–4 的分配沒有公開資料，不要自行內插。
- **不要假設成長加成 = 能力加成 ×5**。鴕鳥/天馬/巴烏系是 ×5，但馬系的成長分配不同且含 HP（例：汗血馬 能力 力2 技1 防2、成長 HP5 力5 技5 防10）。只有在找不到成長值時才用 ×5 推算，並設 `verified: false` 與說明推算方式的 `note`。
- `avail`：`capture`（凱伊篇＋救世篇）、`capture3`（僅救世篇）、`io`、`alexandra`。路線可取得哪些由 `ROUTES` 決定。
- 戰車兵的「成長加成 ×2」由 `MOUNT_GROWTH_MULT` 控制；能力加成仍是 ×1（未確認，見 `fe-growth-engine`）。

## 什麼時候加 CORRECTIONS

只有在有**比 game8 更強的證據**時才修正 game8 的數值：

1. **遊戲內截圖／實測**（含使用者回報遊戲畫面上的成長值）：最強，就算 game8.jp 與 game8.co 一致也照實測改。例：哪吒當劍客（職業力 +0）時力量成長顯示 45 → 個人力 = 45，推翻 game8 的 55。換算方法見 `fe-research` 的「使用者回報遊戲內數值時」。
2. 沒有實測時，game8.jp 是**唯一**不同的來源（連 game8.co 都與它不同，而其他多個來源一致）。
3. game8.jp 與 game8.co 相同、另一邊也有多個來源時，兩邊都有證據，維持 game8.jp 並記在 `fe-research/references/conflicts.md`。只有一個來源不同時，不要改預設值——使用者可以在頁面「資料／校正」自行覆寫。

`why` 的寫法：有實測時以「遊戲內實測：…」開頭，寫出角色、職業、看到的數字與換算，再列其他一致的來源；頁面會原文顯示給使用者。已經有 CORRECTIONS、後來才拿到實測時，只改 `why` 並在 `conflicts.md` 補上證據。新增修正後 `node tools/test-calc.mjs` 的「資料修正」測試要一起更新。

### 實測與資料一致時

不加 CORRECTIONS，但證據要留下來，否則下次比對腳本列出差異時又要重查：

1. `fe-research/references/conflicts.md` 的「遊戲內已確認與 game8 一致」表加一列（角色／職業、值、日期與畫面欄位、其他來源的錯誤）。原本沒有爭議的項目也要記。
2. 實測剛好驗證到某筆既有 CORRECTIONS（例：皮特魯的戰車兵「兵種」欄技 +15 → `戦車兵` dex 修正）時，把 `why` 改成「遊戲內實測：…」開頭。
3. 在 `tools/test-calc.mjs` 加一個用畫面數字寫成的實例測試（參考「皮特魯 Lv26 + 戰車兵 + 汗血馬」「凱伊 + 榮光騎士 + 野生馬」），之後改資料或公式時會自動擋下回歸。
4. `node tools/build-data.mjs`（不用 `--refresh`）重新產生，確認 `git diff data.js` 只動到 `why` 文字，再跑 `node tools/test-calc.mjs`。只改說明文字時不用開本機預覽。

技能檔的實體在 `.agents/skills/`（`.claude/skills` 是指向它的連結），改技能時直接改 `.agents/skills/` 下的檔案。

## 欄位對照

game8 JSON 的表格 ID 與 `col_N` 意義、以及欄位是否被 game8 改動過的錨點檢查，見 `references/game8-columns.md`。改 `build-data.mjs` 的欄位讀取前一定要先看。
