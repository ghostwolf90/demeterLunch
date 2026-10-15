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

預設會讀取臺中市政府市政新聞、教育部即時新聞，以及中央通訊社政治、生活與地方 RSS。臺中市政府來源優先使用 RSS；只有 RSS 無法讀取或沒有有效條目時，才會改讀 `https://www.taichung.gov.tw/9962/Lpsimplelist` 的市政新聞列表。只收錄近 30 天且標題明確涉及學校午餐、營養午餐、供餐、團膳或食農教育的消息，最多保留 20 則。

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

此流程只讀取公開 RSS 與臺中市政府公開新聞列表，不需要個人帳號、Cookie 或新聞網站登入資訊。

## 開啟本機網站

要預覽免費登入、一口護照營養午餐紀錄與本機 D1 私人資料，請使用 Node.js 22.13 以上：

```bash
EMAIL_AUTH_SECRET=local-preview-secret \
EMAIL_AUTH_DEV_CODE=123456 \
npm run dev
```

第一次啟動會自動套用 `drizzle/` 內尚未執行的本機 D1 遷移，然後在
`http://127.0.0.1:5173/` 開啟網站。本機用任意有效 Email、成年生日及照顧者
聲明註冊，再輸入上述 `EMAIL_AUTH_DEV_CODE` 即可完成測試；只有 loopback 網址
可以使用這組本機驗證碼，不會寄信或建立外部帳號。完整生日只用來即時計算
是否已滿 18 歲，不會寫入資料庫；孩子資料與
營養午餐與其他場合的食物紀錄保存在 `.wrangler/state/` 的本機 D1，不寫入瀏覽器儲存空間。
孩子的午餐紀錄會綁定一所就讀國小；網站上方仍可自由查看其他學校的公開午餐，但
不會因此變更孩子的學校，也不會把別校菜色帶進孩子的紀錄。孩子資料編輯畫面
可隨時取消返回。首頁只顯示最近五筆午餐紀錄，超過五筆時可進入完整紀錄頁，
依供餐日期與月份回看每天的食物經驗。同一天的多筆食物會集中呈現，也可展開
查看所屬學校、日期與餐別的完整同日菜單；沒有同日紀錄時不會拿其他日期代替。
新增紀錄會分開保存孩子這次接觸到哪一步、可複選的感受、孩子原話與家長筆記，
不把感受混成單一分數。
新增紀錄時會先保存來源菜色，再保存孩子提到的食物（例如「扣肉」來自
「梅干扣肉」）；家裡或其他場合遇到的食物可另外標示。舊紀錄若未保存來源
菜色，畫面會如實標示為「舊紀錄未記錄菜色來源」，不會依名稱猜測。

若要測試 MAAC Go Email API，不要設定 `EMAIL_AUTH_DEV_CODE`，改用測試金鑰：

```bash
EMAIL_AUTH_SECRET=local-preview-secret \
MAACGO_AUTH='Bearer sk_test_完整測試金鑰' \
npm run dev
```

`sk_test_` 只會在 MAAC Go 留下寄送紀錄，不會把驗證碼送到真實信箱，也不會
產生費用。正式寄送時改用 `sk_live_`；金鑰只放在本機環境或 Sites secret，
不得提交到 Git。

原有的純公開資料預覽仍可使用下列方式：

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

## 多校每日公開紀錄

`scripts/fetch_school_meals.py` 會依 `data/reference/taichung-active-elementary-schools.json` 的教育部查詢代碼，從校園食材登錄平臺公開頁面使用的唯讀接口，依序收集臺中市 29 個行政區、243 所國小的當日或歷史實際供餐紀錄：

```bash
python3 scripts/fetch_school_meals.py --date 2026-10-08 --district 西區
```

只測試單一學校：

```bash
python3 scripts/fetch_school_meals.py --date 2026-10-08 --school 忠信國小
```

每校資料以完整目錄原子替換，保存於：

```text
data/raw/fatrace-daily/YYYY-MM-DD/<fatraceSchoolId>/raw.json
data/raw/fatrace-daily/YYYY-MM-DD/<fatraceSchoolId>/candidate.json
data/raw/fatrace-daily/YYYY-MM-DD/report.json
```

`raw.json` 保存官方接口的完整回應；`candidate.json` 是統一格式的待校讀候選資料。候選資料固定標示 `review.status: pending`，不會自動進入 reviewed `data/parsed/`、SQLite 或公開網站。若官方明確回傳不供餐設定，狀態為 `no_meal`；空菜單且沒有官方原因則標示 `not_published`，不可解讀為今日沒有供餐。既有 `available` 或 `no_meal` 紀錄不會被後續空回應覆蓋。

