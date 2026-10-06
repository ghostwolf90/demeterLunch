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
- 6 週、27 個供餐日的葷食與素食菜單已轉成 54 組可查詢的每日菜單與營養資料
- 葷、素食譜用量明細表已逐格校讀成 312 道菜、900 筆食材與設計用量
- 可在網站切換葷食／素食，並分別開啟該餐別的食譜用量明細原圖
- 將校園食材平臺資料整理成菜色、食材、製造／生產者、產地、供應商、認證與經營者溯源關聯
- 每道菜可展開查看食材、設計用量與原表色塊宣稱；原表宣稱不會冒充官方認證
- 食材溯源只以同日官方資料代表該餐紀錄；當月資料尚未發布時，明確標示官方資料待更新
- 缺少同日資料時，只將菜名或明細食材可明確匹配的舊資料列為「歷史食材紀錄／過往供餐參考」，並顯示實際供餐日期與來源，不將其冒充為今日食材、產地、供應商或批次
- 今日餐盤、整週瀏覽與跨週營養趨勢
- 依國小 1–3／4–6 年級及官方目標值／階段值，判讀週間平均供應情形
- 不以單一百分比評分；缺少乳品、鈉、鈣等原始數值時明確標示資料不足
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

## 每月校園食材 OpenAPI 更新

`scripts/update_traceability.py` 會先以 `POST /opendatadataset/` 查詢指定月份的臺中市資料集清單（回應同時包含符合條件的全國資料集），再以 `POST /opendatadownload/` 取得臺中市國中小與全國 CSV 的官方下載連結。預設抓取執行日的上一個月，保存完整原始 CSV 與 SHA-256 manifest，並只把「臺中市西區忠信國小」且已有校讀菜單的同日資料轉成 reviewed `traceability-YYYY-MM.json`。既有同日人工校讀紀錄優先，不會被較少欄位的月資料覆蓋。

access code 不得寫入程式碼或提交 Git。可設為 `FATRACE_ACCESS_CODE` 環境變數，或存入已由 Git 忽略的 `.secrets/fatrace_access_code`，並把檔案權限限制為只有目前使用者可讀：

```bash
mkdir -p .secrets
chmod 700 .secrets
read -s FATRACE_CODE
printf '%s' "$FATRACE_CODE" > .secrets/fatrace_access_code
unset FATRACE_CODE
chmod 600 .secrets/fatrace_access_code
```

每月 6 日執行：

```bash
python3 scripts/update_traceability.py --verify-and-build
```

成功且有新追溯資料時，指令會重建 SQLite、執行完整單元測試、檢查 `web/app.js`，再重建 `dist/`。若當月官方資料尚未發布，指令會以狀態 `pending` 結束，不會覆蓋原有 CSV、JSON、SQLite 或靜態網站。所有請求都有逾時、描述性 User-Agent、有限次重試與請求間隔。

接著啟動網站：

```bash
python3 scripts/serve.py
```

接著用瀏覽器開啟：

```text
http://127.0.0.1:8000
```

macOS 可直接雙擊專案根目錄的 `啟動資料後台.command`。也可以確認每月 OpenAPI 排程、下載檔案、reviewed JSON、SQLite 與靜態網站的本機狀態：

```text
http://127.0.0.1:8000/admin/
```

後台只允許 loopback 用戶端存取，不顯示 access code，也不會被 `build_static_site.py` 複製到公開的 `dist/`。

