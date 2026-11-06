export const TOWN_DAILY_QUEST_CITY = "taichung";
export const TOWN_DAILY_ALL_CLEAR_BONUS = 15;

export const TOWN_DAILY_EVENT_TYPES = [
  "venue_visit",
  "walk_distance",
  "bike_return",
  "school_gate",
  "dish_pick",
  "role_observe",
  "checkpoint_visit",
  "dog_observe",
] as const;

export type TownDailyEventType = typeof TOWN_DAILY_EVENT_TYPES[number];
export type TownDailyCategory = "life" | "food" | "explore";

type TownDailyRequirement = {
  eventType: TownDailyEventType;
  subjectIds?: readonly string[];
  target: number;
  mode?: "count" | "sum";
  label: string;
};

export type TownDailyTaskDefinition = {
  id: string;
  category: TownDailyCategory;
  categoryLabel: string;
  icon: string;
  title: string;
  description: string;
  rewardCoins: number;
  requirements: readonly TownDailyRequirement[];
};

const CATEGORY_LABELS: Record<TownDailyCategory, string> = {
  life: "小鎮生活",
  food: "午餐探索",
  explore: "城市散步",
};

const CATEGORY_REWARDS: Record<TownDailyCategory, number> = {
  life: 10,
  food: 15,
  explore: 20,
};

const requirement = (
  eventType: TownDailyEventType,
  label: string,
  subjectIds?: readonly string[],
  target = 1,
  mode: TownDailyRequirement["mode"] = "count",
): TownDailyRequirement => ({ eventType, label, ...(subjectIds ? { subjectIds } : {}), target, mode });

const task = (
  id: string,
  category: TownDailyCategory,
  icon: string,
  title: string,
  description: string,
  requirements: readonly TownDailyRequirement[],
): TownDailyTaskDefinition => ({
  id,
  category,
  categoryLabel: CATEGORY_LABELS[category],
  icon,
  title,
  description,
  rewardCoins: CATEGORY_REWARDS[category],
  requirements,
});

export const TOWN_DAILY_TASKS: readonly TownDailyTaskDefinition[] = [
  task("life-home", "life", "家", "回家報到", "進入一次自己的家，替今天的小鎮行程暖身。", [
    requirement("venue_visit", "回到自己的家", ["player-home"]),
  ]),
  task("life-convenience", "life", "店", "巷口補給", "走進任一間便利商店看看。", [
    requirement("venue_visit", "進入便利商店", ["convenience-store"]),
  ]),
  task("life-grocery", "life", "菜", "買菜去", "走進任一間雜貨店或市場。", [
    requirement("venue_visit", "進入雜貨店", ["grocery-store"]),
  ]),
  task("life-snack", "life", "食", "點心小歇", "走進小吃店或餐廳休息一下。", [
    requirement("venue_visit", "進入小吃店或餐廳", ["snack-shop", "restaurant"]),
  ]),
  task("life-walk", "life", "步", "今日散步", "在安全可行走的街道累積 300 步距。", [
    requirement("walk_distance", "步行距離", ["walkable"], 300, "sum"),
  ]),
  task("life-bike-return", "life", "輪", "有借有還", "把 YouBike 歸還到任一站點；租車本身不算完成。", [
    requirement("bike_return", "歸還 YouBike"),
  ]),

  task("food-market-route", "food", "籃", "餐桌採買路線", "依序不拘，走訪雜貨店與小吃店或餐廳。", [
    requirement("venue_visit", "進入雜貨店", ["grocery-store"]),
    requirement("venue_visit", "進入小吃店或餐廳", ["snack-shop", "restaurant"]),
  ]),
  task("food-school-gate", "food", "校", "午餐校門口", "走近任一所學校校門，看看今天的午餐提示。", [
    requirement("school_gate", "抵達學校校門"),
  ]),
  task("food-dish-pick", "food", "餐", "今天想吃這一道", "從有公開資料的當日菜單選一道感興趣的菜。", [
    requirement("dish_pick", "選擇一道菜"),
  ]),
  task("food-find-cook", "food", "廚", "找到廚房人員", "靠近一位廚房人員即可，不必打斷對方工作。", [
    requirement("role_observe", "找到廚房人員", ["cook"]),
  ]),
  task("food-find-nutritionist", "food", "營", "找到營養師", "靠近一位營養師，看看今天的校園行程。", [
    requirement("role_observe", "找到營養師", ["nutritionist"]),
  ]),
  task("food-neighborhood", "food", "袋", "街坊食材補給", "走訪便利商店與雜貨店各一次。", [
    requirement("venue_visit", "進入便利商店", ["convenience-store"]),
    requirement("venue_visit", "進入雜貨店", ["grocery-store"]),
  ]),

  task("explore-bridge", "explore", "橋", "過橋去看看", "完整走過苗栗或彰化方向的一座縣界橋。", [
    requirement("checkpoint_visit", "走過縣界橋", ["bridge-north", "bridge-south"]),
  ]),
  task("explore-riverbank", "explore", "河", "河岸安全巡", "抵達河岸安全觀景點，不必也不能走進河川。", [
    requirement("checkpoint_visit", "抵達河岸觀景點", ["riverbank"]),
  ]),
  task("explore-coast", "explore", "海", "海風路線", "抵達漁港、沙灘或消波塊旁的安全觀景點。", [
    requirement("checkpoint_visit", "抵達海邊觀景點", ["coast"]),
  ]),
  task("explore-mountain", "explore", "山", "山腳遠望", "抵達山腳安全位置，不必也不能走進山區。", [
    requirement("checkpoint_visit", "抵達山腳觀景點", ["mountain"]),
  ]),
  task("explore-construction", "explore", "縣", "縣界歡迎牌", "抵達苗栗或彰化的縣界歡迎牌。", [
    requirement("checkpoint_visit", "找到縣界歡迎牌", ["miaoli-sign", "changhua-sign"]),
  ]),
  task("explore-dog", "explore", "犬", "狗狗散步觀察", "靠近一組正在散步的主人與牽繩狗，不必對話。", [
    requirement("dog_observe", "找到牽繩狗"),
  ]),
] as const;

