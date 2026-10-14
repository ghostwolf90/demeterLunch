export class ManualPublishAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function authorizeManualPublisher(
  request: Request,
  configuredToken: string | undefined,
) {
  const expected = configuredToken?.trim() || "";
  if (expected.length < 32) {
    throw new ManualPublishAuthError("Site 尚未設定手動發佈憑證", 503);
  }
  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided || !(await constantTimeEqual(provided, expected))) {
    throw new ManualPublishAuthError("手動發佈憑證無效", 403);
  }
}

async function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let different = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    different |= leftBytes[index] ^ rightBytes[index];
  }
  return different === 0;
}
