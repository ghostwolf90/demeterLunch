const DEFAULT_SCHOOL_ID = 193609;
window.localStorage.removeItem("demeter-active-child-id");
const savedActiveChildId = Number(new URL(window.location.href).searchParams.get("childId"));
const state = {
  account: null,
  requestId: 0,
  activeChildId: Number.isInteger(savedActiveChildId) && savedActiveChildId > 0 ? savedActiveChildId : null,
  encounters: [],
  schools: [],
  siteData: null,
  mealCache: {},
};

const experienceLabels = {
  unrecorded: "未記錄接觸方式",
  not_tried: "今天不想嘗試",
  not_eaten: "沒有吃",
  seen: "看過，但沒有吃",
  smelled: "聞過，但沒有吃",
  touched: "碰過，但沒有吃",
  tasted: "嚐了一口",
  ate_some: "吃了一些",
  ate_most: "吃了大部分",
  finished: "吃完了",
  ate_unknown: "有吃，份量不確定",
  unknown: "不確定／孩子沒提到",
  accepted: "可以接受",
  liked: "喜歡",
};

const reactionLabels = {
  loved: "很喜歡",
  liked: "喜歡",
  okay: "還好",
  less_liked: "不太喜歡",
  disliked: "不喜歡",
  wants_more: "想再吃",
  willing_retry: "下次願意再試",
  avoid_next_time: "下次不想吃",
  no_comment: "沒有特別說",
  other: "其他感受",
};

