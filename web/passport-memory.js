/* Private family memories: no browser persistence, generated claims or public export. */
(function (root) {
  "use strict";
  const experiences = {
    unrecorded: "未記錄接觸方式", not_tried: "尚未嘗試", not_eaten: "沒有吃", seen: "看了看",
    smelled: "聞了聞", touched: "碰了碰", tasted: "嚐了一口", ate_some: "吃了一些",
    ate_most: "吃了大部分", finished: "吃完了", ate_unknown: "有吃，但不記得多少",
    unknown: "不確定／孩子沒提到", accepted: "曾記為接受", liked: "曾記為喜歡",
  };
  const reactions = { loved: "很喜歡", liked: "喜歡", okay: "還好", less_liked: "不太喜歡", disliked: "不喜歡",
    wants_more: "還想吃", willing_retry: "願意再試", avoid_next_time: "下次先不要", no_comment: "沒有特別說", other: "其他感受" };
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action) {
    const node = el("button", text); node.type = "button"; node.addEventListener("click", action); return node;
  }
  function origin(item) {
    if (item.mealContext === "other") return "家裡／其他地方";
    return item.mealContext === "school_lunch" && item.dishName ? `來源菜色：${item.dishName}` : "舊紀錄未記錄菜色來源";
  }
  async function json(response) {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "目前無法讀取紀錄，請稍後再試。");
    return body;
  }
  function memoryCard(item) {
    const card = el("article", undefined, "memory-card");
    card.append(LunchI18n.keep(el("h4", item.foodName)), el("p", `${item.mealDate} · ${origin(item)}`, "memory-context"));
    if (item.childQuote) card.append(el("p", "孩子原話", "memory-label"), LunchI18n.keep(el("blockquote", item.childQuote)));
    if (item.note) card.append(el("p", "家長筆記", "memory-label"), LunchI18n.keep(el("p", item.note)));
    if (item.experience && item.experience !== "unrecorded") card.append(el("p", experiences[item.experience] || "未記錄接觸方式"));
    const feelings = (item.reactions || []).map(value => reactions[value]).filter(Boolean);
    if (feelings.length) card.append(el("p", `當時記下的感受：${feelings.join("、")}`));
    if (item.preparation) card.append(el("p", `做法：${item.preparation}`));
    return card;
  }
  function actions(item, childId, onChange) {
    const group = el("div", undefined, "memory-actions memory-record-actions");
    const editButton = button("修改紀錄", event => edit(item, childId, onChange, event.currentTarget));
    editButton.setAttribute("aria-label", `修改「${item.foodName}」的紀錄`);
    group.append(editButton);
    return group;
  }
  function edit(item, childId, onChange, trigger) {
    const dialog = el("dialog", undefined, "memory-editor");
    dialog.setAttribute("aria-labelledby", "memoryEditTitle");
    const form = el("form");
    const title = el("h3", `修改「${item.foodName}」的紀錄`); title.id = "memoryEditTitle";
    form.append(title, el("p", `${item.mealDate} · ${origin(item)}`, "memory-context"),
      el("p", "原話與家長觀察分開保存；日期、學校與來源菜色會保留。"));
    function field(text, value, max) {
      const label = el("label", text); const input = el("textarea"); input.maxLength = max; input.rows = 3; input.value = value || "";
      label.append(input); form.append(label); return input;
    }
    const quote = field("孩子原話", item.childQuote, 160);
    const note = field("家長筆記", item.note, 240);
    const experienceLabel = el("label", "接觸方式"); const experience = el("select");
    for (const [value, label] of Object.entries(experiences)) { const option = el("option", label); option.value = value; experience.append(option); }
    experience.value = item.experience || "unrecorded"; experienceLabel.append(experience); form.append(experienceLabel);
    const feelings = el("fieldset"); feelings.append(el("legend", "當時的感受（可不填）"));
    const inputs = Object.entries(reactions).map(([value, label]) => {
      const wrap = el("label", label); const input = el("input"); input.type = "checkbox"; input.value = value;
      input.checked = (item.reactions || []).includes(value); wrap.prepend(input); feelings.append(wrap); return input;
    });
    const status = el("p"); status.setAttribute("role", "status");
    const controls = el("div", undefined, "memory-actions");
    const save = el("button", "儲存修改"); save.type = "submit";
    const remove = button("刪除這筆紀錄", () => { confirmation.hidden = false; confirmDelete.focus(); });
    const cancel = button("取消", () => dialog.close());
    controls.append(save, cancel, remove);
    const confirmation = el("div", undefined, "memory-delete-confirm"); confirmation.hidden = true;
    confirmation.append(el("p", "確定刪除這筆紀錄？刪除後無法復原。"));
    const confirmDelete = button("確定刪除", () => mutate("DELETE"));
    confirmation.append(confirmDelete, button("保留紀錄", () => { confirmation.hidden = true; remove.focus(); }));
    let busy = false;
    async function mutate(method) {
      if (busy) return;
      const selected = inputs.filter(input => input.checked).map(input => input.value);
      if (method !== "DELETE" && selected.includes("no_comment") && selected.length > 1) {
        status.textContent = "「沒有特別說」不能和其他感受一起選擇。"; return;
      }
      busy = true; [save, remove, cancel, confirmDelete].forEach(node => { node.disabled = true; });
      status.textContent = "正在儲存…";
      try {
        await json(await fetch("/api/account/encounters", { method, credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: item.id, childId, childQuote: quote.value, note: note.value, experience: experience.value, reactions: selected }) }));
        dialog.close(); await onChange();
        const anchor = document.getElementById("passportHistoryTitle") || document.getElementById("recordsTitle");
        if (anchor && !anchor.hidden) { anchor.tabIndex = -1; anchor.focus({ preventScroll: true }); }
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; [save, remove, cancel, confirmDelete].forEach(node => { node.disabled = false; }); }
    }
    form.addEventListener("submit", event => { event.preventDefault(); void mutate("PATCH"); });
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    dialog.addEventListener("click", event => { if (event.target === dialog && !busy) dialog.close(); });
    dialog.addEventListener("close", () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
    form.append(feelings, status, controls, confirmation); dialog.append(form); document.body.append(dialog); dialog.showModal(); quote.focus();
  }
  function clear() {
    const saved = document.getElementById("passportSavedMemory");
    if (saved) { saved.hidden = true; saved.replaceChildren(); }
    document.querySelectorAll(".memory-editor").forEach(dialog => dialog.close());
  }
  function saved(item, childId, onChange) {
    const section = document.getElementById("passportSavedMemory"); if (!section) return;
    section.hidden = false; section.replaceChildren(el("h3", "這一刻，留下來了"));
    const card = memoryCard(item); card.append(actions(item, childId, async () => { section.hidden = true; section.replaceChildren(); await onChange(); }));
    section.append(card, button("完成", () => { section.hidden = true; section.replaceChildren(); })); section.focus({ preventScroll: true });
  }
  root.PassportMemory = { actions, clear, saved };
})(typeof window === "undefined" ? globalThis : window);