### 每日操作流程

單校、多校與全市資料都會經過「抓取 → 校讀 → 發布」。發布器會依當次 `report.json` 的學校數量建立批次，可以是 1 校、數校或全市 243 校；批次內不能有抓取失敗，且 `available` 或 `no_meal` 必須有對應的 reviewed JSON。部分批次只會 upsert 該批次的學校紀錄，不會刪除或覆蓋其他學校的資料。

#### 忠信國小：三步驟發布（最常用）

只想直接照做：把下面三行**依序執行**即可。

```bash
python3 scripts/fetch_school_meals.py --date 2026-10-14 --school 忠信國小
python3 scripts/review_school_meals.py --date 2026-10-14
python3 scripts/publish_school_meals.py --date 2026-10-14
```

> 三行的日期必須相同。要處理其他日期時，把三行中的 `2026-10-14` 一起換掉。

每一行在做什麼：

1. **抓取**：`fetch_school_meals.py` 從官方來源下載忠信國小當日午餐，產生待校讀資料；這一步還不會發布。
2. **校讀**：`review_school_meals.py` 檢查抓取結果，並產生可發布的 reviewed JSON；這一步也還不會發布。
3. **發布**：`publish_school_meals.py` 將當次已校讀的資料寫入公開 Site。單校批次只更新該校，不會刪除或覆蓋其他學校的資料。

想在正式發布前先檢查資料，可選擇執行：

```bash
python3 scripts/publish_school_meals.py --date 2026-10-14 --dry-run
```

`--dry-run` 只驗證發布資料，不會寫入公開 Site。正式發布成功時會顯示 `"status": "published"` 與 `"submittedSchools": 1`。

若也要更新本機 SQLite 與 `dist/`，可再執行：

```bash
python3 scripts/build_database.py
python3 -m unittest discover -s tests -v
node --check web/app.js
python3 scripts/build_static_site.py
```

多校流程相同；抓取時可重複使用 `--school 學校名稱`，後續校讀與發布指令不變。

#### 抓取全市後直接發布（正式流程）

完成一次手動發布憑證設定後，使用下列單一指令抓取全市 243 校，並自動完成校讀、測試、建置與發布：

```bash
python3 scripts/update_all_taichung_schools.py --date 2026-10-14 --publish
```

若全市資料已經抓取、校讀並建置完成，可先驗證發布包，再正式發布：

```bash
python3 scripts/publish_school_meals.py --date 2026-10-14 --dry-run
python3 scripts/publish_school_meals.py --date 2026-10-14
```

`--dry-run` 只驗證本機資料，不會寫入公開 Site。正式發布成功時會顯示 `"status": "published"`；重複發布相同內容時為冪等操作，記錄會顯示為 `unchanged`。

> 注意：`fetch_school_meals.py` 每次執行都會以該次的抓取範圍重建當日 `report.json`。發布器只會發布當前報告所列的學校；既有其他學校紀錄不會被刪除。

確認候選資料的學校、日期與內容後，執行結構校讀與晉升：

```bash
python3 scripts/review_school_meals.py --date 2026-10-08
python3 scripts/build_database.py
python3 scripts/build_static_site.py
```

只有 `available` 或官方明確標示的 `no_meal` 才能晉升。流程會核對學校代碼、完整校名、來源網址日期、供餐批次、菜色、食材、內容雜湊與校讀資訊；`not_published` 不會進入公開資料。reviewed JSON 保存於 `data/parsed/schools/fatrace/<fatraceSchoolId>/YYYY-MM-DD.json`，並作為 SQLite 與靜態網站的來源真相。