const refs = {
  title: document.getElementById("recordsTitle"),
  summary: document.getElementById("recordsSummary"),
  status: document.getElementById("recordsStatus"),
  content: document.getElementById("recordsContent"),
  monthJumpLabel: document.getElementById("monthJumpLabel"),
  monthJump: document.getElementById("monthJump"),
  childSwitch: document.getElementById("recordsChildSwitch"),
  childSelect: document.getElementById("recordsChildSelect"),
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function childDisplayName(child) {
  return child?.displayName || child?.nickname || child?.name || "孩子";
}

async function responsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function localDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function dayLabel(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(localDate(value));
}

function schoolById(schoolId) {
  return state.schools.find(
    (school) => Number(school.fatraceSchoolId) === Number(schoolId),
  ) || null;
}

function encounterOriginText(encounter) {
  if (encounter.mealContext === "school_lunch" && encounter.dishName) {
    return encounter.foodName === encounter.dishName
      ? `記錄整道「${encounter.dishName}」`
      : `來源菜色：${encounter.dishName}`;
  }
  if (encounter.mealContext === "other") return "家裡／其他地方吃到";
  return "舊紀錄未記錄菜色來源";
}

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function encounterCard(encounter) {
  const card = node("article", "records-entry");
  const heading = document.createElement("header");
  heading.append(
    LunchI18n.keep(node("h3", "", encounter.foodName)),
    node("span", "records-stage", experienceLabels[encounter.experience] || "食物經驗"),
  );
  card.append(heading, node("p", "records-origin", encounterOriginText(encounter)));

  const reactionNames = (encounter.reactions || [])
    .map((reaction) => reactionLabels[reaction])
    .filter(Boolean);
  if (encounter.firstEncounter || reactionNames.length) {
    const tags = node("div", "records-tags");
    if (encounter.firstEncounter) tags.append(node("span", "is-first", "第一次遇到"));
    reactionNames.forEach((reaction) => tags.append(node("span", "", reaction)));
    card.append(tags);
  }
  if (encounter.childQuote) {
    card.append(LunchI18n.keep(node("blockquote", "records-quote", `「${encounter.childQuote}」`)));
  }
  if (encounter.preparation) {
    card.append(recordDetail("喜歡／不喜歡的做法", encounter.preparation));
  }
  if (encounter.note) card.append(recordDetail("家長筆記", encounter.note));
  card.append(PassportMemory.actions(encounter, state.account.child.id, initialize));
  return card;
}

function recordDetail(label, value) {
  const row = node("p", "records-note");
  row.append(node("strong", "", label), LunchI18n.keep(document.createTextNode(value)));
  return row;
}

function renderRecords() {
  refs.status.hidden = true;
  refs.content.replaceChildren();
  refs.monthJumpLabel.hidden = true;
  const encounters = [...state.encounters].sort((left, right) =>
    right.mealDate.localeCompare(left.mealDate)
      || right.createdAt.localeCompare(left.createdAt)
      || right.id - left.id,
  );
  const dayCount = new Set(encounters.map((encounter) => encounter.mealDate)).size;
  refs.title.textContent = `${childDisplayName(state.account.child)}的飲食紀錄`;
  refs.summary.textContent = encounters.length
    ? `共 ${encounters.length} 筆、${dayCount} 個有紀錄的午餐日，依供餐日期由新到舊整理。`
    : "這裡還沒有紀錄。下次聊到午餐，有想記住的話再留下來。";

  if (!encounters.length) {
    const empty = node("section", "records-empty card");
    empty.append(
      node("h2", "", "還沒有飲食紀錄"),
      node("p", "", "下次孩子提到午餐時，可以選一道菜，留一句話。"),
    );
    const action = node("a", "records-primary-action", "新增第一筆飲食紀錄");
    action.href = "./index.html#passport";
    empty.append(action);
    refs.content.append(empty);
    return;
  }

  const months = groupBy(encounters, (encounter) => encounter.mealDate.slice(0, 7));
  refs.monthJump.replaceChildren();
  for (const monthKey of months.keys()) {
    const option = node("option", "", monthLabel(monthKey));
    option.value = monthKey;
    refs.monthJump.append(option);
  }
  refs.monthJumpLabel.hidden = months.size < 2;

  for (const [monthKey, monthEncounters] of months) {
    const monthSection = node("section", "records-month");
    monthSection.id = `records-month-${monthKey}`;
    const monthDays = groupBy(monthEncounters, (encounter) => encounter.mealDate);
    const monthHeading = node("header", "records-month-heading");
    monthHeading.append(
      node("h2", "", monthLabel(monthKey)),
      node("span", "", `${monthDays.size} 個有紀錄的午餐日`),
    );
    monthSection.append(monthHeading);

    for (const [mealDate, dayEncounters] of monthDays) {
      monthSection.append(dayCard(mealDate, dayEncounters));
    }
    refs.content.append(monthSection);
  }
}

function accountEndpoint() {
  return Number.isInteger(state.activeChildId) && state.activeChildId > 0
    ? `/api/account?childId=${encodeURIComponent(state.activeChildId)}`
    : "/api/account";
}

function renderChildSelect() {
  const children = Array.isArray(state.account?.children) ? state.account.children : [];
  refs.childSelect.replaceChildren();
  children.forEach((child) => {
    const option = LunchI18n.keep(node("option", "", childDisplayName(child)));
    option.value = String(child.id);
    option.selected = Number(child.id) === Number(state.account.child?.id);
    refs.childSelect.append(option);
  });
  refs.childSwitch.hidden = children.length < 2;
}

function dayCard(mealDate, encounters) {
  const card = node("article", "records-day card");
  const heading = node("header", "records-day-heading");
  const schools = [...new Set(encounters
    .map((encounter) => schoolById(encounter.schoolId)?.name)
    .filter(Boolean))];
  const mealTypes = [...new Set(encounters
    .filter((encounter) => encounter.mealContext === "school_lunch")
    .map((encounter) => encounter.mealType === "vegetarian" ? "素食" : "葷食"))];
  const meta = [...schools, ...mealTypes].join(" · ") || "家庭／其他場合";
  heading.append(
    node("div", "", undefined),
    node("span", "records-day-count", `${encounters.length} 筆經驗`),
  );
  heading.firstElementChild.append(
    node("time", "", dayLabel(mealDate)),
    node("p", "", meta),
  );
  card.append(heading);

  const entries = node("div", "records-day-entries");
  encounters.forEach((encounter) => entries.append(encounterCard(encounter)));
  card.append(entries);

  const schoolEncounter = encounters.find(
    (encounter) => encounter.mealContext === "school_lunch" && encounter.schoolId,
  );
  if (schoolEncounter) card.append(dayMealDetails(schoolEncounter, encounters));
  return card;
}

function dayMealDetails(encounter, dayEncounters) {
  const details = node("details", "records-meal");
  details.append(node("summary", "", "查看當天完整午餐"));
  const content = node("div", "records-meal-content");
  content.setAttribute("aria-live", "polite");
  details.append(content);
  details.addEventListener("toggle", async () => {
    details.querySelector("summary").textContent = details.open
      ? "收起當天完整午餐"
      : "查看當天完整午餐";
    if (!details.open || content.dataset.loaded === "true") return;
    content.dataset.loaded = "true";
    content.append(node("p", "encounter-meal-status", "正在整理當天菜單…"));
    try {
      renderMealSnapshot(content, await mealSnapshot(encounter), dayEncounters);
    } catch (error) {
      console.error("Unable to load the recorded day's meal", error);
      content.replaceChildren(node("p", "encounter-meal-status is-error", "當天菜單暫時無法讀取，請稍後再試。"));
    }
  });
  return details;
}

async function publicSiteData() {
  if (state.siteData) return state.siteData;
  const response = await fetch("./data/site-data.json");
  if (!response.ok) throw new Error(`Unable to load reviewed menu data (${response.status})`);
  state.siteData = await response.json();
  return state.siteData;
}

async function publicSchoolMealData(schoolId) {
  const response = await fetch(`./data/school-meals/${encodeURIComponent(schoolId)}.json`);
  if (!response.ok) throw new Error(`Unable to load school meal data (${response.status})`);
  return response.json();
}

function detailedMealItems(day) {
  const meal = day?.meal;
  if (!meal) return [];
  return [
    { role: "主食", name: meal.staple },
    { role: "主菜", name: meal.mainDish },
    ...(meal.sideDishes || []).map((name, index) => ({ role: `配菜 ${index + 1}`, name })),
    { role: "湯品", name: meal.soup },
    { role: "水果", name: meal.fruit },
    { role: "飲品", name: meal.drink },
  ].filter((item) => typeof item.name === "string" && item.name.trim());
}

async function mealSnapshot(encounter) {
  const schoolId = Number(encounter.schoolId);
  const mealType = encounter.mealType === "vegetarian" ? "vegetarian" : "meat";
  const cacheKey = `${schoolId}:${encounter.mealDate}:${mealType}`;
  if (state.mealCache[cacheKey]) return state.mealCache[cacheKey];
  const snapshot = {
    schoolName: schoolById(schoolId)?.name || "孩子當時的學校",
    mealTypeLabel: mealType === "vegetarian" ? "素食" : "葷食",
    items: [],
    missing: false,
  };
  if (schoolId === DEFAULT_SCHOOL_ID) {
    const data = await publicSiteData();
    const day = data.variants?.[mealType]?.days?.find(
      (candidate) => candidate.date === encounter.mealDate,
    );
    snapshot.items = detailedMealItems(day);
    snapshot.missing = !day;
  } else {
    let record = null;
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(encounter.mealDate)}&mealType=${encodeURIComponent(mealType)}&schoolId=${encodeURIComponent(schoolId)}`, { cache: "no-store" });
      if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
        record = (await response.json()).record || null;
      }
    } catch (error) {
      console.info("Live meal preview unavailable; using the reviewed static snapshot.", error);
    }
    if (!record) {
      const data = await publicSchoolMealData(schoolId);
      record = data.records?.[encounter.mealDate] || null;
    }
    const profile = OfficialDiet.profile(record);
    snapshot.items = OfficialDiet.filter(record, profile.hasVariants ? mealType : null).map((dish) => ({
      role: dish.category || "菜色",
      name: dish.name,
    }));
    snapshot.missing = !record;
  }
  state.mealCache[cacheKey] = snapshot;
  return snapshot;
}

function sameFood(left, right) {
  const normalize = (value) => String(value || "").replace(/[\s＋+、，,]/g, "");
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function renderMealSnapshot(container, snapshot, encounters) {
  container.replaceChildren();
  const heading = node("div", "encounter-meal-heading");
  heading.append(
    node("strong", "", `${snapshot.schoolName}當天午餐`),
    node("span", "", snapshot.mealTypeLabel),
  );
  container.append(heading);
  if (snapshot.missing || !snapshot.items.length) {
    container.append(node("p", "encounter-meal-status", "這一天沒有已收錄的同日菜單，不會拿別天的內容代替。"));
    return;
  }
  const linkedDishes = encounters
    .filter((encounter) => encounter.mealContext === "school_lunch" && encounter.dishName)
    .map((encounter) => encounter.dishName);
  const list = node("ul", "encounter-meal-list");
  snapshot.items.forEach((mealItem) => {
    const row = document.createElement("li");
    if (linkedDishes.some((dishName) => sameFood(mealItem.name, dishName))) {
      row.classList.add("is-recorded");
    }
    row.append(node("span", "", mealItem.role), LunchI18n.keep(node("strong", "", mealItem.name)));
    list.append(row);
  });
  container.append(
    list,
    node("p", "encounter-meal-source", "同日已校讀菜單 · 反白只表示這筆紀錄保存的來源菜色，不代表實際吃到的份量"),
  );
}

function renderGate(title, message, actionLabel) {
  refs.status.hidden = true;
  refs.content.replaceChildren();
  refs.title.textContent = title;
  refs.summary.textContent = message;
  const card = node("section", "records-empty card");
  card.append(node("h2", "", title), node("p", "", message));
  const action = node("a", "records-primary-action", actionLabel);
  action.href = "./index.html#passport";
  card.append(action);
  refs.content.append(card);
}

async function initialize() {
  const ticket = ++state.requestId;
  document.querySelectorAll(".memory-editor").forEach(dialog => dialog.close());
  refs.childSwitch.hidden = true;
  refs.status.hidden = false;
  refs.status.className = "records-status loading-state";
  refs.status.replaceChildren(node("span", "loading-spinner"), node("span", "", "正在讀取飲食紀錄…"));
  refs.content.replaceChildren();
  try {
    const [accountResponse, schoolsResponse] = await Promise.all([
      fetch(accountEndpoint(), { cache: "no-store", credentials: "same-origin" }),
      fetch("./data/schools.json"),
    ]);
    const account = await responsePayload(accountResponse);
    const schools = await responsePayload(schoolsResponse);
    if (!accountResponse.ok) throw new Error(account.error || "目前還無法顯示家庭帳號資料，請稍後再試。");
    if (ticket !== state.requestId) return;
    state.account = account;
    state.activeChildId = Number(account.child?.id) || null;
    if (state.activeChildId) {
      // Keep the selected child in memory only.
    } else {
      window.localStorage.removeItem("demeter-active-child-id");
    }
    state.schools = Array.isArray(schools.schools) ? schools.schools : [];
    if (!account.authenticated) {
      renderGate("登入後查看全部紀錄", "孩子的飲食紀錄只會顯示給登入的家長。", "登入／免費註冊");
      return;
    }
    if (!account.child) {
      renderGate("先新增孩子資料", "新增孩子的資料後，就可以開始記錄飲食。", "新增孩子資料");
      return;
    }
    renderChildSelect();
    const encountersResponse = await fetch(`/api/account/encounters?childId=${encodeURIComponent(account.child.id)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const encounters = await responsePayload(encountersResponse);
    if (!encountersResponse.ok) throw new Error(encounters.error || "目前還無法顯示飲食紀錄，請稍後再試。");
    if (ticket !== state.requestId) return;
    state.encounters = Array.isArray(encounters.encounters) ? encounters.encounters : [];
    renderRecords();
  } catch (error) {
    if (ticket !== state.requestId) return;
    console.error("Unable to initialize lunch records", error);
    refs.status.classList.remove("loading-state");
    refs.status.classList.add("records-error");
    refs.status.replaceChildren(node("strong", "", error instanceof Error ? error.message : "目前還無法顯示飲食紀錄，請稍後再試。"));
  }
}

refs.monthJump.addEventListener("change", () => {
  document.getElementById(`records-month-${refs.monthJump.value}`)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
});

refs.childSelect.addEventListener("change", () => {
  const childId = Number(refs.childSelect.value);
  if (!Number.isInteger(childId) || childId < 1 || childId === state.activeChildId) return;
  state.activeChildId = childId;
  // Keep the selected child in memory only.
  initialize();
});

initialize();
