import { env } from "cloudflare:workers";
import {
  MAX_AVATAR_BYTES,
  avatarExtension,
} from "@/lib/account-profile";
import {
  accountDatabase,
  authRequired,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";

type AvatarRow = { avatar_key: string | null };

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  const target = avatarTarget(new URL(request.url));
  if (target.error) return privateJson({ error: target.error }, { status: 400 });

  try {
    const row = await findAvatar(user.id, target.childId);
    if (!row?.avatar_key) return privateJson({ error: "尚未設定大頭貼" }, { status: 404 });
    const object = await avatarBucket().get(row.avatar_key);
    if (!object) return privateJson({ error: "大頭貼檔案不存在" }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Unable to load account avatar", error);
    return privateJson({ error: "大頭貼暫時無法讀取" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return privateJson({ error: "照片資料格式不正確" }, { status: 400 });
  }
  const target = avatarTargetFromForm(form);
  if (target.error) return privateJson({ error: target.error }, { status: 400 });
  const upload = form.get("avatar");
  if (!(upload instanceof File) || !upload.size || upload.size > MAX_AVATAR_BYTES) {
    return privateJson({ error: "請選擇 2MB 以內的 JPG、PNG 或 WebP 照片" }, { status: 400 });
  }
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const extension = avatarExtension(upload.type, bytes);
  if (!extension) {
    return privateJson({ error: "照片格式不支援，請使用 JPG、PNG 或 WebP" }, { status: 400 });
  }

  const db = accountDatabase();
  const previous = await findAvatar(user.id, target.childId);
  if (!previous) return privateJson({ error: "找不到要更新的個人資料" }, { status: 404 });
  const key = `account-avatars/${await ownerPartition(user.id)}/${crypto.randomUUID()}.${extension}`;
  const now = new Date().toISOString();
  const bucket = avatarBucket();
  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: upload.type, cacheControl: "private, max-age=3600" },
      customMetadata: { owner: await ownerPartition(user.id) },
    });
    const result = target.childId === null
      ? await db.prepare(
          "UPDATE parent_accounts SET avatar_key = ?, updated_at = ? WHERE auth_user_id = ?",
        ).bind(key, now, user.id).run()
      : await db.prepare(
          "UPDATE child_profiles SET avatar_key = ?, updated_at = ? WHERE id = ? AND auth_user_id = ?",
        ).bind(key, now, target.childId, user.id).run();
    if (!result.meta.changes) {
      await bucket.delete(key);
      return privateJson({ error: "找不到要更新的個人資料" }, { status: 404 });
    }
    if (previous.avatar_key && previous.avatar_key !== key) {
      await bucket.delete(previous.avatar_key).catch(() => undefined);
    }
    return privateJson({ ok: true });
  } catch (error) {
    await bucket.delete(key).catch(() => undefined);
    console.error("Unable to update account avatar", error);
    return privateJson({ error: "大頭貼暫時無法儲存" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAccountUser(request);
  if (!user) return authRequired();
  if (!isSameOriginMutation(request)) return forbiddenMutation();
  const target = avatarTarget(new URL(request.url));
  if (target.error) return privateJson({ error: target.error }, { status: 400 });

  try {
    const previous = await findAvatar(user.id, target.childId);
    if (!previous) return privateJson({ error: "找不到要更新的個人資料" }, { status: 404 });
    const now = new Date().toISOString();
    const db = accountDatabase();
    if (target.childId === null) {
      await db.prepare(
        "UPDATE parent_accounts SET avatar_key = NULL, updated_at = ? WHERE auth_user_id = ?",
      ).bind(now, user.id).run();
    } else {
      await db.prepare(
        "UPDATE child_profiles SET avatar_key = NULL, updated_at = ? WHERE id = ? AND auth_user_id = ?",
      ).bind(now, target.childId, user.id).run();
    }
    if (previous.avatar_key) await avatarBucket().delete(previous.avatar_key).catch(() => undefined);
    return privateJson({ ok: true });
  } catch (error) {
    console.error("Unable to remove account avatar", error);
    return privateJson({ error: "大頭貼暫時無法移除" }, { status: 503 });
  }
}

function avatarTarget(url: URL): { childId: number | null; error?: string } {
  const rawChildId = url.searchParams.get("childId");
  if (!rawChildId) return { childId: null };
  const childId = Number(rawChildId);
  return Number.isInteger(childId) && childId > 0
    ? { childId }
    : { childId: null, error: "孩子資料格式不正確" };
}

function avatarTargetFromForm(form: FormData) {
  const scope = form.get("scope");
  if (scope === "parent") return { childId: null };
  if (scope !== "child") return { childId: null, error: "大頭貼類型不正確" };
  const childId = Number(form.get("childId"));
  return Number.isInteger(childId) && childId > 0
    ? { childId }
    : { childId: null, error: "孩子資料格式不正確" };
}

async function findAvatar(authUserId: string, childId: number | null) {
  const db = accountDatabase();
  return childId === null
    ? db.prepare(
        "SELECT avatar_key FROM parent_accounts WHERE auth_user_id = ? LIMIT 1",
      ).bind(authUserId).first<AvatarRow>()
    : db.prepare(
        "SELECT avatar_key FROM child_profiles WHERE id = ? AND auth_user_id = ? LIMIT 1",
      ).bind(childId, authUserId).first<AvatarRow>();
}

async function ownerPartition(authUserId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(authUserId));
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function avatarBucket() {
  if (!env.BUCKET) throw new Error("Avatar storage is not configured");
  return env.BUCKET;
}
