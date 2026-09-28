---
name: fe-growth-engine
description: 《萬紫千紅》培養計算器的計算公式與程式架構（calc.js、app.js）。當要修改或除錯預測、期望值、機率區間、成長判定、自動推薦、坐騎加成倍率、職業補正、頁面互動或 localStorage 狀態時使用；也用在使用者問「為什麼預測跟遊戲不一樣」「這個數字怎麼算的」「幫我加一個新功能（例如友好度等級、戰車兵之道）」的時候——即使沒有提到檔名。
---

# 計算引擎與頁面架構

## 檔案分工

- `calc.js`：純計算（UMD：瀏覽器 `window.FECalc`、Node `require`）。**不碰 DOM、不碰狀態**，所以能被 `tools/test-calc.mjs` 直接測。新計算邏輯一律放這裡。
- `app.js`：狀態、渲染、事件。讀 `window.FE_DATA`，套用使用者校正後呼叫 `FECalc`。
- `data.js`：產生檔（見 `fe-data-update`）。
- `index.html` / `style.css`：骨架與樣式（淺/深色用 CSS 變數，手機 375px 不可橫向捲動）。

## 公式（改之前先理解為什麼）

所有能力陣列都是 9 項，順序 `HP 力 魔 速 技 防 魔防 運 魅`。

1. **每級成長率** `g = 個人 + 職業 + 倍率 × 坐騎成長 + 自訂修正 + bonus`，機率 `p = max(0, g) / 100`。
   - 倍率由 `mountGrowthMult(cls, mount)` 決定：坐騎類型與 `cls.mountType` 相符才有效；一般騎乘職 1、戰車兵 2（`cls.mountMult`）；步行職、類型不符、戰象兵為 0。
   - `bonus`：職業附帶的額外成長，目前只有戰車兵（`cls.chariot`）的戰車加成（戰車兵之道）。數值在 `D.chariotStages`（初始／多輪升級後／不計），由 app.js 的 `chariotBonus(cls, stageId)` 依每段的 `chariot` 欄位（預設 `initial`）算出，傳給 `effectiveGrowth(…, bonus)`、`project` 的 `start.bonus`／`seg.bonus`、`recommend` 的 `classBonus(cls)`。
2. **一次升級**：確定 +floor(p)，再以 `p − floor(p)` 的機率 +1。所以 >100% 的成長率也能處理（例如戰車兵配汗血馬 ×2）。
3. **顯示值 vs 內部值**：遊戲畫面上的數值 = 內部值 + 目前職業補正 + 坐騎能力加成（×1）。補正只在該職業/騎乘時存在，換職業就換一組，所以：
   - 起點：`toInternal(顯示值, 職業, 坐騎)` 先扣掉補正再開始累積。
   - 每段終點：`round(E[內部值] + 1e-7) + 該段職業補正 + 坐騎能力加成`。
   - **合計**：`round(ΣE + 1e-7) + Σ補正`（先加總再四捨五入）。這是為了與 game8 計算器逐值一致；各項相加可能差 1，是預期行為。
4. **機率分布**：每項能力存成 `base`（起點內部值）＋ 增量 PMF（`Float64Array`，index = 增量）。`pmfStep` 做一次升級的卷積並去掉尾端 0。區間用 `pmfQuantile`；可能範圍用 `pmfMin/pmfMax`（以 `> 0` 判斷，不設門檻，否則極小機率的合法值會被誤判成「超出可能範圍」）。
5. **成長判定**（`judge`）：百分位 `top = P(X > v) + P(X = v) / 2`；≤5% 神成長、≤25% 良成長、<75% 普通、其餘偏低（與 game8 相同）。群組（合計、物理、魔法…）是把該組各項 PMF 卷積後再判定。超出/低於可能範圍時 `band` 為 null，UI 顯示提示而不是分級。
6. **自動推薦**（`recommend`）：
   - 每個 (職業, 坐騎) 的每級期望加權收益 = `Σ w_k · max(0, g_k) / 100`；騎乘職自動挑該類型收益最高的坐騎（`bestMountFor`）。
   - 依各階可轉職等級 `tierLv`（預設 5/20/35/45，神將 60）把「起點 Lv → 目標 Lv」切段，每段可選 ≤ 該階的職業；目前職業在每段都可用（已有證照）。
   - 最後一段額外加上「最終職業補正＋坐騎能力加成」的加權。各段取前 `perStage`（6）個，組合後保留前 200，再取前 `topN`。
   - 篩選（`eligibleClasses`）：女性限定、`unit.noMount`（歐露赫露、哥萊亞斯不能騎乘/飛行）、最高階級、特殊解鎖職、神將職。
   - 路線卡上的分數用**未四捨五入**的最終期望值計算，否則排名看起來會亂。

