const refs = {
  refreshButton: document.querySelector("#refreshButton"),
  pageStatus: document.querySelector("#pageStatus"),
  overallStatus: document.querySelector("#overallStatus"),
  checkedAt: document.querySelector("#checkedAt"),
  scheduleStatus: document.querySelector("#scheduleStatus"),
  scheduleTime: document.querySelector("#scheduleTime"),
  sourceMonth: document.querySelector("#sourceMonth"),
  datasetCount: document.querySelector("#datasetCount"),
  ingredientCount: document.querySelector("#ingredientCount"),
  schoolDayCount: document.querySelector("#schoolDayCount"),
  warningPanel: document.querySelector("#warningPanel"),
  warningList: document.querySelector("#warningList"),
  pipeline: document.querySelector("#pipeline"),
  datasetRows: document.querySelector("#datasetRows"),
  downloadSize: document.querySelector("#downloadSize"),
  databaseDetails: document.querySelector("#databaseDetails"),
  staticDetails: document.querySelector("#staticDetails"),
  secretDetails: document.querySelector("#secretDetails"),
  deploymentDetails: document.querySelector("#deploymentDetails"),
  runUpdateButton: document.querySelector("#runUpdateButton"),
  copyPublishButton: document.querySelector("#copyPublishButton"),
  actionStatus: document.querySelector("#actionStatus"),
  actionLog: document.querySelector("#actionLog"),
  actionOutput: document.querySelector("#actionOutput"),
};

let actionToken = "";
let actionPollTimer = null;

const number = new Intl.NumberFormat("zh-TW");
const dateTime = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : dateTime.format(parsed);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value;
  let unit = "B";
  for (const candidate of units) {
    size /= 1024;
    unit = candidate;
    if (size < 1024) break;
  }
  return `${size.toFixed(size >= 100 ? 0 : 1)} ${unit}`;
}

function setTone(element, good) {
  element.classList.toggle("status-good", good);
  element.classList.toggle("status-warning", !good);
}

function renderWarnings(warnings) {
  refs.warningList.replaceChildren();
  refs.warningPanel.hidden = warnings.length === 0;
  warnings.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    refs.warningList.append(item);
  });
}

function pipelineStep(label, detail, good) {
  const item = document.createElement("article");
  item.className = "pipeline-step";
  const state = document.createElement("span");
  state.className = `step-state ${good ? "status-good" : "status-warning"}`;
  state.textContent = good ? "正常" : "待確認";
  const title = document.createElement("strong");
  title.textContent = label;
  const description = document.createElement("small");
  description.textContent = detail;
  item.append(state, title, description);
  return item;
}

function renderPipeline(data) {
  const latest = data.latestImport;
  const trace = data.traceability;
  const db = data.database;
  const site = data.staticSite;
  refs.pipeline.replaceChildren(
    pipelineStep("每月排程", data.schedule.summary, data.schedule.status === "ACTIVE"),
    pipelineStep(
      "官方 CSV",
      latest.found ? `${latest.datasetCount} 個資料集` : "尚無下載紀錄",
      latest.found && latest.missingFiles.length === 0,
    ),
    pipelineStep(
      "Reviewed JSON",
      trace.found ? `${trace.schoolDays} 個供餐日` : "尚未建立",
      trace.found,
    ),
    pipelineStep(
      "SQLite",
      db.found && !db.error ? `${number.format(db.traceabilityIngredients)} 筆追溯食材` : "尚未完成",
      db.found && !db.error,
    ),
    pipelineStep(
      "網站資料",
      site.found ? `${site.menuDays} 個菜單日` : "尚未建置",
      site.found,
    ),
  );
}

function renderDatasets(latest) {
  refs.datasetRows.replaceChildren();
  refs.downloadSize.textContent = latest.found
    ? `共 ${formatBytes(latest.totalBytes)}`
    : "尚無資料";
  if (!latest.datasets?.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "尚未找到下載資料集。";
    row.append(cell);
    refs.datasetRows.append(row);
    return;
  }

  latest.datasets.forEach((dataset) => {
    const row = document.createElement("tr");
    const values = [
      dataset.name,
      [dataset.county, dataset.grade].filter(Boolean).join("・"),
      dataset.createdAt || "—",
      formatBytes(dataset.bytes),
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const stateCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `file-state${dataset.available ? "" : " missing"}`;
    badge.textContent = dataset.available ? "檔案完整" : "需要處理";
    stateCell.append(badge);
    row.append(stateCell);
    refs.datasetRows.append(row);
  });
}

function renderDetails(root, rows) {
  root.replaceChildren();
  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    root.append(term, description);
  });
}

