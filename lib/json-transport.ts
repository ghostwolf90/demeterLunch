export type JsonObject = Record<string, unknown>;

export function parseJsonPreservingLargeIntegers(
  value: string,
  label: string,
): JsonObject {
  let transformed = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (inString) {
      transformed += character;
      index += 1;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      transformed += character;
      index += 1;
      continue;
    }
    if (character === "-" || (character >= "0" && character <= "9")) {
      const match = value.slice(index).match(
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
      );
      if (match) {
        const numberToken = match[0];
        transformed += isUnsafeIntegerToken(numberToken)
          ? JSON.stringify(numberToken)
          : numberToken;
        index += numberToken.length;
        continue;
      }
    }
    transformed += character;
    index += 1;
  }
  try {
    const parsed: unknown = JSON.parse(transformed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} 必須是物件`);
    }
    return parsed as JsonObject;
  } catch (error) {
    if (error instanceof Error && error.message === `${label} 必須是物件`) throw error;
    throw new Error(`${label} 不是有效 JSON`);
  }
}

function isUnsafeIntegerToken(value: string): boolean {
  if (/[.eE]/.test(value)) return false;
  const digits = value.replace(/^-/, "").replace(/^0+/, "") || "0";
  return digits.length > 16 || (digits.length === 16 && digits > "9007199254740991");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as JsonObject;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
