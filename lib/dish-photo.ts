const MAX_BYTES = 5 * 1024 * 1024;
let nextRequestAt = 0;
let unavailableUntil = 0;
const inFlight = new Map<string, Promise<Response>>();

export async function dishPhoto(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("dishId") || "";
  if (!/^[1-9]\d{0,19}$/.test(id)) return new Response("Invalid dish ID", { status: 400 });
  const officialUrl = `https://fatraceschool.k12ea.gov.tw/dish/pic/${id}`;
  const fallback = () => new Response(null, { status: 302, headers: {
    location: officialUrl, "cache-control": "public, max-age=300",
  } });
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const cacheKey = new Request(new URL(`/api/dish-photo?dishId=${id}`, request.url));
  if (cache) {
    try { const cached = await cache.match(cacheKey); if (cached) return cached; } catch { /* Cache failure must not block a photo. */ }
  }
  const pending = inFlight.get(id);
  if (pending) return (await pending).clone();
  // Preserve source request spacing without making visitors queue behind other photos.
  if (Date.now() < nextRequestAt || Date.now() < unavailableUntil) return fallback();
  nextRequestAt = Date.now() + 1000;
  const operation = fetchPhoto(officialUrl, fallback);
  inFlight.set(id, operation);
  try {
    const response = await operation;
    if (cache) { try { await cache.put(cacheKey, response.clone()); } catch { /* Delivery still succeeds. */ } }
    return response.clone();
  } finally { inFlight.delete(id); }
}

async function fetchPhoto(officialUrl: string, fallback: () => Response): Promise<Response> {
  try {
    const upstream = await fetch(officialUrl, {
      headers: { "User-Agent": "HaoHaoFood/1.0 (+https://haohaofood.cc; school lunch photo viewer)", Accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(2500),
      redirect: "error",
    });
    if (!upstream.ok || !upstream.body) throw new Error("Photo unavailable");
    const type = (upstream.headers.get("content-type") || "").split(";")[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
      await upstream.body.cancel();
      throw new Error("Invalid photo type");
    }
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Photo too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const valid = type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/png" ? [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) throw new Error("Invalid photo bytes");
    return new Response(bytes, { headers: {
      "content-type": type, "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    } });
  } catch {
    // A source that rejects data-center requests should not be probed for every thumbnail.
    unavailableUntil = Date.now() + 60000;
    return fallback();
  }
}