## 已知未建模的部分（別當成 bug）

- 坐騎友好 Lv1–4 的加成分配（目前一律用 Lv5）。
- 戰車何時從「初始」升到「多輪升級後」（使用者每段自選）；戰象兵之道完全沒有資料 → 用「✎ 修正」補差額。
- 戰車兵的坐騎**能力**加成是否也 ×2（目前 ×1）。
- 能力上限、證照考試/熟練度/名聲等轉職條件。

要新增其中任何一項時：先用 `fe-research` 找證據，公式放 `calc.js`，在 `test-calc.mjs` 加一個有實例數字的測試，再接 UI。

## 使用者說「預測跟遊戲不一樣」時的排查順序

1. 起點是否填了**遊戲目前的顯示值**，而且職業、坐騎選對（坐騎能力加成會被扣掉）。
2. 路線各段的職業是否就是實際升級時的職業（轉職前後的等級）。
3. 成長判定落在「普通」附近就只是亂數，不是錯誤。
4. 若差異固定出現在某職業的某一項，可能是資料來源的速/技對調等衝突 → 請使用者提供遊戲成長率畫面上那一項的數字（連同當下職業、坐騎），依 `fe-research` 的「使用者回報遊戲內數值時」換算出個人值或職業值；確定後走 `fe-data-update` 加 CORRECTIONS，或請使用者先在「資料／校正」覆寫。

## app.js 狀態與渲染

- localStorage 鍵 `fe-bsk-calc-v1`；所有讀寫都包在 try/catch（私密視窗會失敗，頁面仍要能用）。
- `state.plans[unitId] = { gender, start: { lv, classId, mountId, stats, chariot }, segments: [{ toLv, classId, mountId, custom, chariot }], judge: { row, stats } }`——每個角色各自一份。`chariot` 只對戰車兵有意義，缺少時視為 `initial`。
- `state.overrides = { units, classes, mounts }`：使用者校正，`buildData()` 會把它套到 `BASE` 的深拷貝得到 `D`。改完校正要重新 `buildData()` 再 `renderAll()`。
- 事件用 `data-bind="路徑"` 與 `data-action="動作"` 做委派。**數字欄位的 `input` 事件只更新結果區（`refreshPlanOutputs`、`renderJudgeOut`、`refreshRecOut`），不要重建正在輸入的欄位**，否則使用者一打字就失去焦點；`change`（下拉、勾選、離開欄位）才重建整個面板。
- 預測頁最前方的 `#overview-panel` 由 `renderOverview(res)` 繪製終點合計、九項能力與相對起點的變化；它和詳細結果、成長判定共用同一次 `computeProjection()` 的 `res`。調整預測輸出時，同步檢查 `renderPlanTab()` 與 `refreshPlanOutputs()`，確保摘要即時更新且輸入欄位不失焦；沒有有效路線時顯示空狀態。摘要不另存進 localStorage。
- 新增表單欄位時：給 `data-bind`，在 `onBind` 的對應 case 更新狀態，決定是輕量更新還是整塊重建。
- `defaultPlan(unit)`：有 game8 加入資料時用加入的 Lv/職業/顯示值當起點；沒有（內森、齊利科等第 2・3 部角色）則是 Lv1 平民、全 0，頁面會提示手動輸入。
- `recRoute(unit, start)`：「套用 game8 推薦路線」按鈕的邏輯——起點已超過的階級直接換成該階最高的推薦職業（與 game8 相同），之後到各推薦職業的 `recLv` 再換職，最後一段到 Lv99。
- `state.rec`：`{ preset, weights[9], targetLv, tierLv{1..5}, maxTier, includeSpecial, includeDivine, finalClassId, ownedOnly, owned[], showAllRank, chariot }`；權重預設組在 `PRESETS`。套用推薦路線時，戰車兵段落的 `chariot` 取 `state.rec.chariot`。
- 資料校正頁的可編輯欄位由 `KIND_INFO` 決定（角色：growth；職業：growth、mod；坐騎：stat、growth）。

