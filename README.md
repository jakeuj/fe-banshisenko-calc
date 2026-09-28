# 萬紫千紅 培養計算器

《聖火降魔錄 萬紫千紅》(Fire Emblem: Fortune's Weave) 角色成長預測工具（繁體中文）。

- 以「目前等級＋職業＋坐騎＋實際能力值」為起點，預測之後轉職路線的期望值與機率區間
- 成長判定（神成長／良成長／普通／偏低）
- 凱伊篇坐騎（騎乘動物）成長加成，戰車兵 ×2＋戰車本身的成長加成（戰車兵之道）；職業與坐騎類型、性別、個人技能限制
- 依能力權重自動推薦轉職＋坐騎路線
- 可在頁面上校正職業／坐騎／角色數值（存在瀏覽器）

## 使用

直接開啟 `index.html`，或使用 GitHub Pages 網址。

## 開發

```bash
node tools/check-sources.mjs          # 唯讀檢查：game8.jp 線上資料是否變動、game8.co 成長率與目前資料的差異
node tools/build-data.mjs --refresh   # 重新下載 game8 資料並產生 data.js
node tools/test-calc.mjs              # 驗證計算（含與 game8 計算器輸出逐值比對）
node tools/serve.mjs                  # 本機預覽 http://localhost:8765/
node tools/stamp-assets.mjs           # 發布前更新 index.html 的 ?v= 版本參數（依檔案內容雜湊）
node tools/build-icons.mjs            # 改了 favicon.svg 或分享圖文字後，重新產生 favicon.ico、PNG 圖示與 og-image.png（需本機 Chrome／Edge）
```

- `calc.js`：計算核心（瀏覽器與 Node 共用）
- `app.js`：介面
- `tools/mounts.mjs`：坐騎資料（game8 計算器沒有，手動整理）
- `tools/names-zh.mjs`：日文 → 繁中名稱對照

### AI 代理技能

`.agents/skills/` 收錄本專案的技能（資料更新、計算引擎、發布、機制研究）。Claude Code 只讀 `.claude/skills/`，clone 後執行一次即可讓它自動載入：

```bash
node tools/link-skills.mjs   # 建立 .claude/skills → .agents/skills 連結（Windows 用 junction）
```

## 資料來源

- 角色／職業成長率、補正值、加入資料：game8.jp「育成方針計算ツール」
- 坐騎、戰車（戰車兵之道）：game8.jp 各動物頁、game8.co、fire-emblem-fw.site、騰訊文件《火焰之纹章 万紫千红》在线数据表
- 資料修正的比對來源：game8.co、Serenes Forest、繁中社群試算表、fire-emblem-fw.site、騰訊文件表（修正清單見頁面「說明」）
- 中文名稱：繁中社群整理的試算表、巴哈姆特／GNN、fire-emblem-fw.site（部分為暫譯）

本工具為玩家自製，與任天堂、Intelligent Systems、Koei Tecmo 無關。
