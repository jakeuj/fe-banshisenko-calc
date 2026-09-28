---
name: fe-data-update
description: 更新《萬紫千紅》培養計算器的遊戲資料（data.js）。當使用者說 game8 資料更新了、要重抓資料、新增角色/職業/坐騎、補中文名稱、修正某個成長率或補正值、build-data 出現警告、或任何會動到 tools/build-data.mjs、tools/names-zh.mjs、tools/mounts.mjs、data.js 的需求時，都要使用這個技能——即使使用者只說「幫我更新一下資料」或「某角色數值不對」。
---

# 更新遊戲資料（data.js）

`data.js` 是產生檔，**不要手改**。它由 `tools/build-data.mjs` 合成三個來源：

| 來源 | 內容 | 檔案 |
|---|---|---|
| game8.jp 計算器 JSON | 角色成長率、職業成長率與補正值、加入 Lv/職業/初始值、推薦職業 | 下載到 `tools/raw/game8.json`（已 gitignore） |
| 手工對照表 | 日文 → 繁中名稱、陣營名、階級、技能名 | `tools/names-zh.mjs` |
| 手工坐騎表 | 坐騎能力/成長加成、職業↔坐騎類型、路線可取得性 | `tools/mounts.mjs` |

資料修正（game8 與遊戲不符時）寫在 `tools/build-data.mjs` 的 `CORRECTIONS` 陣列，每筆都要附 `why`（證據來源），頁面「說明」與職業提示會直接顯示它。

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

只有在有**比 game8 更強的證據**時才修正 game8 的數值：遊戲截圖、或多個獨立來源一致而 game8 單獨不同。只有一個來源不同時，不要改預設值——使用者可以在頁面「資料／校正」自行覆寫。新增修正後 `node tools/test-calc.mjs` 可能需要同步更新依賴該職業的測試。

## 欄位對照

game8 JSON 的表格 ID 與 `col_N` 意義、以及欄位是否被 game8 改動過的錨點檢查，見 `references/game8-columns.md`。改 `build-data.mjs` 的欄位讀取前一定要先看。
