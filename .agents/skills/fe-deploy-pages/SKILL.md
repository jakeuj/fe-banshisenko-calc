---
name: fe-deploy-pages
description: 把《萬紫千紅》培養計算器的變更發布到 GitHub Pages（repo jakeuj/fe-banshisenko-calc，網址 https://fe-banshisenko-calc.jakeuj.com/）。當使用者說 push、發布、上線、部署、更新網站、commit 並推上去、Pages 沒更新、網站打不開時使用——即使只說「推上去」或「更新線上版」。也用在網站門面：改網站標題／描述、favicon 或 icon、社群分享預覽圖、SEO、sitemap、robots.txt、搜尋引擎找不到網站的時候。
---

# 發布到 GitHub Pages

- Repo：`jakeuj/fe-banshisenko-calc`（公開；免費帳號的 Pages 需要公開 repo）
- Pages 來源：`main` 分支根目錄，沒有 build 步驟，靜態檔案原樣發布（根目錄有 `.nojekyll`，不要刪，否則 GitHub 會用 Jekyll 處理）
- 自訂網域：**https://fe-banshisenko-calc.jakeuj.com/**（DNS 為 CNAME → `jakeuj.github.io`）。從分支發布時，GitHub 以根目錄的 `CNAME` 檔記錄網域，不要刪或改這個檔，否則網站會退回 `blog.jakeuj.com/fe-banshisenko-calc/`。

## 流程

push 會公開發布內容，使用者沒有明確要求發布時先確認再做。

1. **先確定內容正確**
   ```bash
   node tools/test-calc.mjs
   ```
   若這次有改資料來源（names/mounts/build-data），先依 `fe-data-update` 重新產生 `data.js`；`data.js` 必須和工具腳本一起提交，因為線上版只讀 `data.js`。
   然後更新 `index.html` 的版本參數（依各檔內容雜湊產生 `?v=xxxxxxxx`，檔案沒變就不會變）：
   ```bash
   node tools/stamp-assets.mjs
   node tools/stamp-assets.mjs --check
   ```
   只要 `style.css`、`data.js`、`calc.js`、`app.js` 有改，就一定要做這步並一起提交 `index.html`，否則使用者可能拿到快取的舊檔。
2. **看要提交什麼**
   ```bash
   git status --short
   git diff --stat
   ```
   `tools/raw/`（game8 原始快取）與 `.claude/` 已被 gitignore，不應出現在提交裡；若出現，檢查 `.gitignore`。
3. **提交**：繁中摘要一行＋條列重點；若當前工作階段有要求的署名行（Co-Authored-By 等），附在訊息結尾。不要略過 hooks。
4. **推送**
   ```bash
   git push
   ```
5. **等 Pages 建置完成**（每次 push 會觸發 `pages-build-deployment` workflow，約 25 秒）。Claude Code 的 Bash 不允許前景 `sleep`，所以用 `gh run watch` 等待，不要寫 sleep 迴圈：
   ```bash
   id=$(gh run list -R jakeuj/fe-banshisenko-calc -w pages-build-deployment -c "$(git rev-parse HEAD)" -L 1 --json databaseId --jq '.[0].databaseId')
   gh run watch "$id" -R jakeuj/fe-banshisenko-calc --exit-status
   ```
   剛 push 完 `id` 可能還是空的（workflow 尚未建立）：隔幾秒再執行第一行。失敗時看 `gh run view "$id" -R jakeuj/fe-banshisenko-calc --log-failed`，或 `gh api repos/jakeuj/fe-banshisenko-calc/pages/builds/latest` 的錯誤訊息。
6. **驗證線上版**
   ```bash
   for f in "" data.js calc.js app.js style.css; do curl -sL -o /dev/null -w "%{http_code} %{size_download} $f\n" "https://fe-banshisenko-calc.jakeuj.com/$f"; done
   ```
   這次有動到圖示或 SEO 檔時，再加查 `favicon.ico favicon.svg apple-touch-icon.png icon-192.png icon-512.png og-image.png site.webmanifest robots.txt sitemap.xml`。
   全部 200 且大小與本機檔案相近才算完成。可用內建瀏覽器打開網址，確認 console 無錯誤；沒有本機設定時，`#overview-panel` 應顯示 Lv99 賢士、合計 463，索緋雅預設路線的詳細合計應為 93 / 134 / 194 / 241 / 463。若瀏覽器的只讀頁面沙盒無法讀取 `window.FE_DATA` 或 `window.FECalc`，以實際渲染結果和 console 為準。
7. 回報：提交內容、網址、驗證結果。GitHub Pages 的 CDN 可能快取約 10 分鐘，使用者看到舊版時請他強制重新整理。
   - 靜態檔帶有內容雜湊版本參數，所以不會出現「新 `app.js` 配舊 `data.js`」；但 `index.html` 本身仍可能被快取約 10 分鐘，這段期間使用者看到的是完整的舊版。
   - 新增要在 `index.html` 引用的 `.js` / `.css` 檔時，照一般寫法 `src="xxx.js"` 即可，`stamp-assets.mjs` 會自動補上版本參數。

