export type TelegramSiteEnv = {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

export type TelegramEvent = {
  eventKey: string;
  mealDate: string;
  eventType: "started" | "problem" | "finished" | "daily_summary";
  message: string;
  jobKey?: string | null;
};

export type TelegramDelivery = {
  eventKey: string;
  status: "sent" | "already_sent" | "failed" | "not_configured";
  messageId?: number;
  error?: string;
};

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
};

export async function deliverTelegramEvent(
  env: TelegramSiteEnv,
  event: TelegramEvent,
): Promise<TelegramDelivery> {
  const db = env.DB;
  if (!db || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { eventKey: event.eventKey, status: "not_configured" };
  }

  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO telegram_notifications (
           event_key, job_key, meal_date, event_type, status, message,
           attempts, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
      )
      .bind(
        event.eventKey,
        event.jobKey ?? null,
        event.mealDate,
        event.eventType,
        event.message,
        now,
        now,
      )
      .run();
    const stored = await db
      .prepare("SELECT status, telegram_message_id FROM telegram_notifications WHERE event_key = ?")
      .bind(event.eventKey)
      .first<{ status: string; telegram_message_id: number | null }>();
    if (stored?.status === "sent") {
      return {
        eventKey: event.eventKey,
        status: "already_sent",
        messageId: stored.telegram_message_id ?? undefined,
      };
    }

    await db
      .prepare(
        `UPDATE telegram_notifications
            SET status = 'sending', attempts = attempts + 1,
                last_error = NULL, updated_at = ?
          WHERE event_key = ?`,
      )
      .bind(now, event.eventKey)
      .run();
    const messageId = await sendTelegramMessage(env, event.message);
    const sentAt = new Date().toISOString();
    await db
      .prepare(
        `UPDATE telegram_notifications
            SET status = 'sent', telegram_message_id = ?, sent_at = ?, updated_at = ?
          WHERE event_key = ?`,
      )
      .bind(messageId, sentAt, sentAt, event.eventKey)
      .run();
    return { eventKey: event.eventKey, status: "sent", messageId };
  } catch (error) {
    const message = safeErrorMessage(error);
    try {
      await db
        .prepare(
          `UPDATE telegram_notifications
              SET status = 'failed', last_error = ?, updated_at = ?
            WHERE event_key = ?`,
        )
        .bind(message, new Date().toISOString(), event.eventKey)
        .run();
    } catch {
      // Data collection must continue even when the notification log is unavailable.
    }
    return { eventKey: event.eventKey, status: "failed", error: message };
  }
}

export async function sendTelegramMessage(env: TelegramSiteEnv, message: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram notification environment is incomplete");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.slice(0, 3_900),
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as TelegramApiResponse;
    if (!response.ok || !payload.ok || !payload.result?.message_id) {
      throw new Error(
        `Telegram rejected the notification (${response.status}): ${payload.description || "unknown error"}`,
      );
    }
    return payload.result.message_id;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatJobStarted(input: {
  mealDate: string;
  label: string;
  total: number;
}) {
  return [
    "🟡 午餐資料抓取開始",
    `日期：${input.mealDate}`,
    `工作：${input.label}`,
    `預計處理：${input.total} 間學校`,
  ].join("\n");
}

export function formatJobProblem(input: {
  mealDate: string;
  label: string;
  school: string;
  error?: string;
}) {
  const detail = input.error ? `\n原因：${input.error.slice(0, 300)}` : "";
  return [
    "⚠️ 午餐資料抓取發生問題",
    `日期：${input.mealDate}`,
    `工作：${input.label}`,
    `學校：${input.school}${detail}`,
    "系統會保留原有資料，並於補抓時再次嘗試。",
  ].join("\n");
}

export function formatJobFinished(input: {
  mealDate: string;
  label: string;
  total: number;
  available: number;
  noMeal: number;
  notPublished: number;
  failed: number;
}) {
  return [
    "✅ 午餐資料抓取結束",
    `日期：${input.mealDate}`,
    `工作：${input.label}`,
    `完成：${input.total} 間`,
    `有供餐：${input.available}｜無供餐：${input.noMeal}`,
    `尚未公布：${input.notPublished}｜失敗：${input.failed}`,
  ].join("\n");
}

export function formatDailySummary(input: {
  mealDate: string;
  checked: number;
  expected: number;
  available: number;
  noMeal: number;
  notPublished: number;
  failed: number;
}) {
  return [
    "📊 今日臺中市國小午餐總結",
    `日期：${input.mealDate}`,
    `已檢查：${input.checked}/${input.expected} 間`,
    `有供餐：${input.available}｜無供餐：${input.noMeal}`,
    `尚未公布：${input.notPublished}｜失敗：${input.failed}`,
    input.failed > 0
      ? "仍有失敗項目，請查看排程狀態。"
      : "今日自動抓取流程已完成。",
  ].join("\n");
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https:\/\/api\.telegram\.org\/bot[^/\s]+/gi, "Telegram API").slice(0, 500);
}