### 狀態結構變更

使用者的設定存在瀏覽器裡，改了結構後舊資料仍會被讀回來：

- `plan()` 與載入時的 `Object.assign(defaultRec(), …)` 會補上缺少的欄位，**新增欄位**通常不用額外處理。
- **改名或改型別**（例如把 `mountId` 改成物件、職業 id 改名）時，要在載入狀態後寫遷移；真的不相容就把 `STORE_KEY` 改成 `fe-bsk-calc-v2`（使用者設定會重置，要在回報中說明）。
- 不要讓舊狀態造成例外：`clsOf` / `mountOf` 找不到時回傳 `null`，計算與渲染都要能處理 `null`。

### 同步更新說明文字

公式、坐騎規則、未建模項目有變時，除了程式也要改：`app.js` 的 `renderHelp()`（頁面「說明」分頁）、`README.md`，以及本技能的「公式」「已知未建模的部分」。

## 驗證

```bash
node tools/test-calc.mjs
```

- 「ソフィア推薦路線 = game8 計算器輸出」是公式正確性的基準（Lv20/35/45/99 合計 134/194/241/463，各項逐值比對）。任何公式修改都不能讓它失敗。
- 其他實例：馬吉迪＋戰車兵＋多輪升級後戰車＋汗血馬 → HP95 力80 技65 防90；凱伊＋榮光騎士＋野生馬 → 成長 HP60 速50 技50 防45 魔防50；安娜預設加入（騰訊文件表＋戰象兵補正）→ 49 16 11 16 23 26 9 20 16。

頁面檢查：

```bash
node tools/serve.mjs
```

打開 http://localhost:8765/ ，確認 console 沒有錯誤、手機寬度（375px）沒有整頁橫向捲動（寬表格可在表格內捲動）、四個分頁都能切換。改動預測頁時，檢查摘要和詳細結果隨起點、路線、推薦套用同步更新，數字輸入保持焦點。這台 Windows 機器上 `python -m http.server` 會斷線，請用 `tools/serve.mjs`。

用 Claude 內建瀏覽器（Browser pane）檢查時：

- 不要直接開 `file:///…/index.html`：內建瀏覽器會把它當成靜態快照，`data.js`、`app.js` 不會執行。
- 用 `preview_start` 的 `static` 設定。它在 `.claude/launch.json`（`.claude/` 被 gitignore，clone 後要自己建）：
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "static", "runtimeExecutable": "node", "runtimeArgs": ["tools/serve.mjs", "8766"], "port": 8766 } ] }
  ```
- `preview_start` 回報「Port 8766 is in use by another chat's dev server」時，是別的對話正在用：不要停掉它。多個對話同時開預覽很常見（`static-alt` 的 8767 也可能被占），最省事的是在 `.claude/launch.json` 加一個自動選埠的設定：`"name": "static-auto"`、`"runtimeArgs": ["tools/serve.mjs"]`（不要寫埠號）、`"port": 8768`、`"autoPort": true`。`serve.mjs` 的埠號優先順序是命令列參數 → 環境變數 `PORT` → 8765，所以不給參數時會用預覽工具分配的 `PORT`。`serve.mjs` 每次都從磁碟讀檔、不快取，所以不同埠看到的都是目前的檔案。
- 用 `resize_window` 模擬手機後，分頁偶爾會卡住（所有指令逾時），這不是程式問題；關掉分頁、用 `tabs_create` 開新分頁再 `navigate` 即可。
- 要重新載入頁面時用 `navigate` 到同一個網址。不要在 `javascript_tool` 裡寫 `location.reload()` 再 `await`：頁面卸載後腳本永遠等不到結果，會逾時 45 秒，之後幾個指令也可能跟著逾時。
- Browser pane 被隱藏時 `screenshot` 可能逾時。檢查數值、版面寬度改用 `find`、`get_page_text` 或同步的 `javascript_tool`（例如 `document.documentElement.scrollWidth > innerWidth`）。
- 測試時會改到預覽分頁的 localStorage；測完可執行 `localStorage.removeItem('fe-bsk-calc-v1')` 還原成預設狀態。