const TASKS_BY_CATEGORY = new Map<TownDailyCategory, readonly TownDailyTaskDefinition[]>(
  (["life", "food", "explore"] as const).map((category) => [
    category,
    TOWN_DAILY_TASKS.filter((item) => item.category === category),
  ]),
);

export type TownDailyQuestEventRow = {
  event_type: string;
  subject_id: string;
  value: number;
  occurred_at: string;
};

export type TownCoinLedgerRow = {
  ledger_key: string;
  amount: number;
};

export function taipeiDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dateOrdinal(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Invalid daily quest date");
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function baseTownDailyTasks(dateKey: string) {
  const ordinal = dateOrdinal(dateKey);
  return (["life", "food", "explore"] as const).map((category, categoryIndex) => {
    const pool = TASKS_BY_CATEGORY.get(category) || [];
    return pool[(ordinal + categoryIndex * 2) % pool.length];
  });
}

export function townDailyTaskById(taskId: string) {
  return TOWN_DAILY_TASKS.find((item) => item.id === taskId) || null;
}

export function replacementTownDailyTask(dateKey: string, currentTaskId: string) {
  const current = townDailyTaskById(currentTaskId);
  if (!current) return null;
  const pool = TASKS_BY_CATEGORY.get(current.category) || [];
  const index = pool.findIndex((item) => item.id === current.id);
  const step = 1 + dateOrdinal(dateKey) % Math.max(1, pool.length - 1);
  return pool[(index + step) % pool.length] || null;
}

export function assignedTownDailyTasks(dateKey: string, overrideTaskId?: string | null) {
  const tasks = baseTownDailyTasks(dateKey);
  const replacement = overrideTaskId ? townDailyTaskById(overrideTaskId) : null;
  if (!replacement) return tasks;
  return tasks.map((item) => item.category === replacement.category ? replacement : item);
}

function requirementProgress(requirement: TownDailyRequirement, events: readonly TownDailyQuestEventRow[]) {
  const matching = events.filter((event) => (
    event.event_type === requirement.eventType
      && (!requirement.subjectIds || requirement.subjectIds.includes(event.subject_id))
  ));
  const progress = requirement.mode === "sum"
    ? matching.reduce((total, event) => total + Math.max(0, Number(event.value) || 0), 0)
    : matching.length;
  return Math.min(requirement.target, progress);
}

export function townDailyQuestSnapshot(
  dateKey: string,
  events: readonly TownDailyQuestEventRow[],
  todayLedger: readonly TownCoinLedgerRow[],
  coinBalance: number,
  overrideTaskId?: string | null,
) {
  const rewardedKeys = new Set(todayLedger.map((item) => item.ledger_key));
  const tasks = assignedTownDailyTasks(dateKey, overrideTaskId).map((definition) => {
    const requirements = definition.requirements.map((item) => ({
      label: item.label,
      progress: requirementProgress(item, events),
      target: item.target,
    }));
    const completed = requirements.every((item) => item.progress >= item.target);
    const ledgerKey = `daily:${dateKey}:${definition.id}`;
    return {
      ...definition,
      requirements,
      progress: requirements.reduce((total, item) => total + item.progress, 0),
      target: requirements.reduce((total, item) => total + item.target, 0),
      completed,
      rewarded: rewardedKeys.has(ledgerKey),
      ledgerKey,
    };
  });
  const allComplete = tasks.every((item) => item.completed);
  const bonusLedgerKey = `daily:${dateKey}:all-clear`;
  const bonusAwarded = rewardedKeys.has(bonusLedgerKey);
  return {
    date: dateKey,
    city: TOWN_DAILY_QUEST_CITY,
    coinBalance: Math.max(0, Number(coinBalance) || 0),
    tasks,
    summary: {
      completed: tasks.filter((item) => item.completed).length,
      total: tasks.length,
      allComplete,
      bonusCoins: TOWN_DAILY_ALL_CLEAR_BONUS,
      bonusAwarded,
      bonusLedgerKey,
      earnedToday: todayLedger.reduce((total, item) => total + Number(item.amount || 0), 0),
    },
    rerollAvailable: !overrideTaskId,
  };
}

export function validateTownDailyQuestEvent(value: unknown): {
  eventType: TownDailyEventType;
  subjectId: string;
  value: number;
  eventKey: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const eventType = record.eventType;
  const subjectId = typeof record.subjectId === "string" ? record.subjectId.trim() : "";
  const eventKey = typeof record.eventKey === "string" ? record.eventKey.trim() : "";
  const amount = Number(record.value ?? 1);
  if (!TOWN_DAILY_EVENT_TYPES.includes(eventType as TownDailyEventType)) return null;
  if (!subjectId || subjectId.length > 80 || /[\u0000-\u001f\u007f]/.test(subjectId)) return null;
  if (!eventKey || eventKey.length > 120 || !/^[a-zA-Z0-9:_-]+$/.test(eventKey)) return null;
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) return null;
  return { eventType: eventType as TownDailyEventType, subjectId, value: amount, eventKey };
}
