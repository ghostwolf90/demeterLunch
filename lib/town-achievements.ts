export const TOWN_ACHIEVEMENT_CITY = "taichung";

export const TOWN_ACHIEVEMENT_EVENT_TYPES = [
  "town_visit",
  "district_visit",
  "landmark_visit",
  "school_visit",
  "npc_talk",
  "medical_rescue",
  "theft_assist",
  "town_moment",
  "bike_rental",
  "daily_story",
] as const;

export type TownAchievementEventType = typeof TOWN_ACHIEVEMENT_EVENT_TYPES[number];

export type TownAchievementDefinition = {
  id: string;
  city: typeof TOWN_ACHIEVEMENT_CITY;
  category: "return" | "explore" | "civic" | "community";
  categoryLabel: string;
  icon: string;
  title: string;
  description: string;
  eventType: TownAchievementEventType;
  target: number;
  subjectGroups?: readonly (readonly string[])[];
};

const achievement = (
  id: string,
  category: TownAchievementDefinition["category"],
  categoryLabel: string,
  icon: string,
  title: string,
  description: string,
  eventType: TownAchievementEventType,
  target: number,
  subjectGroups?: readonly (readonly string[])[],
): TownAchievementDefinition => ({
  id: `${TOWN_ACHIEVEMENT_CITY}:${id}`,
  city: TOWN_ACHIEVEMENT_CITY,
  category,
  categoryLabel,
  icon,
  title,
  description,
  eventType,
  target,
  ...(subjectGroups ? { subjectGroups } : {}),
});

export const TOWN_ACHIEVEMENTS: TownAchievementDefinition[] = [
  achievement("first-day", "return", "小鎮生活", "門", "初來乍到", "第一次走進臺中午餐小鎮。", "town_visit", 1),
  achievement("three-days", "return", "小鎮生活", "3", "三日熟客", "在 3 個不同日期回到小鎮。", "town_visit", 3),
  achievement("seven-days", "return", "小鎮生活", "7", "一週好鄰居", "在 7 個不同日期回到小鎮。", "town_visit", 7),
  achievement("district-eight", "explore", "臺中探索", "區", "街區漫遊者", "走進 8 個不同的臺中行政區。", "district_visit", 8),
  achievement("district-all", "explore", "臺中探索", "29", "臺中走透透", "走遍臺中 29 個行政區。", "district_visit", 29),
  achievement("landmark-one", "explore", "臺中探索", "地", "地標第一站", "到訪第一座臺中指標性地標。", "landmark_visit", 1),
  achievement("landmark-eight", "explore", "臺中探索", "8", "臺中地標收藏家", "到訪 8 座不同的臺中指標性地標。", "landmark_visit", 8),
  achievement("school-five", "explore", "臺中探索", "餐", "校園午餐偵察員", "查看 5 間不同學校的午餐。", "school_visit", 5),
  achievement("school-twenty", "explore", "臺中探索", "20", "午餐研究家", "查看 20 間不同學校的午餐。", "school_visit", 20),
  achievement("mayor-meeting", "civic", "市政見聞", "市", "市府遇見市長", "在臺灣大道市政大樓街區與臺中市長對話。", "npc_talk", 1, [["西屯區:盧秀燕", "中區:盧秀燕"]]),
  achievement("candidate-ho", "civic", "市政見聞", "何", "遇見何欣純", "在小鎮走訪時與市長候選人何欣純對話。", "npc_talk", 1, [["大里區:何欣純"]]),
  achievement("candidate-chiang", "civic", "市政見聞", "江", "遇見江啟臣", "在小鎮走訪時與市長候選人江啟臣對話。", "npc_talk", 1, [["豐原區:江啟臣"]]),
  achievement("civic-collection", "civic", "市政見聞", "章", "市政人物見聞錄", "分別與臺中市長及兩位市長候選人對話。", "npc_talk", 3, [["西屯區:盧秀燕", "中區:盧秀燕"], ["大里區:何欣純"], ["豐原區:江啟臣"]]),
  achievement("npc-ten", "community", "守護街坊", "聊", "巷口熟面孔", "和 10 位不同居民聊過天。", "npc_talk", 10),
  achievement("medical-three", "community", "守護街坊", "119", "守護生命", "正確處理 3 次暈倒救護事件。", "medical_rescue", 3),
  achievement("theft-three", "community", "守護街坊", "110", "安心街區夥伴", "安全協助處理 3 次失竊事件。", "theft_assist", 3),
  achievement("moments-five", "community", "守護街坊", "手", "熱心好鄰居", "完成 5 次低衝突的日常幫忙。", "town_moment", 5),
  achievement("bike-five", "community", "守護街坊", "輪", "單車小鎮通", "從 YouBike 站租車 5 次。", "bike_rental", 5),
  achievement("story-five", "return", "小鎮生活", "書", "街角故事收藏家", "參與 5 個不同日期的今日故事。", "daily_story", 5),
];