後台的「下載並整合」按鈕可手動執行與每月排程相同的本機流程。按下後會要求確認，再依序下載、驗證、整合、重建 SQLite、執行測試並重建 `dist/`；執行期間不可重複啟動。若官方資料尚未發布或更新失敗，既有有效資料會保留。公開 Site 的部署需要短效雲端憑證，因此不由本機網頁保存或直接執行；後台可複製一段發布請求，交由 Codex 讀取線上最新 Site 原始碼後安全發布。

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
data/parsed/2026/semester-1/week-02/recipe-details.json
data/parsed/2026/semester-1/week-01/traceability.json
data/reference/school-lunch-nutrition-rules.json
data/lunch.db
```

`metadata.json` 會保存文章 ID、標題、網址、發布／更新時間、解析後日期，以及每張圖片的來源網址、本地檔名、Content-Type、位元組數、尺寸和 SHA-256。

`data/parsed/` 是人工校讀後的結構化來源。`menu.json` 保存每日葷食與素食的菜單總表、營養份數、信心值與可辨識過敏原；`recipe-details.json` 保存每道菜底下的材料、設計用量，以及原表的「初級加工／非基改、在地、安全蔬菜」色塊宣稱。每週另保存菜單總表、葷食用量明細與素食用量明細三張來源圖。校園食材平臺的菜色、食材、供應商、認證與認證經營者則先校讀成 `traceability.json`；原始 CSV 不會直接進入網站。`data/reference/school-lunch-nutrition-rules.json` 保存由 109 年 12 月 28 日修訂版官方文件逐頁核對的國小營養建議量、食物內容目標值、階段值與 ±8% 週間容許範圍。`scripts/build_database.py` 會先驗證日期、餐別、必填欄位、關聯及重複資料，再以原子替換方式產生 `data/lunch.db`。

## 本機 API

- `GET /api/dashboard?date=2026-10-01&mealType=meat`：指定葷食或素食（`vegetarian`）的今日、當週、營養基準判讀、趨勢與食材溯源資料
- `GET /api/menus`：原始文章與圖片清單
- `GET /api/health`：伺服器狀態

## 建立可發佈的靜態版本

```bash
python3 scripts/build_static_site.py
```

輸出位於 `dist/`，包含手機版網站、葷素兩種結構化資料快照，以及每週的菜單總表、葷食用量明細與素食用量明細原圖。公開版不依賴本機 Python 或 SQLite 服務。

## 抓取策略

1. 以每頁 50 筆讀取 Blogger Atom feed，並跟隨 `rel="next"`。
2. 依文章標題及標籤篩選「菜單及營養素分析」。
3. 從 Atom entry 的文章 HTML 找出實際 `<img>`，優先採用圖片外層連結。
4. 對已知 Blogger 圖片網址使用 `s0` 取得原始尺寸。
5. Feed 不可用時，才從首頁開始跟隨「較舊的文章」分頁。

## 資料品質與限制

- 校園食材平臺 OpenAPI 的每月資料於次月 6 日執行排程，因此無法用來即時確認當月供餐內容。例如 2026 年 9 月資料於 2026 年 10 月 6 日更新，2026 年 10 月資料則於 2026 年 11 月 6 日更新；資料發布後才能回補該日的正式紀錄。
- 若已取得校園食材登錄平臺的同日學校頁面，會先以人工校讀截圖補入當日追溯資料，並保留供餐日期與校讀來源；菜名、食材名稱與設計用量仍以忠信國小餐單及用量明細為準。2026-10-06 原餐單僅寫「水果」，同日平臺頁面已補充為「芭樂」。
- 菜單圖片的中文字體與注音裝飾容易造成 OCR 誤讀，因此目前 6 週的葷食與素食菜名、營養數字、菜內材料與設計用量均經人工視覺校讀；原始明細圖仍保留供逐項核對。
- 校園食材平臺資料沒有葷素欄位；同日比對會再用所選餐別的菜內明細篩選，避免把葷食材料誤列到素食。歷史匹配只代表過去同名菜色或相符食材曾出現過的供應紀錄，不代表今日實際使用的食材、產地、供應商或批次，介面不得將其標示為今日溯源。
- 食譜明細表的色塊只代表供餐廠商在原表上的分類或文字宣稱；正式供應商、認證編號與認證經營者只取自校園食材平臺及其官方連結。
- 若素食明細原表列出可能含動物性來源的材料（例如柴魚），系統會忠實保留並供核對，不會自行改寫來源資料。
- 晚餐內容是規則式搭配靈感，不是個人化醫療或營養建議。
- 營養基準只使用校方明示的食譜設計值；蛋白質克數、脂肪、鈣、鈉、乳品與深色蔬菜份數未提供時不推估，所有結果也不代表學生實際攝取量。
- 過敏原只整理原圖明示或可由菜名辨識的項目，有過敏需求時仍應以校方公告與食材現場資訊為準。
- 圖片沒有可靠的 alt 文字，因此仍按來源順序命名為 `menu-01`、`menu-02` 等；metadata 另記錄 `summary`、`meat_detail`、`vegetarian_detail` 角色。
- 未解析的新標題格式仍會保存到 `data/raw/unparsed/`，並在 log 中提出警告。
- Blogger 或 Google 可能限流；遇到 429 或 5xx 時只會做有限次重試，不會繞過網站限制。
- Blogger 偶爾會讓 `s0` 仍只回傳較小版本；下載器會重試並在 metadata 的 `matchesDeclaredDimensions` 標示是否符合文章宣告尺寸。
- 不使用 GitHub Actions；公開網站的來源偵測由連結到 Site 的排程負責。