SQLite 會把啟用學校的名冊、供餐日、餐次、菜色、食材與認證拆成關聯資料表；公開網站則提供可擴充的行政區與學校選單。`data/reference/taichung-elementary-schools.json` 保存教育部公開清單中的臺中市 29 個行政區、242 所國小及 School ID，`data/reference/taichung-elementary-schools.md` 則提供方便人工檢查的行政區清單；兩份資料均以一次行政區查詢與一次全市國小名冊查詢整理，沒有逐號掃描 School ID。`data/reference/taichung-active-elementary-schools.json` 是網站目前啟用的名冊，另納入教育部分類為「高中職／五專」的臺中市南區私立明德高中附設國小，因此共涵蓋 29 個行政區、243 所學校。使用者可把一間學校設為「我的最愛」並保存在自己的瀏覽器；下次進站只會優先讀取那間學校。沒有設定最愛時，網站停在選校畫面，不會先讀取任何學校的午餐資料。忠信國小保留校方週菜單、營養分析、葷素餐與家庭晚餐建議等完整體驗；其餘學校目前顯示教育部同日實際供餐公開紀錄。同日的主食、主菜中若同時出現有「素」字與未標示「素」的菜色，網站會開放葷食／素食切換：主食、主菜與副菜依名稱的「素」字分組，蔬菜、湯品與附餐列為共用。這只是方便閱讀的菜名分組，不等同素食認證，仍須以官方食材明細判斷內容。指定日期沒有紀錄時不會退回較早日期冒充今天。

平常可用一條指令完成收集、校讀、資料庫重建、測試、JavaScript 檢查與靜態網站重建：

```bash
python3 scripts/update_school_meals.py --date 2026-10-08 --verify-and-build
```

若要一次收集啟用名冊中的全臺中市 29 個行政區、243 所學校，並自動完成上述驗證與建置，可執行：

```bash
python3 scripts/update_all_taichung_schools.py
```

指定日期或只先抓菜色的範例：

```bash
python3 scripts/update_all_taichung_schools.py --date 2026-10-08
python3 scripts/update_all_taichung_schools.py --skip-ingredients
```

日期預設為臺北時區當天。完整模式會逐道查詢食材，執行期間請保持網路連線並避免電腦休眠；`--skip-ingredients` 只收集菜色，速度較快。每次執行會把開始、完成時間、總秒數與每校平均秒數寫入當日 `report.json`，並在終端顯示耗時摘要。任一學校收集失敗時指令會以非零狀態結束，不會繼續重建可部署快照；重新執行即可利用已儲存的有效資料再次收集。

若官方尚未發布，指令會以 pending 狀態結束並保留既有有效資料。當日仍有抓取失敗時不會發佈，重新執行即可利用已保存的有效資料補抓。

若全市報告只有少數 `failed`，可只補抓失敗學校並原子合併回原本的完整報告；成功後會自動校讀、重建 SQLite、執行測試、檢查 JavaScript 並重建 `dist/`：

```bash
python3 scripts/update_all_taichung_schools.py --date 2026-10-15 --retry-failed
```

補抓完成後，`report.json` 仍會保留原本全市學校，不會縮成單校報告。若補抓仍失敗，指令會維持非零狀態且不發布；稍後重複相同指令即可。也可在確認本機發布憑證已設定後加上 `--publish`，於補抓、驗證及建置全部成功後直接發布完整批次。

正式發布會先核對當次報告必須為零失敗、reviewed JSON 數量、學校代碼、日期、來源網址與內容雜湊，再以本機 `.secrets/site_publish_token` 的私密憑證透過 HTTPS 寫入 Site 的 D1 與 R2。憑證目錄已被 Git 忽略，指令不會顯示或上傳憑證內容。

`prepare_site_publish.py` 保留給需要更新網站程式碼的 Sites 版本部署；日常午餐資料發佈不再需要 Sites Git 短效憑證或 Codex。

這條每日資料線與每月 OpenAPI 不同。它只代表平臺公開查詢頁當下可見的實際供餐紀錄，不能提供下週預定菜單；下週資料仍須由各校公告、Atom/RSS 或菜單圖片取得。收集器預設使用 20 秒逾時、有限次重試、描述性 User-Agent 與 1.2 秒請求間隔。若只想先驗證菜色、不逐道查詢食材，可加上 `--skip-ingredients`。

### Telegram 抓取通知

雲端三批抓取與下午補抓會透過 Telegram 通知抓取開始、單校失敗、批次結束及全日總結。通知事件會先寫入 D1 的 `telegram_notifications`，用事件鍵避免排程重試造成重複訊息；通知失敗不會中斷午餐資料收集，下一次相同工具呼叫可再次嘗試。

寫入工具以 Sites 提供的已驗證帳號信箱比對 `MCP_OWNER_EMAIL`，避免把每個 Site 都不同的使用者 ID 誤當成全域帳號 ID。15:30 補抓除了重試 `failed` 與 `not_published`，也會接手當天完全沒有執行紀錄的學校。

若官方來源拒絕 Site 雲端出口，可暫時設定 `FATRACE_COLLECTION_PAUSED=true`。三批與補抓工具會回覆安全暫停且不送出來源請求，避免重複 403 與大量錯誤通知；改用可連線的抓取執行環境後再移除此設定。

