import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverTelegramEvent,
  formatDailySummary,
  formatJobFinished,
  formatJobProblem,
  formatJobStarted,
} from "../lib/telegram.ts";

test("Telegram messages cover start, problem, finish, and daily summary", () => {
  assert.match(
    formatJobStarted({ mealDate: "2026-10-12", label: "第 1 批（81 校）", total: 81 }),
    /抓取開始[\s\S]*第 1 批[\s\S]*81 間/,
  );
  assert.match(
    formatJobProblem({
      mealDate: "2026-10-12",
      label: "第 1 批（81 校）",
      school: "測試國小",
      error: "upstream timeout",
    }),
    /發生問題[\s\S]*測試國小[\s\S]*upstream timeout/,
  );
  assert.match(
    formatJobFinished({
      mealDate: "2026-10-12",
      label: "第 1 批（81 校）",
      total: 81,
      available: 70,
      noMeal: 1,
      notPublished: 9,
      failed: 1,
    }),
    /抓取結束[\s\S]*有供餐：70[\s\S]*失敗：1/,
  );
  assert.match(
    formatDailySummary({
      mealDate: "2026-10-12",
      checked: 243,
      expected: 243,
      available: 220,
      noMeal: 3,
      notPublished: 20,
      failed: 0,
    }),
    /今日臺中市國小午餐總結[\s\S]*243\/243[\s\S]*流程已完成/,
  );
});

test("Telegram delivery is idempotent for the same event key", async () => {
  const rows = new Map();
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (sql.includes("INSERT OR IGNORE")) {
                const [eventKey, jobKey, mealDate, eventType, message, createdAt, updatedAt] = values;
                if (!rows.has(eventKey)) {
                  rows.set(eventKey, {
                    eventKey,
                    jobKey,
                    mealDate,
                    eventType,
                    message,
                    status: "pending",
                    attempts: 0,
                    telegramMessageId: null,
                    createdAt,
                    updatedAt,
                  });
                }
              } else if (sql.includes("status = 'sending'")) {
                const [updatedAt, eventKey] = values;
                Object.assign(rows.get(eventKey), {
                  status: "sending",
                  attempts: rows.get(eventKey).attempts + 1,
                  updatedAt,
                });
              } else if (sql.includes("status = 'sent'")) {
                const [messageId, sentAt, updatedAt, eventKey] = values;
                Object.assign(rows.get(eventKey), {
                  status: "sent",
                  telegramMessageId: messageId,
                  sentAt,
                  updatedAt,
                });
              }
              return { meta: { changes: 1 } };
            },
            async first() {
              const row = rows.get(values[0]);
              return row
                ? { status: row.status, telegram_message_id: row.telegramMessageId }
                : null;
            },
          };
        },
      };
    },
  };
  const previousFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const env = {
      DB: db,
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_CHAT_ID: "-1001",
    };
    const event = {
      eventKey: "started:main:2026-10-12:1",
      jobKey: "main:2026-10-12:1",
      mealDate: "2026-10-12",
      eventType: "started",
      message: "開始",
    };
    const first = await deliverTelegramEvent(env, event);
    const second = await deliverTelegramEvent(env, event);
    assert.equal(first.status, "sent");
    assert.equal(second.status, "already_sent");
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
