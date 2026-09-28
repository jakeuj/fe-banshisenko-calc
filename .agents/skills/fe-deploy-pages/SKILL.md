---
name: fe-deploy-pages
description: 把《萬紫千紅》培養計算器的變更發布到 GitHub Pages（repo jakeuj/fe-banshisenko-calc，網址 https://fe-banshisenko-calc.jakeuj.com/）。當使用者說 push、發布、上線、部署、更新網站、commit 並推上去、Pages 沒更新、網站打不開時使用——即使只說「推上去」或「更新線上版」。
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
5. **等 Pages 建置完成**（通常 30–60 秒）
   ```bash
   for i in $(seq 1 20); do s=$(gh api repos/jakeuj/fe-banshisenko-calc/pages/builds/latest --jq .status); echo "$s"; [ "$s" = built ] || [ "$s" = errored ] && break; sleep 10; done
   ```
   `errored` 時用 `gh api repos/jakeuj/fe-banshisenko-calc/pages/builds/latest` 看錯誤訊息。
6. **驗證線上版**
   ```bash
   for f in "" data.js calc.js app.js style.css; do curl -sL -o /dev/null -w "%{http_code} %{size_download} $f\n" "https://fe-banshisenko-calc.jakeuj.com/$f"; done
   ```
   全部 200 且大小與本機檔案相近才算完成。可用內建瀏覽器打開網址，確認 `window.FE_DATA` 與 `window.FECalc` 存在、console 無錯誤；在沒有本機設定的情況下，索緋雅預設路線的合計應為 93 / 134 / 194 / 241 / 463。
7. 回報：提交內容、網址、驗證結果。GitHub Pages 的 CDN 可能快取約 10 分鐘，使用者看到舊版時請他強制重新整理。

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