function render(data) {
  actionToken = data.actionToken || actionToken;
  const healthy = data.status === "healthy";
  refs.overallStatus.textContent = healthy ? "全部正常" : "需要確認";
  refs.checkedAt.textContent = `檢查於 ${formatDate(data.generatedAt)}`;
  setTone(refs.overallStatus, healthy);

  const scheduleActive = data.schedule.status === "ACTIVE";
  refs.scheduleStatus.textContent = scheduleActive ? "已啟用" : "未啟用";
  refs.scheduleTime.textContent = data.schedule.summary;
  setTone(refs.scheduleStatus, scheduleActive);

  refs.sourceMonth.textContent = data.latestImport.sourceMonth || "尚無資料";
  refs.datasetCount.textContent = data.latestImport.found
    ? `${data.latestImport.datasetCount} 個官方資料集`
    : "—";
  refs.ingredientCount.textContent = data.traceability.found
    ? `${number.format(data.traceability.ingredients)} 筆食材`
    : "尚未建立";
  refs.schoolDayCount.textContent = data.traceability.found
    ? `${number.format(data.traceability.schoolDays)} 個供餐日・${number.format(data.traceability.dishes)} 道菜`
    : "—";

  renderWarnings(data.warnings || []);
  renderPipeline(data);
  renderDatasets(data.latestImport);
  renderDetails(refs.databaseDetails, [
    ["資料庫狀態", data.database.found && !data.database.error ? "正常" : "需要確認"],
    ["追溯來源", data.database.sources == null ? "—" : `${number.format(data.database.sources)} 個`],
    ["追溯日期", data.database.traceabilityDates == null ? "—" : `${number.format(data.database.traceabilityDates)} 天`],
    ["最後更新", formatDate(data.database.updatedAt)],
  ]);
  renderDetails(refs.staticDetails, [
    ["建置狀態", data.staticSite.found ? "完成" : "尚未完成"],
    ["菜單日數", data.staticSite.menuDays == null ? "—" : `${number.format(data.staticSite.menuDays)} 天`],
    ["產生時間", formatDate(data.staticSite.generatedAt)],
  ]);
  renderDetails(refs.secretDetails, [
    ["Access code", data.accessCode.configured ? "已設定" : "未設定"],
    ["檔案權限", data.accessCode.permissionsSecure ? "安全" : "需要確認"],
    ["權限模式", data.accessCode.mode || "—"],
  ]);
  const deployment = data.siteDeployment;
  renderDetails(refs.deploymentDetails, [
    ["發布狀態", deployment.found && deployment.status === "succeeded" ? "已發布" : "待確認"],
    ["資料月份", deployment.sourceMonth || "—"],
    ["版本", deployment.versionNumber == null ? "—" : `第 ${number.format(deployment.versionNumber)} 版`],
    ["發布時間", formatDate(deployment.deployedAt)],
  ]);
}

function renderAction(state) {
  const labels = {
    idle: "尚未執行手動更新。",
    running: "更新執行中，請保持此視窗與伺服器開啟…",
    succeeded: "本機資料已更新並完成驗證；若資料有變更，下一步是發布公開 Site。",
    pending: "官方資料尚未發布，既有資料已保留。",
    failed: "更新失敗，請展開執行紀錄查看原因。",
  };
  refs.actionStatus.textContent = state.message || labels[state.status] || "狀態未知";
  refs.runUpdateButton.disabled = state.status === "running";
  refs.runUpdateButton.textContent = state.status === "running" ? "更新中…" : "下載並整合";
  refs.actionOutput.textContent = state.output || "";
  refs.actionLog.hidden = !state.output;
}

async function fetchActionStatus() {
  const response = await fetch("/api/admin/action", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const state = await response.json();
  renderAction(state);
  if (state.status === "running") {
    if (!actionPollTimer) actionPollTimer = window.setInterval(pollAction, 2000);
  } else if (actionPollTimer) {
    window.clearInterval(actionPollTimer);
    actionPollTimer = null;
    await refresh();
  }
}

async function pollAction() {
  try {
    await fetchActionStatus();
  } catch (error) {
    refs.actionStatus.textContent = `無法讀取執行狀態：${error.message}`;
  }
}

async function runUpdate() {
  const approved = window.confirm(
    "要立即下載上一個月的官方資料嗎？這會重新驗證 CSV、SQLite、測試與網站資料，可能需要幾分鐘。",
  );
  if (!approved) return;
  refs.runUpdateButton.disabled = true;
  refs.actionStatus.textContent = "正在啟動更新…";
  try {
    const response = await fetch("/api/admin/update", {
      method: "POST",
      headers: { "X-Demeter-Admin": actionToken },
    });
    const state = await response.json();
    if (!response.ok && response.status !== 409) {
      throw new Error(state.error || `HTTP ${response.status}`);
    }
    renderAction(state);
    if (!actionPollTimer) actionPollTimer = window.setInterval(pollAction, 2000);
  } catch (error) {
    refs.actionStatus.textContent = `無法啟動更新：${error.message}`;
    refs.runUpdateButton.disabled = false;
  }
}

async function copyPublishRequest() {
  const prompt = "請將 Demeter 已驗證的最新 dist 發布到既有 Site「好好吃飯｜忠信國小午餐助手」。發布前先讀取最新 Site 原始碼，保留遠端自動更新資料，並在成功後更新本機 site-deployment.json。";
  try {
    await navigator.clipboard.writeText(prompt);
    refs.actionStatus.textContent = "發布請求已複製；貼到 Codex 對話即可執行發布。";
  } catch {
    refs.actionStatus.textContent = `請複製這段文字到 Codex：${prompt}`;
  }
}

async function refresh() {
  refs.refreshButton.disabled = true;
  refs.pageStatus.textContent = "正在重新讀取本機資料…";
  try {
    const response = await fetch("/api/admin/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(data);
    refs.pageStatus.textContent = data.status === "healthy"
      ? "所有必要資料均已就緒。"
      : "資料已讀取，部分項目需要確認。";
  } catch (error) {
    refs.pageStatus.textContent = `無法讀取後台狀態：${error.message}`;
    refs.overallStatus.textContent = "讀取失敗";
    setTone(refs.overallStatus, false);
  } finally {
    refs.refreshButton.disabled = false;
  }
}

refs.refreshButton.addEventListener("click", refresh);
refs.runUpdateButton.addEventListener("click", runUpdate);
refs.copyPublishButton.addEventListener("click", copyPublishRequest);
refresh();
fetchActionStatus().catch((error) => {
  refs.actionStatus.textContent = `無法讀取執行狀態：${error.message}`;
});
