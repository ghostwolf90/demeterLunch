import {
  accountDatabase,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";
import {
  TOWN_DAILY_ALL_CLEAR_BONUS,
  replacementTownDailyTask,
  taipeiDateKey,
  townDailyQuestSnapshot,
  validateTownDailyQuestEvent,
  type TownCoinLedgerRow,
  type TownDailyCategory,
  type TownDailyQuestEventRow,
} from "@/lib/town-daily-quests";

export const dynamic = "force-dynamic";

type QuestOverrideRow = { category: TownDailyCategory; task_id: string };
type BalanceRow = { balance: number | null };

async function readDailySnapshot(authUserId: string, dateKey: string) {
  const db = accountDatabase();
  const [events, todayLedger, balance, override] = await Promise.all([
    db.prepare(
      `SELECT event_type, subject_id, value, occurred_at
       FROM town_daily_quest_events
       WHERE auth_user_id = ? AND task_date = ?
       ORDER BY occurred_at ASC`,
    ).bind(authUserId, dateKey).all<TownDailyQuestEventRow>(),
    db.prepare(
      `SELECT ledger_key, amount
       FROM town_coin_ledger
       WHERE auth_user_id = ? AND ledger_key LIKE ?
       ORDER BY created_at ASC`,
    ).bind(authUserId, `daily:${dateKey}:%`).all<TownCoinLedgerRow>(),
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM town_coin_ledger
       WHERE auth_user_id = ?`,
    ).bind(authUserId).first<BalanceRow>(),
    db.prepare(
      `SELECT category, task_id
       FROM town_daily_quest_overrides
       WHERE auth_user_id = ? AND task_date = ?
       LIMIT 1`,
    ).bind(authUserId, dateKey).first<QuestOverrideRow>(),
  ]);
  return townDailyQuestSnapshot(
    dateKey,
    events.results,
    todayLedger.results,
    Number(balance?.balance || 0),
    override?.task_id || null,
  );
}

async function reconcileDailyRewards(authUserId: string, dateKey: string) {
  const db = accountDatabase();
  let snapshot = await readDailySnapshot(authUserId, dateKey);
  const rewards = snapshot.tasks
    .filter((item) => item.completed && !item.rewarded)
    .map((item) => ({
      ledgerKey: item.ledgerKey,
      amount: item.rewardCoins,
      reason: `每日任務：${item.title}`,
      taskId: item.id,
    }));
  if (snapshot.summary.allComplete && !snapshot.summary.bonusAwarded) {
    rewards.push({
      ledgerKey: snapshot.summary.bonusLedgerKey,
      amount: TOWN_DAILY_ALL_CLEAR_BONUS,
      reason: "每日任務三題全完成",
      taskId: "all-clear",
    });
  }

  const newlyRewardedIds = new Set<string>();
  const now = new Date().toISOString();
  for (const reward of rewards) {
    const inserted = await db.prepare(
      `INSERT OR IGNORE INTO town_coin_ledger
         (auth_user_id, ledger_key, amount, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(authUserId, reward.ledgerKey, reward.amount, reward.reason, now).run();
    if (Number(inserted.meta.changes || 0) > 0) newlyRewardedIds.add(reward.taskId);
  }
  if (newlyRewardedIds.size) snapshot = await readDailySnapshot(authUserId, dateKey);
  return {
    snapshot,
    newlyRewarded: snapshot.tasks.filter((item) => newlyRewardedIds.has(item.id)),
    allClearRewarded: newlyRewardedIds.has("all-clear"),
  };
}

export async function GET(request: Request) {
  const dateKey = taipeiDateKey();
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({
      authenticated: false,
      account: null,
      ...townDailyQuestSnapshot(dateKey, [], [], 0),
      rerollAvailable: false,
    });
  }

  try {
    const { snapshot } = await reconcileDailyRewards(user.id, dateKey);
    return privateJson({
      authenticated: true,
      account: { displayName: user.displayName },
      ...snapshot,
    });
  } catch (error) {
    console.error("Unable to load town daily quests", error);
    return privateJson({ error: "目前還無法讀取每日任務，請稍後再試。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({ error: "請先免費登入，才能累積每日任務與金幣。", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "每日任務資料格式不正確。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return privateJson({ error: "每日任務資料格式不正確。" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const dateKey = taipeiDateKey();
  try {
    const db = accountDatabase();
    if (record.action === "reroll") {
      const taskId = typeof record.taskId === "string" ? record.taskId.trim() : "";
      const current = await readDailySnapshot(user.id, dateKey);
      const selected = current.tasks.find((item) => item.id === taskId);
      if (!current.rerollAvailable) {
        return privateJson({ error: "今天已經更換過一次任務。", code: "REROLL_USED" }, { status: 409 });
      }
      if (!selected || selected.completed) {
        return privateJson({ error: "只能更換今天尚未完成的任務。", code: "TASK_NOT_REROLLABLE" }, { status: 409 });
      }
      const replacement = replacementTownDailyTask(dateKey, selected.id);
      if (!replacement || replacement.category !== selected.category) {
        return privateJson({ error: "目前找不到合適的替代任務。" }, { status: 409 });
      }
      const inserted = await db.prepare(
        `INSERT OR IGNORE INTO town_daily_quest_overrides
           (auth_user_id, task_date, category, task_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(user.id, dateKey, selected.category, replacement.id, new Date().toISOString()).run();
      if (Number(inserted.meta.changes || 0) === 0) {
        return privateJson({ error: "今天已經更換過一次任務。", code: "REROLL_USED" }, { status: 409 });
      }
      const { snapshot, newlyRewarded, allClearRewarded } = await reconcileDailyRewards(user.id, dateKey);
      return privateJson({
        ok: true,
        rerolled: true,
        authenticated: true,
        account: { displayName: user.displayName },
        ...snapshot,
        newlyRewarded,
        allClearRewarded,
      });
    }

    const event = validateTownDailyQuestEvent(record);
    if (!event) return privateJson({ error: "每日任務事件不正確。" }, { status: 400 });
    const eventKey = `daily:${dateKey}:${event.eventKey}`;
    const inserted = await db.prepare(
      `INSERT OR IGNORE INTO town_daily_quest_events
         (auth_user_id, event_key, task_date, event_type, subject_id, value, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      user.id,
      eventKey,
      dateKey,
      event.eventType,
      event.subjectId,
      event.value,
      new Date().toISOString(),
    ).run();
    const { snapshot, newlyRewarded, allClearRewarded } = await reconcileDailyRewards(user.id, dateKey);
    return privateJson({
      ok: true,
      recorded: Number(inserted.meta.changes || 0) > 0,
      authenticated: true,
      account: { displayName: user.displayName },
      ...snapshot,
      newlyRewarded,
      allClearRewarded,
    });
  } catch (error) {
    console.error("Unable to save town daily quest progress", error);
    return privateJson({ error: "目前還無法保存每日任務，請稍後再試。" }, { status: 503 });
  }
}

