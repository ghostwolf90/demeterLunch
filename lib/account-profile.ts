import { accountPlanDetails } from "@/lib/account-plan";

export const MAX_PARENT_NAME_LENGTH = 40;
export const MAX_CHILD_NAME_LENGTH = 40;
export const MAX_NICKNAME_LENGTH = 20;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const subscriptionLabels: Record<string, string> = {
  active: "訂閱使用中",
  trialing: "試用中",
  past_due: "付款待處理",
  canceled: "已取消",
  expired: "已到期",
};

export function preferredProfileName(
  name: string | null | undefined,
  nickname: string | null | undefined,
  fallback: string,
) {
  return nickname?.trim() || name?.trim() || fallback;
}

export function normalizeOptionalProfileText(value: unknown, maximum: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : null;
}

export function accountSubscriptionDetails(
  planValue: string | null | undefined,
  statusValue: string | null | undefined,
  periodEnd: string | null | undefined,
  cancelAtPeriodEnd: boolean,
) {
  const plan = accountPlanDetails(planValue);
  if (plan.id === "free") {
    return {
      status: "free",
      statusLabel: "免費使用中",
      renewsAt: null,
      cancelAtPeriodEnd: false,
      message: "目前使用免費方案。",
    };
  }

  const status = Object.hasOwn(subscriptionLabels, statusValue || "")
    ? statusValue as keyof typeof subscriptionLabels
    : "active";
  const renewsAt = /^\d{4}-\d{2}-\d{2}/.test(periodEnd || "") ? periodEnd as string : null;
  const periodLabel = plan.billingPeriod === "year" ? "年繳" : "月繳";
  let message = `${periodLabel}方案${subscriptionLabels[status]}。`;
  if (renewsAt) {
    const date = renewsAt.slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3");
    message = cancelAtPeriodEnd
      ? `已停止續訂，可使用至 ${date}。`
      : `下次續訂日 ${date}。`;
  }
  return {
    status,
    statusLabel: subscriptionLabels[status],
    renewsAt,
    cancelAtPeriodEnd,
    message,
  };
}

export function avatarExtension(contentType: string, bytes: Uint8Array) {
  if (
    contentType === "image/jpeg"
    && bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return "jpg";
  if (
    contentType === "image/png"
    && bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return "png";
  if (
    contentType === "image/webp"
    && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  return null;
}