## 網站圖示與 SEO

整個站只有一頁，門面資訊都在 `index.html` 的 `<head>` 與根目錄的幾個靜態檔。

- **圖示**：`favicon.svg` 是手寫的原始圖（頁首的金色菱形徽記）。`favicon.ico`（16/32/48，ICO 內嵌 PNG）、`apple-touch-icon.png`（180）、`icon-192.png`、`icon-512.png` 與分享圖 `og-image.png`（1200×630）都由它產生：
  ```bash
  node tools/build-icons.mjs
  ```
  - 需要本機 Chrome／Edge（headless 截圖，可用環境變數 `CHROME` 指定路徑）；分享圖用系統的 Noto Serif TC／Noto Sans TC，換到沒有這兩套字型的機器字形會變。
  - apple-touch 與 192/512 用滿版方形（腳本會拿掉 `rx` 圓角），因為 iOS 與 Android maskable 會自己裁圓角；透明角在 iOS 會變黑。
  - 分享圖的文字寫在 `tools/build-icons.mjs` 的 `OG` 樣板裡；改完一定要 Read `og-image.png` 看一眼。標題不能換行、各區塊不能重疊（字太大時標題會折成兩行，副標會壓到下面的標籤）。
  - Pages 沒有 build 步驟，產生的 PNG／ICO 要一起提交。
- **`<head>` 要一起改的地方**：
  - 描述文字出現三次：`meta description`、`og:description`、JSON-LD 的 `description`。
  - 標題出現兩次：`<title>`、`og:title`。
  - canonical、`og:url`、`og:image` 要用自訂網域的絕對網址；換網域時連同 `robots.txt`、`sitemap.xml`、分享圖底部的網址一起改。
- **名稱**：繁中正式標題是「聖火降魔錄 萬縷千絲」，玩家多叫「萬紫千紅」（見 `fe-research` 的 `references/sources.md`）。標題、描述、頁尾聲明與 JSON-LD 都要同時帶兩個名稱；JSON-LD `about.alternateName` 另列英文、日文、簡中名稱。改名稱時兩個都要保留，只寫一個會讓搜尋另一個名稱的人找不到。
- **JSON-LD**：`WebApplication`（免費、`operatingSystem: Any`），`about` 指向遊戲 `VideoGame`。只放確定的事實：不要自己加評分、評論數或未查證的欄位（例如平台）。
- **搜尋引擎實際讀得到的文字**：頁面主體由 JS 渲染，「說明」分頁的內容要點開分頁才會建立。不靠 JS 就看得到的只有頁首、`<noscript>` 說明與頁尾聲明，這三處要保留遊戲名稱與功能關鍵字。
- **`robots.txt`**：擋 `/tools/`、`/.agents/`，並指向 sitemap。
- **`sitemap.xml`**：只有首頁一個網址，刻意不寫 `lastmod`，免得日期過期沒人更新。
- **快取**：
  - `stamp-assets.mjs` 只處理 `.js`／`.css`，圖示與分享圖沒有版本參數；瀏覽器分頁的 favicon 快取很久，換圖後自己看不到新圖時請強制重新整理。
  - 社群平台會快取舊的分享預覽：Facebook 用 Sharing Debugger 重抓，其他平台通常要等快取過期。
- **只能由使用者自己做的**：到 Google Search Console 驗證網域並提交 `https://fe-banshisenko-calc.jakeuj.com/sitemap.xml`。
- 新增其他副檔名的靜態檔時，在 `tools/serve.mjs` 的 `TYPES` 補上 MIME，否則本機預覽會回 `application/octet-stream`。

## 公開 repo 會一起公開的東西

Pages 發布整個 `main` 根目錄（有 `.nojekyll`，點開頭的資料夾也會被發布），所以 `.agents/skills/`、`tools/`、`README.md` 都能從網址直接讀到。不要把個人資料、token、私人筆記放進 repo；`tools/raw/`（game8 原始 JSON）已被 gitignore，不要改成提交它。

## 其他情況

- **Pages 被關掉或第一次設定**：
  ```bash
  gh api -X POST repos/jakeuj/fe-banshisenko-calc/pages -f "source[branch]=main" -f "source[path]=/"
  ```
  查看目前設定：`gh api repos/jakeuj/fe-banshisenko-calc/pages`
- **想改成私人 repo**：免費帳號 Pages 會停止，先告知使用者。
- **自訂網域設定**（`CNAME` 檔之外，GitHub 端設定也要一致）：
  ```bash
  gh api -X PUT repos/jakeuj/fe-banshisenko-calc/pages -f cname=fe-banshisenko-calc.jakeuj.com
  gh api -X PUT repos/jakeuj/fe-banshisenko-calc/pages -F https_enforced=true
  ```
  第二行要等 GitHub 簽好 HTTPS 憑證（DNS 生效後數分鐘到一小時）才會成功；失敗時稍後再試。
- **首頁網址**（repo 右側 About）：`gh repo edit jakeuj/fe-banshisenko-calc --homepage https://fe-banshisenko-calc.jakeuj.com/`
