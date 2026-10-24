/* Device-only language preference. No account or source data is persisted here. */
(function (root) {
  "use strict";
  const KEY = "demeter-language";
  const supported = ["zh-Hant", "en"];
  function resolve(saved, languages) {
    if (supported.includes(saved)) return saved;
    for (const language of languages || []) {
      const tag = String(language).toLowerCase();
      if (/^en(?:-|$)/.test(tag)) return "en";
      if (/^zh(?:-|$)/.test(tag)) return "zh-Hant";
    }
    return "zh-Hant";
  }
  let saved = null;
  try { saved = root.localStorage.getItem(KEY); } catch { /* Storage may be disabled. */ }
  if (!supported.includes(saved)) saved = null;
  let language = resolve(saved, root.navigator?.languages?.length ? root.navigator.languages : [root.navigator?.language || ""]);
  const dictionary = root.LunchEnglish || {};
  const templates = root.LunchEnglishTemplates || [];
  const patterns = templates.map(([source, english]) => {
    const parts = source.split(/(\{\d+\})/);
    const expression = parts.map((part, index) => /^\{\d+\}$/.test(part)
      ? (/^ (?:道|項|位|個|天|筆|份)/.test(parts[index + 1] || "") ? "([\\d,.]+(?:[–-][\\d,.]+)?)" : "([\\s\\S]*?)")
      : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
    return [new RegExp(`^${expression}$`), english, source];
  });
  const labelSlots = {
    "⚠ {0}需留意：{1}。這天已取得的菜單或食材資料中有相符項目；請再向校方確認實際食材與製程。": [1],
    "{0} · {1}/{2} 位孩子": [0],
    "{0} · 家長資料、孩子設定與目前方案": [],
    "開啟{0}的孩子設定{1}": [1],
    "查看{0}「{1}」的食材與設計用量": [0],
    "查看{0}「{1}」的官方食材紀錄": [0],
    "{0}食譜用量明細": [0],
    "{0}午餐": [0],
    "當時記下的感受：{0}": [0],
    "原圖標示／菜名可辨識的過敏原：{0}": [0],
    "留意過敏原：{0}": [0],
    "{0}官方公開 {1} 道菜 · {2} 項食材紀錄": [0],
    "{0}{1} 道官方公開菜色": [0],
    "{0}校方完整菜單＋同日教育部食材紀錄。": [0],
    "{0}{1} 道菜、{2} 項食材，來自同日教育部公開紀錄。": [0],
    "健康小常識 · {0}": [0],
    "{0}低於所選基準，先回原始菜單核對供應設計。": [0],
    "{0}高於所選基準；這是供應觀察，不代表個別孩子攝取過量。": [0],
    "{0}落在所選{1}基準範圍。": [0, 1],
    "{0}低於所選{1}基準範圍。": [0, 1],
    "{0}高於所選{1}基準範圍。": [0, 1],
    "基準至少 {0}": [0],
    "基準 {0}": [0],
    "校方安排 {0}": [0],
    "{0} · 判讀含 ±{1}%": [0],
    "{0}（星期二、星期四）": [0],
    "{0} · {1} 個供餐日 · {2}": [2],
    "{0}方案{1}。": [0, 1],
    "{0}第 {1} 週 · {2}–{3}": [0],
  };
  const dateSlots = {
    "最近查核：{0} · 歷史消息保留於完整列表": [0],
    "最近更新：{0} · 僅整理近 {1} 天": [0],
    "指定日期沒有供餐資料，先顯示最近的 {0}。": [0],
    "目前示範 {0}至{1}的已校讀菜單；溯源卡保留實際資料日期，不代表今日食材、產地、供應商或批次。": [0, 1],
    "功能範例 · {0}": [0],
    "效期至 {0}": [0],
  };
  function dateText(text) {
    const match = text.match(/^(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*(?:星期|週)([一二三四五六日]))?$/);
    if (!match) return text;
    const [, year, month, day, weekday] = match;
    if (+month < 1 || +month > 12 || +day < 1 || +day > 31) return text;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const days = { 一: "Mon", 二: "Tue", 三: "Wed", 四: "Thu", 五: "Fri", 六: "Sat", 日: "Sun" };
    return `${months[Number(month) - 1]} ${Number(day)}${year ? `, ${year}` : ""}${weekday ? ` (${days[weekday]})` : ""}`;
  }
  function english(text) {
    if (Object.hasOwn(dictionary, text)) return dictionary[text];
    const date = dateText(text);
    if (date !== text) return date;
    for (const [pattern, result, source] of patterns) {
      const match = text.match(pattern);
      if (match) return result.replace(/\{(\d+)\}/g, (_, index) => {
        const value = match[Number(index) + 1];
        if (labelSlots[source]?.includes(Number(index))) return labels(value);
        return dateSlots[source]?.includes(Number(index)) ? dateText(value) : value;
      });
    }
    const list = text.split("、");
    if (list.length > 1 && list.every(part => Object.hasOwn(dictionary, part))) {
      return list.map(part => dictionary[part]).join(", ");
    }
    return text;
  }
  function labels(text) {
    return text.split(/( · |、)/).map(part => english(part)).join("");
  }
  function t(value) {
    const text = String(value ?? "");
    if (language !== "en") return text;
    if (Object.hasOwn(dictionary, text)) return dictionary[text];
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return match[1] + english(match[2]) + match[3];
  }
  const api = { resolve, t, get language() { return language; }, get locale() { return language === "en" ? "en-US" : "zh-TW"; } };
  root.LunchI18n = api;
  if (!root.document) return;
  const doc = root.document;
  const originals = new WeakMap();
  const sourceNodes = new WeakSet();
  const attributeNames = ["aria-label", "title", "placeholder", "alt"];
  const excluded = 'script, style, textarea, [translate="no"], [data-i18n-keep]';
  function keep(element) {
    if (!element) return element;
    if (element.nodeType === 3) sourceNodes.add(element);
    else for (const child of element.childNodes) keep(child);
    return element;
  }
  api.keep = keep;
  function update(target, key, read, write) {
    const value = read();
    let record = originals.get(target);
    if (!record) { record = {}; originals.set(target, record); }
    if (!record[key] || record[key].output !== value) record[key] = { source: value, output: value };
    const output = t(record[key].source);
    record[key].output = output;
    if (output !== value) write(output);
  }
  function translateTree(node) {
    if (node.nodeType === 3) {
      if (!sourceNodes.has(node) && !node.parentElement?.closest(excluded)) update(node, "text", () => node.nodeValue, value => { node.nodeValue = value; });
      return;
    }
    if (node.nodeType !== 1 || node.closest(excluded)) return;
    for (const name of attributeNames) {
      if (node.hasAttribute(name)) update(node, name, () => node.getAttribute(name), value => node.setAttribute(name, value));
    }
    for (const child of node.childNodes) translateTree(child);
  }
  function syncControls() {
    doc.querySelectorAll("[data-language-select]").forEach(control => { control.value = supported.includes(saved) ? saved : "auto"; });
  }
  function apply() {
    doc.documentElement.lang = language;
    translateTree(doc.documentElement);
    syncControls();
  }
  function select(value) {
    if (value !== "auto" && !supported.includes(value)) return;
    saved = value === "auto" ? null : value;
    try {
      if (saved) root.localStorage.setItem(KEY, saved);
      else root.localStorage.removeItem(KEY);
    } catch { /* Selection still works for this page if storage is disabled. */ }
    language = resolve(saved, root.navigator?.languages?.length ? root.navigator.languages : [root.navigator?.language || ""]);
    apply();
    root.dispatchEvent(new CustomEvent("demeterlanguagechange", { detail: { language } }));
  }
  api.select = select;
  api.translateTree = translateTree;
  doc.documentElement.lang = language;
  // Parser additions and later renders are handled before the next paint. Source and family data opt out explicitly.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach(translateTree);
      else translateTree(record.target);
    }
    syncControls();
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributeNames });
  doc.addEventListener("change", event => {
    if (event.target.matches("[data-language-select]")) select(event.target.value);
  });
  doc.addEventListener("DOMContentLoaded", apply, { once: true });
  root.addEventListener("languagechange", () => { if (!saved) { language = resolve(null, root.navigator.languages || [root.navigator.language]); apply(); root.dispatchEvent(new CustomEvent("demeterlanguagechange")); } });
  root.addEventListener("storage", event => {
    if (event.key !== KEY && event.key !== null) return;
    saved = event.key === null ? null : event.newValue;
    if (!supported.includes(saved)) saved = null;
    language = resolve(saved, root.navigator.languages || [root.navigator.language]);
    apply();
    root.dispatchEvent(new CustomEvent("demeterlanguagechange"));
  });
})(typeof window === "undefined" ? globalThis : window);
