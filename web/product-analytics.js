/* Product events contain public menu context only; never family/profile data. */
(function (root) {
  "use strict";
  const viewed = new Set();
  const pending = new Map();
  const allowed = new Set(["school_selected", "lunch_viewed", "dinner_idea_viewed", "sign_up", "menu_shared"]);
  let signupRequest = null;

  function event(name, context = {}) {
    if (!allowed.has(name) || typeof root.gtag !== "function") return false;
    const params = {};
    for (const key of ["school_id", "menu_date", "meal_type", "data_source", "selection_source", "method"]) {
      if (typeof context[key] === "string") params[key] = context[key];
    }
    try { root.gtag("event", name, params); return true; }
    catch { return false; } // Analytics must never interrupt a product action.
  }

  const observer = typeof root.IntersectionObserver === "function"
    ? new root.IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = pending.get(entry.target);
        if (!item) continue;
        item.visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        flush(entry.target, item);
      }
    }, { threshold: [0, 0.25] }) : null;

  function flush(element, item) {
    if (!item.visible || root.document.visibilityState !== "visible"
      || element.hidden || !element.getClientRects().length) return;
    if (!viewed.has(item.key) && event(item.name, item.context)) viewed.add(item.key);
  }

  function watch(element, name, context) {
    if (!element) return;
    observer?.unobserve(element);
    pending.delete(element);
    if (!context || !observer) return;
    const key = `${name}:${context.school_id}:${context.menu_date}:${context.meal_type}`;
    // Re-observe even after a redraw: an old observer notification must not count new content.
    pending.set(element, { name, context: { ...context }, key, visible: false });
    observer.observe(element);
  }

  root.document.addEventListener("visibilitychange", () => {
    for (const [element, item] of pending) flush(element, item);
  });

  function emailSignup(payload) {
    if (payload?.isNewAccount === true) event("sign_up", { method: "email" });
  }

  async function lineSignup() {
    if (signupRequest) return signupRequest;
    signupRequest = (async () => {
      try {
        const response = await root.fetch("/api/auth/registration-event", {
          method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        });
        if (response.ok && (await response.json()).isNewAccount === true) event("sign_up", { method: "line" });
      } catch { /* Registration remains successful when analytics is unavailable. */ }
    })();
    try { await signupRequest; } finally { signupRequest = null; }
  }

  async function shareMenu(context) {
    const url = new URL("/", root.location.origin);
    url.searchParams.set("school", context.school_id);
    url.searchParams.set("date", context.menu_date);
    url.searchParams.set("meal", context.meal_type);
    url.hash = "today";
    if (typeof root.navigator.share === "function") {
      await root.navigator.share({ title: "好好吃飯｜孩子午餐，晚餐靈感", url: url.href });
      event("menu_shared", { ...context, method: "native_share" });
      return "shared";
    }
    if (typeof root.navigator.clipboard?.writeText !== "function") throw new Error("目前無法分享，請使用瀏覽器的分享功能。");
    await root.navigator.clipboard.writeText(url.href);
    event("menu_shared", { ...context, method: "copy_link" });
    return "copied";
  }

  root.ProductAnalytics = { event, watch, emailSignup, lineSignup, shareMenu };
})(window);
