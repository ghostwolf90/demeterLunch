# 忠信國小營養午餐資料收集系統

這是一個供個人家庭用途使用的資料整理工具。它會從[忠信國小午餐網](https://zxes.blogspot.com/)取得每週菜單文章，保存原始圖片，再將校讀後的每日菜單與營養資料整理成 SQLite，供本機午餐助手使用。

目前範圍從 2026-09-01 起。跨越此日期的 `0831-0904` 第 1 週也會納入。

## 功能

- Blogger Atom feed 優先，HTML crawler fallback
- 解析學年度、學期、週次及日期區間
- 正確處理跨月、跨年與第二學期年份
- 將 Blogger 縮圖網址正規化成 `s0` 原始尺寸
- 驗證下載內容確實為圖片，記錄大小、尺寸及 SHA-256
- 以 Blogger post ID 和 `updatedAt` 避免重複下載
- 更新時先完整寫入 staging directory，再替換既有資料
- 單篇失敗不會中止整批匯入
- 23 個供餐日已轉成可查詢的每日菜單與營養資料
- 將校園食材平臺資料整理成菜色、食材、供應商、認證與經營者溯源關聯
- 食材溯源只顯示與所選午餐相同供餐日期的官方資料；本週卡片標示可追溯或待補狀態
- 今日餐盤、整週瀏覽與跨週營養趨勢
- 依午餐蛋白質、蔬菜、水果與烹調方式產生晚餐搭配靈感
- 每日食育小卡，以食材觀察與親子對話延伸午餐內容
- 依當日菜色提供家庭靈感版料理，明確區分於校方原始配方
- 定期偵測 Blogger 新文章與既有菜單更新
- 每日彙整近 30 天校園午餐政策、食安、供應與食育消息
- 新聞以官方與可信媒體 RSS 為來源，自動篩選、去重並保留原文連結
- 每筆資料可回到校方文章及原始菜單圖片核對

## 環境需求

- Python 3.10 以上
- 不需要第三方 Python 套件

## 執行歷史匯入

從 2026 年 9 月開始匯入目前所有菜單：

```bash
python3 scripts/import_history.py
```

可調整日期、連線間隔或資料位置：

```bash
python3 scripts/import_history.py \
  --since 2026-09-01 \
  --interval 1.0 \
  --data-dir data/raw
```

## 取得最新菜單

```bash
python3 scripts/fetch_latest.py
```

若文章與圖片都已存在且 `updatedAt` 未改變，執行結果會是 `skipped`。

只檢查 Blogger 是否出現新文章或原圖更新：

```bash
python3 scripts/check_for_updates.py
```

偵測到變化時一併保存原始圖片：

```bash
python3 scripts/check_for_updates.py --download
```

檢查狀態會以原子方式寫入 `data/monitor/state.json`。第一次執行只建立比較基準，不會把既有文章誤報為新菜單；之後會回報 `new`、`updated` 或 `unchanged`。

## 網站自動檢查流程

公開網站連結的排程每天讀取相同 Site 原始碼，並依下列步驟執行：

1. 從網站原始碼取得本專案，執行 `python3 scripts/check_for_updates.py --download`。
2. Atom feed 是主要來源；只有 Atom 無法使用時才回退到 Blogger HTML。
3. `initialized` 或 `unchanged` 時保持安靜，不更新公開菜單。
4. `new` 或 `updated` 時保存 `data/monitor/state.json` 與完整原始圖片，通知使用者文章標題、日期區間和變更類型。
5. 新資料只停留在原始資料層；不得自動修改 `data/parsed/`、營養數字、過敏原或公開頁面，也不得把未校讀內容部署到網站。
6. 暫時性網路錯誤可重試一次；仍失敗時保留上一個有效狀態並通知使用者，不得以空資料覆蓋既有內容。

這個流程需要 Blogger 的公開讀取權限，以及同一個 Site 原始碼的讀寫權限；不使用個人帳號、Cookie 或其他憑證。

## 午餐觀察自動更新

手動檢查一次近期消息：

```bash
python3 scripts/check_news_updates.py
```

預設會讀取臺中市政府市政新聞、教育部即時新聞，以及中央通訊社政治、生活與地方 RSS。只收錄近 30 天且標題明確涉及學校午餐、營養午餐、供餐、團膳或食農教育的消息，最多保留 20 則。

更新結果寫入：

```text
data/news/news.json
data/news/state.json
```

`news.json` 是網站使用的有效資料；`state.json` 記錄最近檢查結果。來源暫時失敗時會保留上一份有效資料，不會用空內容覆蓋。每則只保存標題、日期、來源、原文網址、分類與本站規則式關聯說明，不轉載全文或新聞圖片。

公開網站的新聞排程應依下列步驟執行：

1. 取得同一個 Site 的最新原始碼，執行 `python3 scripts/check_news_updates.py`。
2. `status` 為 `unchanged` 時保持安靜，不建立新版本。
3. `status` 為 `updated` 時執行 `python3 scripts/build_static_site.py`、完整測試與 JavaScript 語法檢查，再發佈同一個 Site 的新版本。
4. 一般新增消息不通知；只有臺中本地食安／供餐重大消息、更新失敗或需要人工處理時才通知使用者。
5. 任一來源失敗時不得刪除舊消息；所有來源都無法讀取時，保留上一份有效 `news.json` 並回報失敗。

此流程只讀取公開 RSS，不需要個人帳號、Cookie 或新聞網站登入資訊。

## 開啟本機網站

macOS 可以直接雙擊專案根目錄的 `啟動午餐網站.command`。它會建立資料庫、啟動本機伺服器並開啟正確網址。

請不要直接以 `file:///.../web/index.html` 開啟網頁檔案；網站需要由本機伺服器提供 API。若誤開 `index.html`，頁面會自動轉到 `http://127.0.0.1:8000/`。

校讀後的 JSON 有更新時，先重建 SQLite：

```bash
python3 scripts/build_database.py
```

接著啟動網站：

```bash
python3 scripts/serve.py
```

接著用瀏覽器開啟：

```text
http://127.0.0.1:8000
```

網站的日常分析讀取 `data/lunch.db`，原圖則從 `data/raw/` 提供。兩者都在本機，不需要安裝前端套件。按 `Ctrl+C` 可停止伺服器。

## 執行測試

```bash
python3 -m unittest discover -s tests -v
```

## 資料位置

```text
data/raw/
└── 2026/
    └── semester-1/
        └── week-02/
            ├── metadata.json
            ├── menu-01.png
            ├── menu-02.jpg
            └── menu-03.jpg

data/parsed/2026/semester-1/week-02/menu.json
data/parsed/2026/semester-1/week-01/traceability.json
data/lunch.db
```

`metadata.json` 會保存文章 ID、標題、網址、發布／更新時間、解析後日期，以及每張圖片的來源網址、本地檔名、Content-Type、位元組數、尺寸和 SHA-256。

`data/parsed/` 是人工校讀後的結構化來源，包含每日主食、主菜、配菜、湯、水果、營養份數、信心值與可辨識過敏原。校園食材平臺的菜色、食材、供應商、認證與認證經營者也先校讀成 `traceability.json`；原始 CSV 不會直接進入網站。`scripts/build_database.py` 會先驗證日期、必填欄位、關聯及重複資料，再以原子替換方式產生 `data/lunch.db`。

## 本機 API

- `GET /api/dashboard?date=2026-10-01`：今日、當週、趨勢與食材溯源資料
- `GET /api/menus`：原始文章與圖片清單
- `GET /api/health`：伺服器狀態

## 建立可發佈的靜態版本

```bash
python3 scripts/build_static_site.py
```

輸出位於 `dist/`，包含手機版網站、結構化資料快照，以及每週第一張原始菜單圖。公開版不依賴本機 Python 或 SQLite 服務。

## 抓取策略

1. 以每頁 50 筆讀取 Blogger Atom feed，並跟隨 `rel="next"`。
2. 依文章標題及標籤篩選「菜單及營養素分析」。
3. 從 Atom entry 的文章 HTML 找出實際 `<img>`，優先採用圖片外層連結。
4. 對已知 Blogger 圖片網址使用 `s0` 取得原始尺寸。
5. Feed 不可用時，才從首頁開始跟隨「較舊的文章」分頁。

## 資料品質與限制

- 菜單圖片的中文字體與注音裝飾不適合目前僅有英文語系的本機 OCR，因此首批 5 週採人工視覺校讀；這比直接採用低可信度 OCR 更可靠。
- 目前結構化的是一般午餐菜單；素食欄仍可在原始圖片中查看。
- 晚餐內容是規則式搭配靈感，不是個人化醫療或營養建議。
- 過敏原只整理原圖明示或可由菜名辨識的項目，有過敏需求時仍應以校方公告與食材現場資訊為準。
- 圖片沒有可靠的 alt 文字，因此目前按來源順序命名為 `menu-01`、`menu-02` 等。
- 未解析的新標題格式仍會保存到 `data/raw/unparsed/`，並在 log 中提出警告。
- Blogger 或 Google 可能限流；遇到 429 或 5xx 時只會做有限次重試，不會繞過網站限制。
- Blogger 偶爾會讓 `s0` 仍只回傳較小版本；下載器會重試並在 metadata 的 `matchesDeclaredDimensions` 標示是否符合文章宣告尺寸。
- 不使用 GitHub Actions；公開網站的來源偵測由連結到 Site 的排程負責。
