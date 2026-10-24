const MAX_BYTES = 5 * 1024 * 1024;
let nextRequestAt = 0;

export async function dishPhoto(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("dishId") || "";
  if (!/^[1-9]\d{0,19}$/.test(id)) return new Response("Invalid dish ID", { status: 400 });
  const start = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = start + 1000;
  await new Promise(resolve => setTimeout(resolve, Math.max(0, start - Date.now())));
  try {
    const upstream = await fetch(`https://fatraceschool.k12ea.gov.tw/dish/pic/${id}`, {
      headers: { "User-Agent": "HaoHaoFood/1.0 (+https://haohaofood.cc; school lunch photo viewer)", Accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(15000),
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
    // Some source protections reject data-center requests but allow visitors.
    // Fall back to the same validated official image; never substitute another dish.
    return new Response(null, { status: 302, headers: {
      location: `https://fatraceschool.k12ea.gov.tw/dish/pic/${id}`,
      "cache-control": "no-store",
    } });
  }
}
