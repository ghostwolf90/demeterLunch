# OCI 每日菜單收集機

這個部署只負責從校園食材登錄平臺讀取公開資料、驗證並發佈到既有
Site。它不對外提供 HTTP 服務，也不需要開放 80 或 443 port。

## 1. 建立 VM

在 OCI 主控台建立：

- Image：Ubuntu 24.04 ARM64
- Shape：`VM.Standard.A1.Flex`
- 資源：1 OCPU、2 GB RAM
- Boot volume：50 GB
- 網路：可對外連線；僅允許自己 IP 的 SSH/22 入站
- 不開放 80、443 或資料庫 port

保存 OCI 提供的 SSH private key，並確認檔案權限為 `600`。

## 2. 安裝執行環境

VM 需要 Python 3.10+、Node.js 22.13+、Git 與 `flock`。Ubuntu 可先安裝基礎工具，
再依 Node.js 官方安裝方式安裝 Node.js 22：

```bash
sudo apt-get update
sudo apt-get install -y python3 git curl ca-certificates util-linux
python3 --version
node --version
```

將專案 clone 到 VM；若 repository 不是公開的，使用 GitHub read-only deploy key，
不要在 VM 儲存個人 GitHub 密碼。

```bash
sudo install -d -o "$USER" -g "$(id -gn)" /opt/demeter
git clone https://github.com/ghostwolf90/demeterLunch.git /opt/demeter
cd /opt/demeter
```

## 3. 先測試 OCI 出口

先只查一所學校：

```bash
cd /opt/demeter
python3 scripts/fetch_school_meals.py --school 忠信國小
```

即使紀錄是 `not_published`，只要沒有 HTTP 403 或連線錯誤，就代表 OCI
可以讀取官方來源。這一步失敗時不要啟用全市排程。

## 4. 安裝發佈憑證

將現有 `site_publish_token` 安全地複製到 VM；不要把 token 貼到對話、
shell history 或 Git。

```bash
cd /opt/demeter
install -d -m 700 .secrets
install -m 600 /secure/input/site_publish_token .secrets/site_publish_token
```

## 5. 啟用排程

```bash
cd /opt/demeter
sudo ops/oci/install-systemd.sh --repo-dir /opt/demeter --run-user "$USER"
```

排程使用 `Asia/Taipei` 時區：

- 週一至週五 13:07：收集全市 243 校。
- 週一至週五 16:07：只補抓當日 `failed` 或 `not_published` 學校。

兩個排程共用同一把 lock，不會重疊存取官方來源。完成收集後會依序執行結構
校讀、SQLite 重建、Python 測試、JavaScript 語法檢查、`dist/` 重建，
再將可發佈學校分批寫入既有 Site。

## 6. 查看狀態

```bash
systemctl list-timers 'demeter-school-meals-*'
sudo systemctl status demeter-school-meals@main.service
sudo journalctl -u demeter-school-meals@main.service -n 100 --no-pager
sudo journalctl -u demeter-school-meals@retry.service -n 100 --no-pager
```

手動執行全市主批次：

```bash
sudo systemctl start demeter-school-meals@main.service
```

每次抓取的報告另存於
`data/raw/fatrace-daily/YYYY-MM-DD/runs/`，便於在下午補抓覆寫
`report.json` 後仍可核對主批次。

## 7. 只啟用 Atom 菜單排程

若雲端出口被校園食材登錄平臺拒絕，不要安裝全市排程。
可改用不需要發佈憑證的 Atom 專用排程：

```bash
cd /opt/demeter
sudo ops/oci/install-atom-systemd.sh --repo-dir /opt/demeter --run-user "$USER"
```

這個 timer 每天台北時間 06:37 執行 `scripts/fetch_latest.py`，只更新
Blogger Atom 菜單與圖片，不會查詢校園食材登錄平臺，也不會發佈 Site。

```bash
systemctl list-timers 'demeter-menu-atom.timer'
sudo systemctl start demeter-menu-atom.service
sudo journalctl -u demeter-menu-atom.service -n 100 --no-pager
```

