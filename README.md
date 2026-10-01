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
- 今日餐盤、整週瀏覽與跨週營養趨勢
- 依午餐蛋白質、蔬菜、水果與烹調方式產生晚餐搭配靈感
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
data/lunch.db
```

`metadata.json` 會保存文章 ID、標題、網址、發布／更新時間、解析後日期，以及每張圖片的來源網址、本地檔名、Content-Type、位元組數、尺寸和 SHA-256。

`data/parsed/` 是人工校讀後的結構化來源，包含每日主食、主菜、配菜、湯、水果、營養份數、信心值與可辨識過敏原。`scripts/build_database.py` 會先驗證日期、必填欄位及重複資料，再以原子替換方式產生 `data/lunch.db`。

## 本機 API

- `GET /api/dashboard?date=2026-10-01`：今日、當週、趨勢與晚餐建議
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
- 目前只提供本機網站，不含 GitHub Actions、排程或雲端儲存。