後端需要下列 Sites 環境變數；實際值只存於 Sites，不得寫入原始碼、排程提示或 `.openai/hosting.json`：

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
EMAIL_AUTH_SECRET
MAACGO_AUTH
RESEND_API_KEY
AUTH_EMAIL_FROM
```

`EMAIL_AUTH_SECRET` 是用來雜湊驗證碼與產生帳號識別的隨機密鑰；優先使用
`MAACGO_AUTH`（`Bearer sk_test_...` 或 `Bearer sk_live_...`）寄送登入驗證碼。
`RESEND_API_KEY` 與 `AUTH_EMAIL_FROM` 保留為備援，且 `AUTH_EMAIL_FROM` 必須是
寄信服務已驗證的寄件者。`EMAIL_AUTH_DEV_CODE` 僅限本機預覽，不得設定在公開 Site。

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
data/reference/taichung-active-elementary-schools.json
data/reference/taichung-elementary-schools.json
data/reference/taichung-elementary-schools.md
data/reference/school-lunch-nutrition-rules.json
data/lunch.db
```

`metadata.json` 會保存文章 ID、標題、網址、發布／更新時間、解析後日期，以及每張圖片的來源網址、本地檔名、Content-Type、位元組數、尺寸和 SHA-256。

`data/parsed/` 是校讀後的結構化來源。`menu.json` 保存每日葷食與素食的菜單總表、營養份數、信心值與可辨識過敏原；`recipe-details.json` 保存每道菜底下的材料、設計用量，以及原表的「初級加工／非基改、在地、安全蔬菜」色塊宣稱。每週另保存菜單總表、葷食用量明細與素食用量明細三張來源圖。校園食材平臺的月資料先校讀成 `traceability.json`；六校同日公開紀錄則保存於 `schools/fatrace/`。原始接口回應或 CSV 不會直接進入網站。`data/reference/school-lunch-nutrition-rules.json` 保存由 109 年 12 月 28 日修訂版官方文件逐頁核對的國小營養建議量、食物內容目標值、階段值與 ±8% 週間容許範圍。`scripts/build_database.py` 會先驗證日期、餐別、必填欄位、關聯及重複資料，再以原子替換方式產生 `data/lunch.db`。

## 本機 API

- `GET /api/dashboard?date=2026-10-01&mealType=meat&schoolId=193609`：忠信國小完整菜單；其他六校代碼回傳該校同日官方實際供餐紀錄
- `GET /api/schools`：只回傳行政區與學校名冊，供尚未選校時建立選單；不回傳午餐內容
- `GET /api/menus`：原始文章與圖片清單
- `GET /api/health`：伺服器狀態

## 建立可發佈的靜態版本

```bash
python3 scripts/build_static_site.py
```

輸出位於 `dist/`，包含手機版網站、葷素兩種結構化資料快照、西區六校已校讀的同日官方紀錄，以及每週的菜單總表、葷食用量明細與素食用量明細原圖。公開版不依賴本機 Python 或 SQLite 服務。

## 抓取策略

1. 以每頁 50 筆讀取 Blogger Atom feed，並跟隨 `rel="next"`。
2. 依文章標題及標籤篩選「菜單及營養素分析」。
3. 從 Atom entry 的文章 HTML 找出實際 `<img>`，優先採用圖片外層連結。
4. 對已知 Blogger 圖片網址使用 `s0` 取得原始尺寸。
5. Feed 不可用時，才從首頁開始跟隨「較舊的文章」分頁。

## 資料品質與限制

- 校園食材平臺 OpenAPI 的每月資料於次月 6 日執行排程，因此無法用來即時確認當月供餐內容。例如 2026 年 9 月資料於 2026 年 10 月 6 日更新，2026 年 10 月資料則於 2026 年 11 月 6 日更新；資料發布後才能回補該日的正式紀錄。
- 若已取得校園食材登錄平臺的同日學校頁面，會先以人工校讀截圖補入當日追溯資料，並保留供餐日期與校讀來源；菜名、食材名稱與設計用量仍以忠信國小餐單及用量明細為準。2026-10-06 原餐單僅寫「水果」，同日平臺頁面已補充為「芭樂」。
- 菜單圖片的中文字體與注音裝飾容易造成 OCR 誤讀，因此目前 7 週的葷食與素食菜名、營養數字、菜內材料與設計用量均經人工視覺校讀；原始明細圖仍保留供逐項核對。
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
