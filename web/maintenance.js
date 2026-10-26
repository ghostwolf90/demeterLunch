(() => {
  "use strict";
  let pending = false, dialog = null, current = null, previousFocus = null;
  let openFrame = 0, closeTimer = 0, closing = false;
  let previousOverflow = "";
  const dismissed = new Set();
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function closeNotice({ acknowledge = true } = {}) {
    if (!dialog?.open || closing) return;
    if (acknowledge) dismissed.add(dialog.dataset.revision);
    closing = true;
    window.cancelAnimationFrame(openFrame);
    dialog.classList.remove("is-visible");
    const finish = () => {
      window.clearTimeout(closeTimer);
      dialog.removeEventListener("transitionend", onTransitionEnd);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      closing = false;
      showNotice();
    };
    const onTransitionEnd = event => {
      if (event.target === dialog && event.propertyName === "opacity") finish();
    };
    dialog.addEventListener("transitionend", onTransitionEnd);
    closeTimer = window.setTimeout(finish, reducedMotion() ? 200 : 400);
  }

  function createDialog() {
    dialog = document.createElement("dialog");
    dialog.id = "maintenanceNotice";
    dialog.className = "maintenance-dialog";
    dialog.setAttribute("aria-labelledby", "maintenanceNoticeTitle");
    dialog.setAttribute("aria-describedby", "maintenanceNoticeBody");
    const panel = document.createElement("div"); panel.className = "maintenance-dialog-panel";
    const label = document.createElement("p"); label.className = "maintenance-dialog-label"; label.textContent = "好好吃飯 · 網站公告";
    const title = document.createElement("h2"); title.id = "maintenanceNoticeTitle";
    const body = document.createElement("p"); body.id = "maintenanceNoticeBody";
    const time = document.createElement("small"); time.id = "maintenanceNoticeTime";
    const button = document.createElement("button"); button.type = "button"; button.className = "maintenance-dialog-confirm"; button.textContent = "我知道了";
    button.addEventListener("click", () => closeNotice());
    panel.append(label, title, body, time, button); dialog.append(panel);
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeNotice(); });
    let backdropPress = false;
    dialog.addEventListener("pointerdown", event => { backdropPress = event.target === dialog; });
    dialog.addEventListener("click", event => {
      if (backdropPress && event.target === dialog) closeNotice();
      backdropPress = false;
    });
    document.body.append(dialog);
  }

  function showNotice() {
    if (!current || closing || dismissed.has(String(current.id))) return;
    // Wait until an existing family or dish dialog closes before taking focus.
    if (!dialog?.open && document.querySelector("dialog[open]")) return;
    if (!dialog) createDialog();
    if (dialog.dataset.revision === String(current.id) && dialog.open) return;
    dialog.dataset.revision = String(current.id);
    dialog.dataset.severity = current.severity;
    document.getElementById("maintenanceNoticeTitle").textContent = current.title;
    document.getElementById("maintenanceNoticeBody").textContent = current.body;
    document.getElementById("maintenanceNoticeTime").textContent = `更新時間：${new Date(current.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}`;
    if (dialog.open) return;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    dialog.classList.remove("is-visible");
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector("button").focus({ preventScroll: true });
    dialog.getBoundingClientRect();
    openFrame = window.requestAnimationFrame(() => {
      if (dialog.open && !closing) dialog.classList.add("is-visible");
    });
  }

  async function update() {
    if (pending || document.hidden) return;
    pending = true;
    try {
      const response = await fetch("/api/maintenance", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const { announcement } = await response.json();
      current = announcement;
      if (!current) { closeNotice({ acknowledge: false }); return; }
      showNotice();
    } catch { /* Preserve the last confirmed notice during a temporary connection failure. */ }
    finally { pending = false; }
  }
  document.addEventListener("close", event => {
    if (event.target !== dialog) showNotice();
  }, true);
  update();
  window.setInterval(update, 60000);
  document.addEventListener("visibilitychange", update);
})();
