/* Public meal photos only: bounded, page-memory cache; no browser storage. */
(function (root) {
  "use strict";
  const cache = new Map();
  const pending = new Map();
  const waiting = new Map();
  const maxBytes = 12 * 1024 * 1024;
  const maxPhotoBytes = 5 * 1024 * 1024;
  let bytes = 0;
  const observer = root.IntersectionObserver ? new root.IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const start = waiting.get(entry.target);
      waiting.delete(entry.target);
      observer.unobserve(entry.target);
      start?.();
    }
  }, { rootMargin: "200px" }) : null;

  function remember(id, blob) {
    const url = root.URL.createObjectURL(blob);
    cache.set(id, { url, size: blob.size, expires: Date.now() + 3600000 });
    bytes += blob.size;
    while (cache.size > 32 || bytes > maxBytes) {
      const key = cache.keys().next().value;
      const old = cache.get(key);
      cache.delete(key);
      bytes -= old.size;
      root.URL.revokeObjectURL(old.url);
    }
    return url;
  }

  function attach(image, id) {
    let active = true;
    let subscription = null;
    const fail = () => { if (active) image.onerror?.(); };
    const start = () => {
      if (!active) return;
      const stored = cache.get(id);
      if (stored && stored.expires > Date.now()) {
        cache.delete(id); cache.set(id, stored);
        image.src = stored.url;
        return;
      }
      if (stored) {
        cache.delete(id); bytes -= stored.size;
        root.URL.revokeObjectURL(stored.url);
      }
      let request = pending.get(id);
      if (!request) {
        request = { controller: new root.AbortController(), listeners: new Set() };
        pending.set(id, request);
        const current = request;
        current.promise = root.fetch(`/api/dish-photo?dishId=${encodeURIComponent(id)}`, {
          signal: current.controller.signal, credentials: "omit", cache: "force-cache",
        }).then(async response => {
          if (!response.ok) throw new Error("Photo unavailable");
          const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
          if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Invalid photo");
          const blob = await response.blob();
          if (!blob.size || blob.size > maxPhotoBytes) throw new Error("Invalid photo size");
          if (!current.listeners.size) return;
          const url = remember(id, blob);
          for (const listener of current.listeners) listener.success(url);
        }).catch(error => {
          if (error.name !== "AbortError") for (const listener of current.listeners) listener.failure();
        }).finally(() => { if (pending.get(id) === current) pending.delete(id); });
      }
      const listener = { success: url => { if (active) image.src = url; }, failure: fail };
      request.listeners.add(listener);
      subscription = { request, listener };
    };
    if (!/^[1-9]\d{0,19}$/.test(String(id))) fail();
    else if (observer && image.loading === "lazy" && !cache.has(id)) {
      waiting.set(image, start); observer.observe(image);
    } else start();
    return () => {
      active = false;
      waiting.delete(image); observer?.unobserve(image);
      if (subscription) {
        const { request, listener } = subscription;
        request.listeners.delete(listener);
        if (!request.listeners.size && pending.get(id) === request) {
          pending.delete(id); request.controller.abort();
        }
      }
    };
  }
  root.MealPhotos = { attach };
})(typeof window === "undefined" ? globalThis : window);