export type TownAchievementEventRow = {
  event_type: string;
  subject_id: string;
  occurred_at: string;
};

export type TownAchievementUnlockRow = {
  achievement_id: string;
  unlocked_at: string;
};

export function townAchievementSnapshot(
  events: TownAchievementEventRow[],
  unlocks: TownAchievementUnlockRow[],
) {
  const eventCounts = new Map<string, number>();
  const eventSubjects = new Map<string, Set<string>>();
  for (const event of events) {
    eventCounts.set(event.event_type, (eventCounts.get(event.event_type) || 0) + 1);
    if (!eventSubjects.has(event.event_type)) eventSubjects.set(event.event_type, new Set());
    eventSubjects.get(event.event_type)?.add(event.subject_id);
  }
  const unlockedAt = new Map(unlocks.map((unlock) => [unlock.achievement_id, unlock.unlocked_at]));
  const achievements = TOWN_ACHIEVEMENTS.map((definition) => {
    const progressCount = definition.subjectGroups
      ? definition.subjectGroups.filter((group) => group.some((subjectId) => eventSubjects.get(definition.eventType)?.has(subjectId))).length
      : eventCounts.get(definition.eventType) || 0;
    const progress = Math.min(definition.target, progressCount);
    const reached = progress >= definition.target;
    return {
      ...definition,
      progress,
      reached,
      unlocked: reached && unlockedAt.has(definition.id),
      unlockedAt: unlockedAt.get(definition.id) || null,
    };
  });
  return {
    city: { id: TOWN_ACHIEVEMENT_CITY, label: "臺中市", available: true },
    futureCities: { label: "其他縣市", available: false, message: "更多城市成就將陸續加入。" },
    achievements,
    summary: {
      unlocked: achievements.filter((item) => item.unlocked).length,
      reached: achievements.filter((item) => item.reached).length,
      total: achievements.length,
    },
  };
}

const taichungDistricts = new Set([
  "中區", "東區", "南區", "西區", "北區", "西屯區", "南屯區", "北屯區",
  "豐原區", "東勢區", "大甲區", "清水區", "沙鹿區", "梧棲區", "后里區",
  "神岡區", "潭子區", "大雅區", "新社區", "石岡區", "外埔區", "大安區",
  "烏日區", "大肚區", "龍井區", "霧峰區", "太平區", "大里區", "和平區",
]);

export function validateTownAchievementEvent(value: unknown): {
  city: typeof TOWN_ACHIEVEMENT_CITY;
  eventType: TownAchievementEventType;
  subjectId: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const city = record.city;
  const eventType = record.eventType;
  const subjectId = typeof record.subjectId === "string" ? record.subjectId.trim() : "";
  if (city !== TOWN_ACHIEVEMENT_CITY) return null;
  if (!TOWN_ACHIEVEMENT_EVENT_TYPES.includes(eventType as TownAchievementEventType)) return null;
  if (!subjectId || subjectId.length > 120 || /[\u0000-\u001f\u007f]/.test(subjectId)) return null;
  if ((eventType === "town_visit" || eventType === "daily_story") && !/^\d{4}-\d{2}-\d{2}$/.test(subjectId)) return null;
  if (eventType === "district_visit" && !taichungDistricts.has(subjectId)) return null;
  if (eventType === "school_visit" && !/^\d{1,12}$/.test(subjectId)) return null;
  return { city, eventType: eventType as TownAchievementEventType, subjectId };
}
