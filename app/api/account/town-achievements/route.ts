import {
  accountDatabase,
  forbiddenMutation,
  getAccountUser,
  isSameOriginMutation,
  privateJson,
} from "@/lib/account-auth";
import {
  TOWN_ACHIEVEMENTS,
  TOWN_ACHIEVEMENT_CITY,
  townAchievementSnapshot,
  validateTownAchievementEvent,
  type TownAchievementEventRow,
  type TownAchievementUnlockRow,
} from "@/lib/town-achievements";

export const dynamic = "force-dynamic";

async function accountAchievementSnapshot(authUserId: string) {
  const db = accountDatabase();
  const [events, unlocks] = await Promise.all([
    db.prepare(
      `SELECT event_type, subject_id, occurred_at
       FROM town_achievement_events
       WHERE auth_user_id = ? AND city = ?
       ORDER BY occurred_at ASC`,
    ).bind(authUserId, TOWN_ACHIEVEMENT_CITY).all<TownAchievementEventRow>(),
    db.prepare(
      `SELECT achievement_id, unlocked_at
       FROM town_achievement_unlocks
       WHERE auth_user_id = ? AND achievement_id LIKE ?
       ORDER BY unlocked_at ASC`,
    ).bind(authUserId, `${TOWN_ACHIEVEMENT_CITY}:%`).all<TownAchievementUnlockRow>(),
  ]);
  return townAchievementSnapshot(events.results, unlocks.results);
}

async function persistReachedAchievementUnlocks(
  authUserId: string,
  snapshot: ReturnType<typeof townAchievementSnapshot>,
  unlockedAt: string,
) {
  const db = accountDatabase();
  const newlyUnlockedIds = new Set<string>();
  for (const definition of snapshot.achievements.filter((item) => item.reached && !item.unlocked)) {
    const unlock = await db.prepare(
      `INSERT OR IGNORE INTO town_achievement_unlocks
         (auth_user_id, achievement_id, unlocked_at)
       VALUES (?, ?, ?)`,
    ).bind(authUserId, definition.id, unlockedAt).run();
    if (Number(unlock.meta.changes || 0) > 0) newlyUnlockedIds.add(definition.id);
  }
  return newlyUnlockedIds;
}

export async function GET(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({
      authenticated: false,
      account: null,
      ...townAchievementSnapshot([], []),
    });
  }

  try {
    let snapshot = await accountAchievementSnapshot(user.id);
    const newlyUnlockedIds = await persistReachedAchievementUnlocks(user.id, snapshot, new Date().toISOString());
    if (newlyUnlockedIds.size) snapshot = await accountAchievementSnapshot(user.id);
    return privateJson({
      authenticated: true,
      account: { displayName: user.displayName },
      ...snapshot,
    });
  } catch (error) {
    console.error("Unable to load town achievements", error);
    return privateJson({ error: "目前還無法讀取小鎮成就，請稍後再試。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({ error: "請先免費登入，才能保存小鎮成就。", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isSameOriginMutation(request)) return forbiddenMutation();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "成就事件格式不正確。" }, { status: 400 });
  }
  const event = validateTownAchievementEvent(body);
  if (!event) return privateJson({ error: "成就事件不正確。" }, { status: 400 });

  try {
    const db = accountDatabase();
    const now = new Date().toISOString();
    const eventKey = `${event.city}:${event.eventType}:${event.subjectId}`;
    const inserted = await db.prepare(
      `INSERT OR IGNORE INTO town_achievement_events
         (auth_user_id, event_key, city, event_type, subject_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(user.id, eventKey, event.city, event.eventType, event.subjectId, now).run();

    let snapshot = await accountAchievementSnapshot(user.id);
    const newlyUnlockedIds = await persistReachedAchievementUnlocks(user.id, snapshot, now);
    if (newlyUnlockedIds.size) snapshot = await accountAchievementSnapshot(user.id);
    const newlyUnlocked = snapshot.achievements.filter((item) => newlyUnlockedIds.has(item.id) && item.unlocked);

    return privateJson({
      ok: true,
      recorded: Number(inserted.meta.changes || 0) > 0,
      authenticated: true,
      account: { displayName: user.displayName },
      ...snapshot,
      newlyUnlocked,
    });
  } catch (error) {
    console.error("Unable to save town achievement event", error);
    return privateJson({ error: "目前還無法保存小鎮成就，請稍後再試。" }, { status: 503 });
  }
}

export const achievementCount = TOWN_ACHIEVEMENTS.length;
