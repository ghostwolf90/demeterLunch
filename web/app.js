const savedMealType = window.localStorage.getItem("demeter-meal-type");
const savedGradeGroup = window.localStorage.getItem("demeter-grade-group");
const savedStandardMode = window.localStorage.getItem("demeter-standard-mode");
const savedFavoriteSchoolId = Number(window.localStorage.getItem("demeter-favorite-school-id"));
const DEFAULT_SCHOOL_ID = 193609;
const state = {
  dashboard: null,
  loading: false,
  staticData: null,
  schoolId: null,
  favoriteSchoolId: Number.isInteger(savedFavoriteSchoolId) ? savedFavoriteSchoolId : null,
  schoolDirectory: [],
  district: null,
  newsLoaded: false,
  mealType: savedMealType === "vegetarian" ? "vegetarian" : "meat",
  gradeGroup: savedGradeGroup === "elementary_upper" ? "elementary_upper" : "elementary_lower",
  standardMode: savedStandardMode === "transitional" ? "transitional" : "target",
  dishDetails: [],
  activeDishIndex: -1,
  lastDishTrigger: null,
  dishDetailOpenFrame: 0,
  dishDetailCloseTimer: 0,
  sourceImageRequestId: 0,
  lastSourceTrigger: null,
  dialogMotion: {
    account: { openFrame: 0, closeTimer: 0, closePromise: null },
    source: { openFrame: 0, closeTimer: 0, closePromise: null },
  },
  account: {
    loading: true,
    authenticated: false,
    user: null,
    child: null,
    encounters: [],
    encounterCount: 0,
    error: null,
  },
  authChallengeId: null,
  authEmail: null,
  encounterMealCache: {},
  editingChild: false,
  lastAccountTrigger: null,
};

const DISH_DETAIL_MOTION_MS = 360;
const DISH_DETAIL_REDUCED_MOTION_MS = 160;
const AUX_DIALOG_MOTION_MS = 320;
const AUX_DIALOG_REDUCED_MOTION_MS = 160;
const OTHER_FOOD_CONTEXT = "__other_food_context__";
const EMAIL_REGISTRATION_ENABLED = true;

const roleLabels = {
  staple: "主食", main: "主菜", side_1: "副菜一", side_2: "副菜二",
  side_3: "副菜三", vegetable: "青菜", soup: "湯品", fruit: "水果", drink: "飲品",
};

const claimLabels = {
  initial_processed_non_gmo: "初級加工／非基改",
  local: "在地",
  safe_vegetable: "安全蔬菜標示",
  organic_text: "原表註明有機",
};

const traceabilityStatusLabels = {
  verified: "同日官方資料",
  matched_reference: "歷史來源參考",
  menu_claim: "菜單原表標示",
  unavailable: "來源待補",
};

const experienceLabels = {
  not_tried: "今天不想嘗試",
  seen: "看了一下",
  smelled: "願意聞一聞",
  touched: "願意碰一下",
  tasted: "嘗了一口",
  ate_some: "有吃一些",
  accepted: "可以接受",
  liked: "喜歡",
};

const reactionLabels = {
  liked: "喜歡",
  okay: "還可以",
  disliked: "不喜歡",
  wants_more: "想再吃",
  willing_retry: "下次願意再試",
  avoid_next_time: "下次不想吃",
  no_comment: "沒有特別說",
  other: "其他感受",
};

const ids = [
  "dashboard", "syncStatus", "syncStatusText", "todayLabel", "mealMoment", "heroDish", "introNote", "mainDish", "mealList",
  "allergenRow", "calories", "nutritionBars", "dinnerTitle", "dinnerPicks",
  "dinnerReason", "dinnerNotes", "disclaimer", "weekLabel", "weekDays",
  "previousWeek", "nextWeek", "averageCalories", "averageVegetables",
  "fruitDays", "fruitDaysContext", "friedDays", "friedDaysContext", "proteinBars", "calorieChart", "trendRange",
  "insightsKicker", "selectionAnnouncement",
  "sourceArticle", "openSource", "archiveList", "errorState", "errorMessage",
  "sourceDialog", "closeSource", "dialogTitle", "sourceImageStage", "sourceImageStatus",
  "sourceImageStatusText", "sourceImage", "downloadSource",
  "educationCategory", "educationIngredient", "educationTitle", "educationFact", "educationPrompt", "educationSource",
  "recipeInspired", "recipeTitle", "recipeMeta", "recipePreview", "recipeDetails",
  "recipeIngredients", "recipeSteps", "recipeAllergens", "recipeNote",
  "latestNews", "newsUpdated", "traceabilityStatus", "traceabilityNotice",
  "traceabilitySummary", "traceabilityDishes", "traceabilitySource",
  "mealTypeMeat", "mealTypeVegetarian", "mealTypeNote", "openDetail",
  "dishCount", "mainDishButton", "dishDetailDialog", "closeDishDetail",
  "dishDetailRole", "dishDetailTitle", "dishDetailCount", "dishDetailIngredients",
  "dishDetailNote", "previousDish", "nextDish",
  "gradeLower", "gradeUpper", "standardTarget", "standardTransitional",
  "standardPeriod", "standardBasis", "standardDescription", "standardSummary",
  "standardMetrics", "standardGuidance", "standardObservations", "standardMethod",
  "standardCoverage", "standardSource", "standardRevision",
  "districtSelect", "schoolSelect", "favoriteSchoolButton", "schoolDataScope", "schoolBrowserNote", "brandSchoolLabel", "footerSource",
  "mealTypeSwitch", "menuBoard", "menuKicker", "menuHeading", "reviewBadge",
  "officialSourceLink", "nutritionCard", "dinnerCard", "standard", "learn",
  "week", "todayGrid", "traceability", "news", "insights", "source", "traceabilityKicker", "traceabilityHeading",
  "passport", "passportLocked", "passportUnlock", "passportSetup", "childForm", "childNickname",
  "childGradeGroup", "childSchool", "childFormSubmit", "cancelChildEdit", "childSetupKicker", "childSetupTitle",
  "childSetupDescription", "childFormStatus", "passportWorkspace", "passportChildName", "passportChildSchool",
  "passportSchoolNotice", "passportSchoolNoticeText", "returnChildSchool", "editChildButton",
  "encounterForm", "passportFoodChoices", "customFoodName", "experienceChoices", "reactionChoices",
  "firstEncounter", "encounterChildQuote", "encounterPreparation", "encounterNote",
  "encounterFormStatus", "encounterList", "allEncounterRecords", "accountButton", "accountAvatar", "accountButtonText",
  "accountDialog", "closeAccountDialog", "accountSignedOutView", "accountSignedInView", "accountIdentity",
  "emailAuthForm", "authEmail", "authBirthDate", "authCaregiverConfirmed", "requestAuthCode", "authRequestStatus",
  "emailCodeStep", "authMaskedEmail", "emailCodeForm", "authCode", "verifyAuthCode", "authVerifyStatus",
  "changeAuthEmail", "accountSignOut",
];
const refs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function loadingState(message) {
  const status = node("div", "loading-state");
  status.setAttribute("role", "status");
  const spinner = node("span", "loading-spinner");
  spinner.setAttribute("aria-hidden", "true");
  status.append(spinner, node("span", "", message));
  return status;
}

async function responsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function setFormStatus(element, message = "", status = "") {
  element.textContent = message;
  element.classList.toggle("is-error", status === "error");
  element.classList.toggle("is-success", status === "success");
}

function selectedMealDate() {
  if (state.dashboard?.viewMode === "officialDaily") return state.dashboard.selectedDate;
  return state.dashboard?.selected?.date || localIsoDate();
}

function passportFoodOptions() {
  return [...new Set(state.dishDetails
    .map((dish) => dish?.name)
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim()))].slice(0, 8);
}

function schoolById(schoolId) {
  return state.schoolDirectory.find(
    (school) => Number(school.fatraceSchoolId) === Number(schoolId),
  ) || null;
}

function populateChildSchoolSelect(preferredSchoolId) {
  const selectedId = Number(preferredSchoolId) || Number(refs.childSchool.value) || Number(state.schoolId);
  refs.childSchool.replaceChildren();
  const placeholder = node(
    "option",
    "",
    state.schoolDirectory.length ? "請選擇孩子就讀的國小" : "正在讀取學校名冊…",
  );
  placeholder.value = "";
  refs.childSchool.append(placeholder);

  const groups = new Map();
  for (const school of state.schoolDirectory) {
    const label = `${school.city} · ${school.district}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(school);
  }
  for (const [label, schools] of groups) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const school of schools) {
      const option = node("option", "", school.name);
      option.value = String(school.fatraceSchoolId);
      group.append(option);
    }
    refs.childSchool.append(group);
  }
  refs.childSchool.disabled = !state.schoolDirectory.length;
  refs.childSchool.value = schoolById(selectedId) ? String(selectedId) : "";
}

function isViewingChildSchool() {
  const childSchoolId = Number(state.account.child?.schoolId);
  return Boolean(schoolById(childSchoolId) && Number(state.schoolId) === childSchoolId);
}

function renderPassportSchoolContext() {
  const child = state.account.child;
  if (!child) return;
  const childSchool = schoolById(child.schoolId);
  const viewingSchool = selectedSchool();
  refs.passportChildSchool.textContent = childSchool?.name || "尚未設定";
  refs.schoolBrowserNote.hidden = false;
  refs.schoolBrowserNote.textContent = `這裡只切換公開午餐；${child.nickname}的午餐紀錄學校要到「孩子資料」更改。`;

  const mismatch = Boolean(childSchool && !isViewingChildSchool());
  const missing = !childSchool;
  refs.passportSchoolNotice.hidden = !mismatch && !missing;
  refs.encounterForm.hidden = mismatch || missing;
  refs.returnChildSchool.hidden = missing;
  if (missing) {
    refs.passportSchoolNoticeText.textContent = `請先到「孩子資料」設定${child.nickname}就讀的國小，設定後才能新增午餐紀錄。`;
  } else if (mismatch) {
    refs.passportSchoolNoticeText.textContent = viewingSchool
      ? `目前正在查看${viewingSchool.name}的公開午餐；${child.nickname}的午餐紀錄仍屬於${childSchool.name}。回到${childSchool.name}後才能新增紀錄。`
      : `目前尚未顯示${childSchool.name}的午餐；回到孩子就讀學校後才能新增午餐紀錄。`;
    refs.returnChildSchool.textContent = `查看${childSchool.name}午餐`;
  }
}

function renderPassportFoodChoices() {
  const previous = refs.passportFoodChoices.querySelector('input[name="dishSource"]:checked')?.value;
  refs.passportFoodChoices.replaceChildren();
  const child = state.account.child;
  if (child) renderPassportSchoolContext();
  const childSchool = child ? schoolById(child.schoolId) : null;
  const viewingChildSchool = isViewingChildSchool();
  if (child && !viewingChildSchool) {
    refs.passportFoodChoices.append(node(
      "p",
      "encounter-empty",
      childSchool
        ? `切回${childSchool.name}後，這裡才會帶入孩子學校的午餐菜色。`
        : "先到「孩子資料」設定就讀國小，才會帶入孩子學校的午餐菜色。",
    ));
    return;
  } else if (!passportFoodOptions().length) {
    refs.passportFoodChoices.append(node("p", "encounter-empty", "選好學校與日期後，這裡會帶入當天菜色；也可以直接輸入食物名稱。"));
  }

  const foods = child && viewingChildSchool ? passportFoodOptions() : [];
  const choices = [
    ...foods.map((food) => ({ value: food, label: food })),
    { value: OTHER_FOOD_CONTEXT, label: "家裡／其他地方吃到" },
  ];
  choices.forEach(({ value, label: text }) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "dishSource";
    input.value = value;
    input.checked = value === previous;
    label.append(input, node("span", "", text));
    refs.passportFoodChoices.append(label);
  });
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

function renderEncounterHistory() {
  refs.encounterList.replaceChildren();
  const encounters = (state.account.encounters || []).slice(0, 5);
  const encounterCount = Number(state.account.encounterCount) || encounters.length;
  refs.allEncounterRecords.hidden = encounterCount <= 5;
  refs.allEncounterRecords.textContent = `查看全部 ${encounterCount} 筆午餐紀錄`;
  if (!encounters.length) {
    refs.encounterList.append(node("p", "encounter-empty", "第一筆不需要是「喜歡」。願意看、聞或碰一下，都是值得留下的午餐經驗。"));
    return;
  }
  for (const encounter of encounters) {
    const item = node("details", "encounter-item");
    const summary = document.createElement("summary");
    const summaryBody = node("div", "encounter-summary");
    const heading = document.createElement("header");
    const time = document.createElement("time");
    time.dateTime = encounter.mealDate;
    time.textContent = formatDate(encounter.mealDate);
    heading.append(node("strong", "", encounter.foodName), time);
    summaryBody.append(
      heading,
      node("p", "encounter-stage", experienceLabels[encounter.experience] || "食物經驗"),
      node("p", "encounter-origin", encounterOriginText(encounter)),
    );
    const reactionText = (encounter.reactions || [])
      .map((reaction) => reactionLabels[reaction])
      .filter(Boolean)
      .join("、");
    if (encounter.firstEncounter) {
      summaryBody.append(node("p", "encounter-first", "第一次遇到這個食物"));
    }
    if (reactionText) summaryBody.append(node("p", "encounter-reactions", reactionText));
    if (encounter.childQuote) summaryBody.append(node("p", "encounter-quote", `孩子說：「${encounter.childQuote}」`));
    if (encounter.preparation) summaryBody.append(node("p", "encounter-note", `做法：${encounter.preparation}`));
    if (encounter.note) summaryBody.append(node("p", "encounter-note", `家長筆記：${encounter.note}`));
    const expandLabel = node("span", "encounter-expand-label", "查看當天午餐");
    summary.append(summaryBody, expandLabel);
    const mealPreview = node("div", "encounter-meal-preview");
    mealPreview.setAttribute("aria-live", "polite");
    item.append(summary, mealPreview);
    item.addEventListener("toggle", async () => {
      expandLabel.textContent = item.open ? "收起當天午餐" : "查看當天午餐";
      if (!item.open || mealPreview.dataset.loaded === "true") return;
      mealPreview.dataset.loaded = "true";
      mealPreview.replaceChildren(node("p", "encounter-meal-status", "正在整理當天菜單…"));
      try {
        renderEncounterMealPreview(mealPreview, await encounterMealSnapshot(encounter), encounter);
      } catch (error) {
        console.error("Unable to load encounter meal", error);
        mealPreview.replaceChildren(node("p", "encounter-meal-status is-error", "當天菜單暫時無法讀取，請稍後再試。"));
      }
    });
    refs.encounterList.append(item);
  }
}

async function publicSiteData() {
  if (state.staticData) return state.staticData;
  const response = await fetch("./data/site-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`無法讀取公開版資料（HTTP ${response.status}）`);
  state.staticData = await response.json();
  return state.staticData;
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

async function encounterMealSnapshot(encounter) {
  const schoolId = Number(encounter.schoolId || state.account.child?.schoolId);
  const mealType = encounter.mealType === "vegetarian" ? "vegetarian" : "meat";
  const cacheKey = `${schoolId}:${encounter.mealDate}:${mealType}`;
  if (state.encounterMealCache[cacheKey]) return state.encounterMealCache[cacheKey];

  const school = schoolById(schoolId);
  const snapshot = {
    schoolName: school?.name || "孩子當時的學校",
    mealTypeLabel: mealType === "vegetarian" ? "素食" : "葷食",
    items: [],
    missing: false,
  };
  if (!schoolId) {
    snapshot.missing = true;
    state.encounterMealCache[cacheKey] = snapshot;
    return snapshot;
  }

  const data = await publicSiteData();
  if (schoolId === DEFAULT_SCHOOL_ID) {
    const day = data.variants?.[mealType]?.days?.find((candidate) => candidate.date === encounter.mealDate);
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
    record ||= data.officialSchoolMeals?.records?.[String(schoolId)]?.[encounter.mealDate] || null;
    const profile = OfficialDiet.profile(record);
    snapshot.items = OfficialDiet.filter(record, profile.hasVariants ? mealType : null).map((dish) => ({
      role: dish.category || "菜色",
      name: dish.name,
    }));
    snapshot.missing = !record;
  }
  state.encounterMealCache[cacheKey] = snapshot;
  return snapshot;
}

function sameFood(left, right) {
  const normalize = (value) => String(value || "").replace(/[\s＋+、，,]/g, "");
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function renderEncounterMealPreview(container, snapshot, encounter) {
  container.replaceChildren();
  const heading = node("div", "encounter-meal-heading");
  heading.append(
    node("strong", "", `${snapshot.schoolName}當天午餐`),
    node("span", "", `${formatDate(encounter.mealDate)} · ${snapshot.mealTypeLabel}`),
  );
  container.append(heading);
  const linkedDish = encounter.mealContext === "school_lunch" ? encounter.dishName : null;
  const relation = linkedDish
    ? encounter.foodName === linkedDish
      ? `這筆記錄的是整道「${linkedDish}」。`
      : `這筆記錄的是「${encounter.foodName}」，來源菜色是「${linkedDish}」。`
    : encounter.mealContext === "other"
      ? `「${encounter.foodName}」是在家裡或其他地方遇到，不屬於這份學校午餐。`
      : `這是舊紀錄，當時沒有保存「${encounter.foodName}」的來源菜色，因此無法確認它屬於哪一道菜。`;
  container.append(node("p", `encounter-relation${linkedDish ? " is-linked" : ""}`, relation));
  if (snapshot.missing || !snapshot.items.length) {
    container.append(node("p", "encounter-meal-status", "這一天沒有已收錄的同日菜單，不會拿別天的內容代替。"));
    return;
  }

  const list = node("ul", "encounter-meal-list");
  let linkedDishFound = false;
  for (const mealItem of snapshot.items) {
    const row = document.createElement("li");
    if (linkedDish && sameFood(mealItem.name, linkedDish)) {
      row.classList.add("is-recorded");
      linkedDishFound = true;
    }
    row.append(node("span", "", mealItem.role), node("strong", "", mealItem.name));
    list.append(row);
  }
  container.append(
    list,
    ...(linkedDish && !linkedDishFound
      ? [node("p", "encounter-meal-status", `目前的同日菜單中找不到來源菜色「${linkedDish}」。`)]
      : []),
    node("p", "encounter-meal-source", "同日已校讀菜單 · 只還原餐點脈絡，不代表孩子實際吃到的份量"),
  );
}

function renderAccount() {
  const account = state.account;
  const authenticated = Boolean(account.authenticated);
  refs.accountButton.classList.toggle("is-authenticated", authenticated);
  refs.accountAvatar.textContent = authenticated ? (account.child?.nickname?.slice(0, 1) || "家") : "家";
  refs.accountButton.disabled = !authenticated && !EMAIL_REGISTRATION_ENABLED;
  refs.accountButton.setAttribute("aria-disabled", String(refs.accountButton.disabled));
  refs.accountButtonText.textContent = authenticated
    ? account.child ? `${account.child.nickname}的午餐紀錄` : "建立午餐紀錄"
    : EMAIL_REGISTRATION_ENABLED ? "登入／免費註冊" : "登入／免費註冊（準備中）";
  refs.accountSignedOutView.hidden = authenticated;
  refs.accountSignedInView.hidden = !authenticated;
  renderEmailAuthStep();
  if (authenticated) {
    refs.accountIdentity.textContent = account.user?.email
      ? `${account.user.displayName} · ${account.user.email}`
      : `${account.user?.displayName || "家長"} · 免費會員`;
  }

  refs.passportLocked.hidden = authenticated;
  refs.passportSetup.hidden = !authenticated || (Boolean(account.child) && !state.editingChild);
  refs.passportWorkspace.hidden = !authenticated || !account.child || state.editingChild;
  refs.schoolBrowserNote.hidden = !authenticated || !account.child;
  if (authenticated && account.child) {
    refs.passportChildName.textContent = account.child.nickname;
    refs.childNickname.value = account.child.nickname;
    refs.childGradeGroup.value = account.child.gradeGroup;
    refs.childSetupKicker.textContent = "孩子資料";
    refs.childSetupTitle.textContent = `更新${account.child.nickname}的午餐紀錄`;
    refs.childSetupDescription.textContent = "就讀學校只會在這裡變更；上方選校只是查看其他學校的公開午餐。";
    refs.childFormSubmit.textContent = "儲存孩子資料";
    refs.cancelChildEdit.hidden = false;
    populateChildSchoolSelect(account.child.schoolId);
    renderPassportSchoolContext();
    renderPassportFoodChoices();
    renderEncounterHistory();
  } else if (authenticated) {
    refs.childSetupKicker.textContent = "先認識孩子";
    refs.childSetupTitle.textContent = "午餐紀錄中要怎麼稱呼孩子？";
    refs.childSetupDescription.textContent = "只需要暱稱、年級與就讀國小，不填生日或真實姓名；資料由登入的家長帳號保存。";
    refs.childFormSubmit.textContent = "建立免費午餐紀錄";
    refs.cancelChildEdit.hidden = true;
    populateChildSchoolSelect(state.schoolId);
  }
}

function renderEmailAuthStep() {
  const awaitingCode = EMAIL_REGISTRATION_ENABLED && Boolean(state.authChallengeId);
  refs.emailAuthForm.hidden = awaitingCode;
  refs.emailCodeStep.hidden = !awaitingCode;
  refs.requestAuthCode.disabled = !EMAIL_REGISTRATION_ENABLED;
  refs.requestAuthCode.setAttribute("aria-disabled", String(!EMAIL_REGISTRATION_ENABLED));
}

async function loadAccount() {
  try {
    const response = await fetch("/api/account", { cache: "no-store", credentials: "same-origin" });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "家庭帳號暫時無法讀取");
    state.account = { ...payload, loading: false, error: null };
  } catch (error) {
    state.account = {
      loading: false,
      authenticated: false,
      user: null,
      child: null,
      encounters: [],
      encounterCount: 0,
      error: error instanceof Error ? error.message : "家庭帳號暫時無法讀取",
    };
  }
  renderAccount();
}

async function requestEmailAuthCode() {
  if (!EMAIL_REGISTRATION_ENABLED) {
    setFormStatus(refs.authRequestStatus, "免費註冊準備中，目前尚未開放。", "error");
    return;
  }
  if (!refs.emailAuthForm.reportValidity()) return;
  refs.requestAuthCode.disabled = true;
  setFormStatus(refs.authRequestStatus, "正在寄送驗證碼…", "loading");
  try {
    const email = refs.authEmail.value.trim();
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email,
        birthDate: refs.authBirthDate.value,
        caregiverConfirmed: refs.authCaregiverConfirmed.checked,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "驗證碼暫時無法寄出");
    state.authChallengeId = payload.challengeId;
    state.authEmail = email;
    refs.authMaskedEmail.textContent = payload.maskedEmail || email;
    refs.authCode.value = "";
    setFormStatus(refs.authRequestStatus);
    setFormStatus(refs.authVerifyStatus);
    renderEmailAuthStep();
    refs.authCode.focus();
  } catch (error) {
    setFormStatus(
      refs.authRequestStatus,
      error instanceof Error ? error.message : "驗證碼暫時無法寄出",
      "error",
    );
  } finally {
    refs.requestAuthCode.disabled = false;
  }
}

async function verifyEmailAuthCode() {
  if (!refs.emailCodeForm.reportValidity() || !state.authChallengeId) return;
  refs.verifyAuthCode.disabled = true;
  setFormStatus(refs.authVerifyStatus, "正在驗證…", "loading");
  try {
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        challengeId: state.authChallengeId,
        code: refs.authCode.value,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "驗證碼無法確認");
    resetEmailAuthForm();
    await loadAccount();
    await closeAccountDialog();
    refs.passport.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setFormStatus(
      refs.authVerifyStatus,
      error instanceof Error ? error.message : "驗證碼無法確認",
      "error",
    );
  } finally {
    refs.verifyAuthCode.disabled = false;
  }
}

function resetEmailAuthForm() {
  state.authChallengeId = null;
  state.authEmail = null;
  refs.emailAuthForm.reset();
  refs.emailCodeForm.reset();
  setFormStatus(refs.authRequestStatus);
  setFormStatus(refs.authVerifyStatus);
  renderEmailAuthStep();
}

function adultBirthDateMaximum() {
  const today = new Date();
  const year = today.getFullYear() - 18;
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function openStagedDialog(dialog, motion, focusTarget) {
  if (dialog.open) return;
  window.clearTimeout(motion.closeTimer);
  window.cancelAnimationFrame(motion.openFrame);
  motion.closePromise = null;
  dialog.classList.remove("is-visible", "is-closing");
  dialog.showModal();
  focusTarget?.focus({ preventScroll: true });
  dialog.getBoundingClientRect();
  motion.openFrame = window.requestAnimationFrame(() => {
    motion.openFrame = 0;
    if (dialog.open) dialog.classList.add("is-visible");
  });
}

function closeStagedDialog(dialog, motion, { immediate = false } = {}) {
  if (!dialog.open) return Promise.resolve();
  if (dialog.classList.contains("is-closing")) {
    return motion.closePromise || Promise.resolve();
  }

  window.cancelAnimationFrame(motion.openFrame);
  motion.openFrame = 0;
  window.clearTimeout(motion.closeTimer);

  motion.closePromise = new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(motion.closeTimer);
      dialog.removeEventListener("transitionend", handleTransitionEnd);
      dialog.classList.remove("is-visible", "is-closing");
      if (dialog.open) dialog.close();
      motion.closePromise = null;
      resolve();
    };
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finishProperty = reducedMotion ? "opacity" : "transform";
    const handleTransitionEnd = (event) => {
      if (event.target === dialog && event.propertyName === finishProperty) finish();
    };

    if (immediate) {
      finish();
      return;
    }

    dialog.classList.add("is-closing");
    dialog.classList.remove("is-visible");
    dialog.addEventListener("transitionend", handleTransitionEnd);
    motion.closeTimer = window.setTimeout(
      finish,
      (reducedMotion ? AUX_DIALOG_REDUCED_MOTION_MS : AUX_DIALOG_MOTION_MS) + 80,
    );
  });

  return motion.closePromise;
}

function openAccountDialog(trigger) {
  if (!state.account.authenticated && !EMAIL_REGISTRATION_ENABLED) return;
  state.lastAccountTrigger = trigger || document.activeElement;
  openStagedDialog(
    refs.accountDialog,
    state.dialogMotion.account,
    refs.closeAccountDialog,
  );
  refs.accountDialog.querySelector(".account-dialog-shell")?.scrollTo({ top: 0 });
}

function closeAccountDialog(options) {
  return closeStagedDialog(refs.accountDialog, state.dialogMotion.account, options);
}

function openSourceDialog(trigger) {
  state.lastSourceTrigger = trigger || document.activeElement;
  openStagedDialog(refs.sourceDialog, state.dialogMotion.source, refs.closeSource);
}

function closeSourceDialog(options) {
  return closeStagedDialog(refs.sourceDialog, state.dialogMotion.source, options);
}

function setDashboardStatus(status, message) {
  refs.syncStatus.classList.remove("ready", "is-loading", "is-error");
  refs.syncStatus.classList.add(status === "ready" ? "ready" : `is-${status}`);
  refs.syncStatusText.textContent = message;
  refs.dashboard.setAttribute("aria-busy", String(status === "loading"));
}

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value, options = {}) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long", day: "numeric", ...options,
  }).format(new Date(year, month - 1, day));
}

function compactDate(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function formatNewsDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "long", day: "numeric",
  }).format(date);
}

function isLocalApiAvailable() {
  return window.location.protocol.startsWith("http") &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function dashboardFromStatic(data, selectedDate, mealType) {
  const variant = data.variants[mealType];
  const official = data.officialSchoolMeals || { schools: [], records: {} };
  const school = official.schools.find((item) => Number(item.fatraceSchoolId) === DEFAULT_SCHOOL_ID);
  const exact = variant.days.find((day) => day.date === selectedDate);
  const earlier = variant.days.filter((day) => day.date <= selectedDate);
  const active = exact || earlier.at(-1) || variant.days[0];
  return {
    viewMode: "detailed",
    school,
    schoolDirectory: official.schools,
    officialRecord: official.records?.[String(DEFAULT_SCHOOL_ID)]?.[active.date] || null,
    selected: active,
    mealType,
    mealTypeLabel: mealType === "meat" ? "葷食" : "素食",
    availableMealTypes: ["meat", "vegetarian"],
    requestedDate: selectedDate,
    isFallback: !exact,
    week: variant.days.filter((day) => day.weekId === active.weekId),
    nutritionStandard: data.nutritionStandard,
    nutritionAssessments: variant.nutritionAssessments?.[active.date],
    dinnerSuggestion: variant.dinnerSuggestions[active.date],
    foodEducation: variant.foodEducation[active.date],
    homeRecipe: variant.homeRecipes[active.date],
    traceability: variant.traceability?.[active.date],
    insights: variant.insights,
    archive: variant.archive,
    dateRange: variant.dateRange,
    totalDays: variant.totalDays,
  };
}

function officialDashboardFromStatic(data, selectedDate, schoolId, mealType) {
  const catalog = data.officialSchoolMeals;
  if (!catalog) throw new Error("公開版資料尚未包含跨校午餐紀錄");
  const school = catalog.schools.find((item) => Number(item.fatraceSchoolId) === Number(schoolId));
  if (!school) throw new Error(`找不到學校代碼：${schoolId}`);
  const record = catalog.records?.[String(schoolId)]?.[selectedDate] || null;
  const sourceUrl = `https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=${encodeURIComponent(schoolId)}&period=${encodeURIComponent(selectedDate)}`;
  return {
    viewMode: "officialDaily",
    school,
    schoolDirectory: catalog.schools,
    requestedDate: selectedDate,
    selectedDate,
    record,
    records: catalog.records?.[String(schoolId)] || {},
    isMissing: !record,
    availableDates: school.recordDates || [],
    dateRange: school.dateRange,
    totalDays: school.recordCount || 0,
    sourceUrl: record?.source?.url || sourceUrl,
    mealType,
    mealTypeLabel: mealType === "vegetarian" ? "素食" : "葷食",
    dataNotice: "教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；同日的主食、主菜中若同時出現有「素」字與未標示「素」的菜色，本站依菜名的「素」字拆分主食、主菜與副菜，其他分類列為共用。",
  };
}

async function fetchDashboard(date) {
  if (!state.schoolId) throw new Error("請先選擇學校");
  if (state.schoolId !== DEFAULT_SCHOOL_ID || isLocalApiAvailable()) {
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}&mealType=${encodeURIComponent(state.mealType)}&schoolId=${encodeURIComponent(state.schoolId)}`, { cache: "no-store" });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (response.ok && isJson) {
        const dashboard = await response.json();
        if (dashboard.record) return dashboard;
      }
    } catch (error) {
      console.info("Live API unavailable; using the reviewed static snapshot.", error);
    }
  }
  if (!state.staticData) {
    const response = await fetch("./data/site-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`無法讀取公開版資料（HTTP ${response.status}）`);
    state.staticData = await response.json();
  }
  return state.schoolId === DEFAULT_SCHOOL_ID
    ? dashboardFromStatic(state.staticData, date, state.mealType)
    : officialDashboardFromStatic(state.staticData, date, state.schoolId, state.mealType);
}

async function fetchSchoolDirectory() {
  let response;
  try {
    response = await fetch("/api/schools", { cache: "no-store" });
  } catch (error) {
    console.info("Live school directory unavailable; using the static snapshot.", error);
  }
  if (!response?.ok) response = await fetch("./data/schools.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`無法讀取學校名冊（HTTP ${response.status}）`);
  const payload = await response.json();
  if (!Array.isArray(payload.schools)) throw new Error("學校名冊格式不正確");
  return payload.schools;
}

async function fetchNews() {
  let response;
  try {
    response = await fetch("/api/news", { cache: "no-store" });
  } catch (error) {
    console.info("Live news endpoint unavailable; using the static snapshot.", error);
  }
  if (!response?.ok) response = await fetch("./data/news.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`無法讀取午餐觀察（HTTP ${response.status}）`);
  return response.json();
}

function newsCard(item) {
  const article = node("article", "news-preview-card card");
  const meta = node("div", "news-meta");
  meta.append(
    node("span", `news-tag${item.isLocal ? " local" : ""}`, item.isLocal ? "臺中優先" : item.category),
    node("time", "", formatNewsDate(item.publishedAt)),
  );
  const title = node("h3");
  const link = node("a", "", item.title);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);
  article.append(
    meta,
    title,
    node("p", "news-why", item.whyItMatters),
    node("span", "news-source", `${item.sourceType} · ${item.source}`),
  );
  return article;
}

async function loadNewsPreview() {
  refs.latestNews.setAttribute("aria-busy", "true");
  refs.latestNews.replaceChildren(loadingState("正在整理近期午餐消息…"));
  refs.newsUpdated.textContent = "正在讀取近期消息…";
  try {
    const payload = await fetchNews();
    const items = Array.isArray(payload.items) ? payload.items.slice(0, 2) : [];
    refs.latestNews.replaceChildren(...items.map(newsCard));
    if (!items.length) {
      refs.latestNews.append(node("p", "news-empty", "近 30 天暫時沒有符合條件的消息。"));
    }
    refs.newsUpdated.textContent = `最近更新：${formatNewsDate(payload.generatedAt)} · 僅整理近 ${payload.lookbackDays || 30} 天`;
  } catch (error) {
    refs.latestNews.replaceChildren(node("p", "news-empty", "近期消息暫時讀取不到，午餐菜單仍可正常使用。"));
    refs.newsUpdated.textContent = "新聞資料暫時無法更新";
  } finally {
    state.newsLoaded = true;
    refs.latestNews.setAttribute("aria-busy", "false");
  }
}

function renderMeal(day) {
  if (refs.dishDetailDialog.open) {
    state.lastDishTrigger = null;
    closeDishDetail({ immediate: true });
  }
  refs.mainDish.textContent = day.meal.mainDish;
  refs.heroDish.textContent = day.meal.mainDish;
  refs.mealList.replaceChildren();
  const sourceDishes = Array.isArray(day.recipeDetails) ? day.recipeDetails : [];
  const detailedRoles = new Set(sourceDishes.map((dish) => dish.role));
  const supplementalItems = [
    !detailedRoles.has("fruit") && day.meal.fruit
      ? { label: "水果", value: day.meal.fruit }
      : null,
    !detailedRoles.has("drink") && day.meal.drink
      ? { label: "飲品", value: day.meal.drink }
      : null,
  ].filter(Boolean);
  state.dishDetails = sourceDishes;
  state.activeDishIndex = -1;
  refs.dishCount.textContent = sourceDishes.length
    ? supplementalItems.length
      ? `菜單共 ${sourceDishes.length + supplementalItems.length} 道 · 其中 ${sourceDishes.length} 道可查看食材與設計用量`
      : `本餐共 ${sourceDishes.length} 道 · 點選菜色查看食材與設計用量`
    : "菜色依午餐總表校讀";

  const mainDishIndex = sourceDishes.findIndex((dish) => dish.role === "main");
  refs.mainDishButton.disabled = mainDishIndex < 0;
  refs.mainDishButton.setAttribute(
    "aria-label",
    mainDishIndex >= 0 ? `查看主菜「${day.meal.mainDish}」的食材與設計用量` : "這餐主角",
  );
  refs.mainDishButton.onclick = mainDishIndex >= 0
    ? () => openDishDetail(mainDishIndex, refs.mainDishButton)
    : null;

  const items = sourceDishes.length
    ? [
      ...sourceDishes
        .filter((dish) => dish.role !== "main")
        .map((dish) => ({ label: roleLabels[dish.role] || "配菜", value: dish.name, dish })),
      ...supplementalItems,
    ]
    : [
      { label: "主食", value: day.meal.staple },
      ...day.meal.sideDishes.map((dish, index) => ({ label: `配菜 ${index + 1}`, value: dish })),
      { label: "湯品", value: day.meal.soup },
      { label: day.meal.drink ? "飲品" : "水果", value: day.meal.drink || day.meal.fruit },
    ].filter(({ value }) => value);
  for (const { label, value, dish } of items) {
    const item = node(dish ? "button" : "div", "meal-item");
    if (dish) {
      const dishIndex = sourceDishes.indexOf(dish);
      item.type = "button";
      item.setAttribute("aria-label", `查看${label}「${value}」的食材與設計用量`);
      item.addEventListener("click", () => openDishDetail(dishIndex, item));
    }
    item.append(node("span", "", label), node("strong", "", value));
    refs.mealList.append(item);
  }
  refs.allergenRow.textContent = day.allergens.length
    ? `原圖標示／菜名可辨識的過敏原：${day.allergens.join("、")}`
    : "過敏原資訊請仍以校方原始菜單與個人需求核對。";
}

function ingredientQuantity(ingredient) {
  if (ingredient.officialRecord) return "官方未提供用量";
  return ingredient.quantityText || [
    ingredient.quantityValue,
    ingredient.quantityUnit,
  ].filter((value) => value !== null && value !== undefined).join(" ") || "未標示";
}

function renderDishDetail() {
  const dish = state.dishDetails[state.activeDishIndex];
  if (!dish) return;
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
  refs.dishDetailRole.textContent = dish.category || roleLabels[dish.role] || "菜色";
  refs.dishDetailTitle.textContent = dish.name;
  refs.dishDetailCount.textContent = `食譜明細共 ${ingredients.length} 項`;
  refs.dishDetailIngredients.replaceChildren();

  if (!ingredients.length) {
    refs.dishDetailIngredients.append(node("p", "dish-detail-empty", "這道菜的食材明細尚未提供。"));
  }
  for (const ingredient of ingredients) {
    const row = node("article", "dish-detail-ingredient");
    const heading = node("div", "dish-detail-ingredient-heading");
    heading.append(
      node("strong", "", ingredient.name),
      node("span", "", ingredientQuantity(ingredient)),
    );
    const badges = node("div", "ingredient-source-badges");
    if (ingredient.officialRecord) {
      for (const certification of ingredient.certifications || []) {
        badges.append(node("span", "ingredient-trace verified", certification.name));
      }
      if (!(ingredient.certifications || []).length) {
        badges.append(node("span", "ingredient-trace unavailable", "未提供標章"));
      }
    } else {
      for (const claim of ingredient.claims || []) {
        badges.append(node("span", `source-claim ${claim}`, claimLabels[claim] || claim));
      }
      const status = ingredient.traceabilityStatus || "unavailable";
      badges.append(node(
        "span",
        `ingredient-trace ${status}`,
        traceabilityStatusLabels[status] || traceabilityStatusLabels.unavailable,
      ));
    }
    row.append(heading, badges);
    refs.dishDetailIngredients.append(row);
  }

  refs.dishDetailNote.textContent = dish.officialRecord
    ? "食材名稱、產地、供應商與標章照教育部當日公開紀錄呈現；官方頁面沒有提供每人用量。"
    : state.mealType === "vegetarian"
    ? "素食菜單可能含蛋、奶；用量為供餐廠商的食譜設計值，不代表實際攝取量。"
    : "用量為供餐廠商的食譜設計值，不代表實際攝取量。";
  refs.previousDish.disabled = state.activeDishIndex === 0;
  refs.nextDish.disabled = state.activeDishIndex === state.dishDetails.length - 1;
  const previous = state.dishDetails[state.activeDishIndex - 1];
  const next = state.dishDetails[state.activeDishIndex + 1];
  refs.previousDish.setAttribute("aria-label", previous ? `查看上一道：${previous.name}` : "已是第一道菜");
  refs.nextDish.setAttribute("aria-label", next ? `查看下一道：${next.name}` : "已是最後一道菜");
}

function openDishDetail(index, trigger) {
  if (!state.dishDetails[index]) return;
  state.activeDishIndex = index;
  state.lastDishTrigger = trigger || document.activeElement;
  renderDishDetail();
  if (refs.dishDetailDialog.open) return;

  window.clearTimeout(state.dishDetailCloseTimer);
  window.cancelAnimationFrame(state.dishDetailOpenFrame);
  refs.dishDetailDialog.classList.remove("is-visible", "is-closing");
  refs.dishDetailDialog.showModal();
  refs.dishDetailDialog.focus({ preventScroll: true });
  refs.dishDetailDialog.getBoundingClientRect();
  state.dishDetailOpenFrame = window.requestAnimationFrame(() => {
    state.dishDetailOpenFrame = 0;
    if (refs.dishDetailDialog.open) {
      refs.dishDetailDialog.classList.add("is-visible");
    }
  });
}

function closeDishDetail({ immediate = false } = {}) {
  const dialog = refs.dishDetailDialog;
  if (!dialog.open || dialog.classList.contains("is-closing")) return;

  window.cancelAnimationFrame(state.dishDetailOpenFrame);
  state.dishDetailOpenFrame = 0;
  window.clearTimeout(state.dishDetailCloseTimer);

  if (immediate) {
    dialog.classList.remove("is-visible", "is-closing");
    dialog.close();
    return;
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const finishProperty = reducedMotion ? "opacity" : "transform";
  const finish = () => {
    window.clearTimeout(state.dishDetailCloseTimer);
    dialog.removeEventListener("transitionend", handleTransitionEnd);
    dialog.classList.remove("is-visible", "is-closing");
    if (dialog.open) dialog.close();
  };
  const handleTransitionEnd = (event) => {
    if (event.target === dialog && event.propertyName === finishProperty) finish();
  };

  dialog.classList.add("is-closing");
  dialog.classList.remove("is-visible");
  dialog.addEventListener("transitionend", handleTransitionEnd);
  state.dishDetailCloseTimer = window.setTimeout(
    finish,
    (reducedMotion ? DISH_DETAIL_REDUCED_MOTION_MS : DISH_DETAIL_MOTION_MS) + 80,
  );
}

function renderNutrition(nutrition) {
  refs.calories.textContent = LunchNumberFormat.sourceCalories(nutrition.caloriesKcal);
  refs.nutritionBars.replaceChildren();
  const entries = [
    ["全穀雜糧", nutrition.wholeGrainsServings, 6],
    ["豆魚蛋肉", nutrition.proteinServings, 5],
    ["蔬菜", nutrition.vegetablesServings, 3],
    ["油脂堅果", nutrition.oilsNutsServings, 4],
    ["水果", nutrition.fruitServings, 2],
  ];
  for (const [label, value, scale] of entries) {
    const row = node("div", "nutrition-row");
    const track = node("div", "bar-track");
    const fill = node("div", "bar-fill");
    fill.style.width = `${Math.min(100, (value / scale) * 100)}%`;
    track.append(fill);
    row.append(node("span", "", label), track, node("strong", "", `${value} 份`));
    refs.nutritionBars.append(row);
  }
}

function renderStandard(dashboard) {
  const assessment = dashboard.nutritionAssessments?.[state.gradeGroup]?.[state.standardMode];
  const standard = dashboard.nutritionStandard;
  if (!assessment || !standard) {
    refs.standardDescription.textContent = "這份資料快照尚未包含營養基準，請重新建立網站資料。";
    refs.standardSummary.textContent = "基準資料待更新";
    refs.standardMetrics.replaceChildren();
    refs.standardGuidance.replaceChildren();
    refs.standardObservations.replaceChildren();
    return;
  }

  refs.gradeLower.setAttribute("aria-pressed", String(state.gradeGroup === "elementary_lower"));
  refs.gradeUpper.setAttribute("aria-pressed", String(state.gradeGroup === "elementary_upper"));
  refs.standardTarget.setAttribute("aria-pressed", String(state.standardMode === "target"));
  refs.standardTransitional.setAttribute("aria-pressed", String(state.standardMode === "transitional"));
  refs.standardPeriod.textContent = [
    `${compactDate(assessment.period.start)}–${compactDate(assessment.period.end)}`,
    `${assessment.dayCount} 個供餐日`,
    assessment.mealTypeLabel,
  ].join(" · ");
  refs.standardBasis.textContent = `${assessment.gradeLabel} · ${assessment.modeLabel}`;
  refs.standardDescription.textContent = assessment.modeDescription;
  refs.standardSummary.textContent = assessment.summary.label;

  refs.standardMetrics.replaceChildren();
  for (const metric of assessment.metrics) {
    const card = node("article", `standard-metric ${metric.status}`);
    const heading = node("header");
    heading.append(
      node("span", "", metric.label),
      node("span", "standard-status", metric.statusLabel),
    );
    card.append(
      heading,
      node("strong", "", metric.valueLabel),
      node("p", "", metric.targetLabel),
      node("small", "", metric.message),
    );
    refs.standardMetrics.append(card);
  }

  refs.standardGuidance.replaceChildren(
    ...assessment.guidance.map((item) => node("li", "", item)),
  );
  refs.standardObservations.replaceChildren();
  for (const observation of assessment.observations) {
    const card = node("article", "standard-observation");
    card.append(
      node("strong", "", observation.label),
      node("span", "", observation.valueLabel),
    );
    const note = node("p");
    const reference = node("b", "", observation.referenceLabel);
    note.append(reference, document.createTextNode(`；${observation.note}`));
    card.append(note);
    refs.standardObservations.append(card);
  }

  refs.standardMethod.textContent = assessment.methodNote;
  refs.standardCoverage.textContent = assessment.coverageNote;
  refs.standardSource.textContent = standard.source.title;
  refs.standardSource.href = standard.source.url;
  refs.standardRevision.textContent = ` · ${standard.source.revisionLabel} · 本站校讀 ${standard.source.reviewedAt}`;
}

function traceabilityDetail(label, value, url = null) {
  const row = node("div", "traceability-detail");
  row.append(node("dt", "", label));
  const description = node("dd");
  if (url) {
    const link = node("a", "", value);
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    description.append(link);
  } else {
    description.textContent = value;
  }
  row.append(description);
  return row;
}

function renderIngredient(ingredient) {
  const card = node("article", "ingredient-card");
  const heading = node("div", "ingredient-heading");
  heading.append(node("strong", "", ingredient.name));
  const certification = ingredient.certification;
  const certificationLabel = certification?.label.includes("CAS")
    ? "CAS"
    : certification?.label || ingredient.platformMark;
  heading.append(node(
    "span",
    `certification-badge${certification ? "" : " empty"}`,
    certificationLabel || "未提供標章",
  ));
  card.append(heading);

  const details = node("dl", "ingredient-details");
  if (ingredient.referenceDate) {
    details.append(
      traceabilityDetail("匹配依據", ingredient.matchReason),
      traceabilityDetail(
        "資料日期",
        formatDate(ingredient.referenceDate, { year: "numeric" }),
      ),
      traceabilityDetail("原始菜色", ingredient.referenceDishName),
    );
  }
  const supplier = ingredient.supplier;
  if (ingredient.producer) {
    details.append(traceabilityDetail("製造／生產者", ingredient.producer.name));
  }
  if (ingredient.platformMark) {
    details.append(traceabilityDetail("平臺標示", ingredient.platformMark));
  }
  if (ingredient.originCountry) {
    details.append(traceabilityDetail("原料產地（國）", ingredient.originCountry));
  }
  details.append(
    traceabilityDetail("平臺申報供應商", supplier.name),
    traceabilityDetail("供應商統編", supplier.taxId || "未提供"),
  );
  if (supplier.address) details.append(traceabilityDetail("供應商地址", supplier.address));

  if (certification) {
    details.append(traceabilityDetail(
      "認證／追溯號碼",
      certification.number,
      certification.officialUrl,
    ));
    if (certification.operator) {
      details.append(traceabilityDetail(
        "認證經營者",
        certification.operator.name,
        certification.operator.sourceUrl,
      ));
      if (certification.operator.address) {
        details.append(traceabilityDetail("經營者所在地", certification.operator.address));
      }
    }
    if (certification.verificationBody) {
      details.append(traceabilityDetail("驗證／管理單位", certification.verificationBody));
    }
    if (certification.status || certification.validUntil) {
      const state = [
        certification.status,
        certification.validUntil ? `效期至 ${formatDate(certification.validUntil, { year: "numeric" })}` : null,
      ].filter(Boolean).join(" · ");
      details.append(traceabilityDetail("查核狀態", state));
    }
  } else if (ingredient.platformMark) {
    details.append(traceabilityDetail("追溯號碼", "本次頁面截圖未顯示可核對的號碼"));
  } else {
    details.append(traceabilityDetail("標章資料", "這筆平臺資料未提供認證標章或追溯號碼"));
  }
  card.append(details);
  return card;
}

function renderTraceability(traceability) {
  refs.traceabilityDishes.replaceChildren();
  refs.traceabilityStatus.className = "traceability-status";
  if (!traceability || traceability.status === "unavailable") {
    refs.traceabilityStatus.textContent = "等待官方資料";
    refs.traceabilityStatus.classList.add("unavailable");
    refs.traceabilityNotice.textContent = traceability?.notice || "目前沒有已校讀的官方食材明細。";
    refs.traceabilitySummary.textContent = "本日菜單已收錄 · 食材來源待補";
    const empty = node("div", "traceability-empty");
    empty.append(
      node("strong", "", "目前沒有可靠的食材匹配"),
      node("p", "", "同日資料尚未取得，這套餐別的菜名也沒有可與既有資料明確對應的食材。"),
    );
    refs.traceabilityDishes.append(empty);
    refs.traceabilitySource.textContent = "";
    return;
  }

  const isHistoricalMatch = traceability.status === "matched_reference";
  refs.traceabilityStatus.textContent = isHistoricalMatch
    ? `歷史匹配 · ${traceability.ingredientCount} 項`
    : `本餐別已比對 · ${compactDate(traceability.dataDate)}`;
  refs.traceabilityStatus.classList.add(isHistoricalMatch ? "reference" : "verified");
  refs.traceabilityNotice.textContent = traceability.notice;
  refs.traceabilitySummary.textContent = isHistoricalMatch
    ? `${traceability.dishes.length} 道菜找到匹配 · ${traceability.ingredientCount} 項歷史食材來源`
    : `${traceability.dishes.length} 道菜 · ${traceability.ingredientCount} 項食材 · ${traceability.markedIngredientCount ?? traceability.certifiedIngredientCount} 項附標章／溯源標示`;

  for (const dish of traceability.dishes) {
    const details = node("details", "traceability-dish");
    const summary = node("summary");
    const title = node("span", "traceability-dish-title");
    title.append(node("small", "", dish.category || "菜色"), node("strong", "", dish.name));
    if (dish.officialName && dish.officialName !== dish.name) {
      title.append(node("em", "", `平臺名稱：${dish.officialName}`));
    }
    summary.append(title, node("span", "traceability-count", `${dish.ingredients.length} 項食材`));
    const ingredients = node("div", "ingredient-grid");
    ingredients.append(...dish.ingredients.map(renderIngredient));
    details.append(summary, ingredients);
    refs.traceabilityDishes.append(details);
  }

  refs.traceabilitySource.textContent = isHistoricalMatch
    ? `資料來源：${traceability.sourceName} · 歷史資料日期 ${traceability.referenceDates.map(compactDate).join("、")} · 不代表本日供應批次`
    : `資料來源：${traceability.sourceName} · 供餐日期 ${compactDate(traceability.dataDate)} · 校讀日期 ${traceability.reviewedAt}`;
}

function renderDinner(suggestion) {
  refs.dinnerTitle.textContent = "這天晚餐，換個主角";
  refs.dinnerPicks.replaceChildren(...suggestion.recommendations.map((item) => node("span", "", item)));
  refs.dinnerReason.textContent = suggestion.reason;
  refs.dinnerNotes.replaceChildren(...suggestion.notes.map((text) => node("li", "", text)));
  refs.disclaimer.textContent = suggestion.disclaimer;
}

function renderFoodEducation(card) {
  refs.educationCategory.textContent = `健康小常識 · ${card.category || "吃得更懂"}`;
  refs.educationIngredient.textContent = card.ingredient;
  refs.educationTitle.textContent = card.title;
  refs.educationFact.textContent = card.fact;
  refs.educationPrompt.textContent = card.prompt;
  refs.educationSource.textContent = card.source.label;
  refs.educationSource.href = card.source.url;
}

function renderHomeRecipe(recipe) {
  refs.recipeInspired.textContent = `從「${recipe.inspiredBy}」延伸`;
  refs.recipeTitle.textContent = recipe.title;
  refs.recipeMeta.replaceChildren(
    node("span", "", recipe.time),
    node("span", "", recipe.servings),
  );
  refs.recipePreview.replaceChildren(
    ...recipe.ingredients.slice(0, 3).map((item) => node("span", "", item)),
  );
  refs.recipeIngredients.replaceChildren(
    ...recipe.ingredients.map((item) => node("li", "", item)),
  );
  refs.recipeSteps.replaceChildren(
    ...recipe.steps.map((step) => node("li", "", step)),
  );
  refs.recipeAllergens.textContent = `留意過敏原：${recipe.allergens.join("、")}`;
  refs.recipeNote.textContent = recipe.note;
  refs.recipeDetails.open = false;
}

function renderWeek(dashboard) {
  const active = dashboard.selected;
  refs.weekLabel.textContent = `第 ${active.week} 週 · ${compactDate(active.weekStartDate)}–${compactDate(active.weekEndDate)}`;
  refs.weekDays.replaceChildren();
  for (const day of dashboard.week) {
    const button = node("button", "day-card");
    button.type = "button";
    button.dataset.date = day.date;
    button.setAttribute("aria-current", String(day.date === active.date));
    const dateLine = node("div", "day-date");
    dateLine.append(node("span", "", day.weekday), node("strong", "", day.date.slice(-2)));
    const sides = [day.meal.staple, ...day.meal.sideDishes.slice(0, 2)].join(" · ");
    const hasTraceability = day.traceabilityStatus === "verified";
    const hasHistoricalMatch = day.traceabilityStatus === "matched_reference";
    const traceabilityLabel = hasTraceability
      ? `${day.traceableIngredientCount} 項同日可追溯`
      : hasHistoricalMatch
        ? `${day.traceableIngredientCount} 項歷史匹配`
        : "溯源待補";
    const traceabilityClass = hasTraceability
      ? "verified"
      : hasHistoricalMatch ? "reference" : "pending";
    button.append(
      dateLine,
      node("h3", "", day.meal.mainDish),
      node("span", `day-traceability ${traceabilityClass}`, traceabilityLabel),
      node("p", "", sides),
    );
    button.addEventListener("click", () => loadDashboard(day.date, {
      announce: true,
      focusWeekDay: true,
    }));
    refs.weekDays.append(button);
  }

  const archiveIndex = dashboard.archive.findIndex((week) => week.id === active.weekId);
  refs.previousWeek.disabled = archiveIndex < 0 || archiveIndex >= dashboard.archive.length - 1;
  refs.nextWeek.disabled = archiveIndex <= 0;
  refs.previousWeek.onclick = () => loadDashboard(
    dashboard.archive[archiveIndex + 1].startDate,
    { announce: true },
  );
  refs.nextWeek.onclick = () => loadDashboard(
    dashboard.archive[archiveIndex - 1].startDate,
    { announce: true },
  );
}

function renderInsights(insights, dashboard) {
  refs.insightsKicker.textContent = LunchDateContext.insightsPeriodLabel(
    dashboard.dateRange.start,
    dashboard.dateRange.end,
  );
  refs.averageCalories.textContent = insights.averageCaloriesKcal;
  refs.averageVegetables.textContent = `約 ${insights.averageVegetablesServings} 份`;
  refs.fruitDays.textContent = `${insights.fruitDays} 天`;
  refs.fruitDaysContext.textContent = `共 ${dashboard.totalDays} 個供餐日`;
  refs.friedDays.textContent = `${insights.friedDays} 天`;
  refs.friedDaysContext.textContent = `共 ${dashboard.totalDays} 個供餐日`;

  refs.proteinBars.replaceChildren();
  const maxProtein = Math.max(...insights.proteinCounts.map((item) => item.count), 1);
  for (const item of insights.proteinCounts) {
    const row = node("div", "protein-row");
    const track = node("div", "bar-track");
    const fill = node("div", "bar-fill");
    fill.style.width = `${(item.count / maxProtein) * 100}%`;
    track.append(fill);
    row.append(node("span", "", item.label), track, node("strong", "", item.count));
    refs.proteinBars.append(row);
  }

  refs.calorieChart.replaceChildren();
  const values = insights.calorieTrend.map((item) => item.value);
  const minimum = Math.min(...values) - 40;
  const maximum = Math.max(...values) + 20;
  for (const point of insights.calorieTrend) {
    const column = node("div", "calorie-column");
    const height = Math.max(8, ((point.value - minimum) / (maximum - minimum)) * 100);
    column.dataset.label = `${compactDate(point.date)} · ${LunchNumberFormat.sourceCalories(point.value)} kcal`;
    column.style.setProperty("--height", `${height}%`);
    const bar = node("i");
    bar.style.height = `${height}%`;
    column.append(bar);
    refs.calorieChart.append(column);
  }
  refs.trendRange.textContent = `${compactDate(dashboard.dateRange.start)}–${compactDate(dashboard.dateRange.end)}`;
}

function renderArchive(dashboard) {
  refs.archiveList.replaceChildren();
  for (const week of dashboard.archive) {
    const button = node("button", "archive-item");
    button.type = "button";
    button.append(
      node("strong", "", `W${String(week.week).padStart(2, "0")}`),
      (() => { const wrap = node("span"); wrap.append(node("span", "", `${compactDate(week.startDate)}–${compactDate(week.endDate)}`), node("small", "", `${week.dayCount} 個供餐日 · 已校讀`)); return wrap; })()
    );
    button.addEventListener("click", () => loadDashboard(week.startDate, { announce: true }));
    refs.archiveList.append(button);
  }
}

function renderSource(day) {
  refs.sourceArticle.hidden = !day.source.url;
  if (day.source.url) refs.sourceArticle.href = day.source.url;
  const openImage = (kind, trigger) => {
    const isDetail = kind === "detail";
    const image = isDetail ? day.source.detailImage : day.source.image;
    const label = isDetail
      ? `${day.mealType === "meat" ? "葷食" : "素食"}食譜用量明細`
      : "原始午餐菜單";
    const requestId = ++state.sourceImageRequestId;
    refs.sourceImage.onload = null;
    refs.sourceImage.onerror = null;
    refs.sourceImage.removeAttribute("src");
    refs.sourceImage.alt = `第 ${day.week} 週${label}`;
    refs.downloadSource.href = image;
    const imageExtension = image.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || "jpg";
    refs.downloadSource.download = `week-${String(day.week).padStart(2, "0")}-${isDetail ? day.mealType : "menu"}.${imageExtension}`;
    refs.dialogTitle.textContent = `第 ${day.week} 週${label}`;
    refs.sourceDialog.dataset.kind = kind;
    setSourceImageState("loading", `正在載入第 ${day.week} 週${label}…`);
    openSourceDialog(trigger);
    refs.sourceImage.onload = async () => {
      try {
        await refs.sourceImage.decode();
      } catch (error) {
        // The load event already confirms usable pixels when decode is unavailable.
      }
      if (requestId === state.sourceImageRequestId) {
        setSourceImageState("ready", `${label}已載入`);
      }
    };
    refs.sourceImage.onerror = () => {
      if (requestId === state.sourceImageRequestId) {
        refs.sourceImage.alt = "";
        setSourceImageState("error", `${label}載入失敗，請稍後再試。`);
      }
    };
    refs.sourceImage.src = image;
  };
  refs.openSource.onclick = () => openImage("summary", refs.openSource);
  refs.openDetail.onclick = () => openImage("detail", refs.openDetail);
}

function setSourceImageState(status, message) {
  refs.sourceImageStage.dataset.state = status;
  refs.sourceImageStatus.setAttribute("role", status === "error" ? "alert" : "status");
  refs.sourceImageStatusText.textContent = message;
  refs.sourceDialog.setAttribute("aria-busy", String(status === "loading"));
  refs.downloadSource.hidden = status !== "ready";
}

function districtKey(school) {
  return `${school.city}\u0000${school.district}`;
}

function selectedSchool() {
  return state.schoolDirectory.find(
    (school) => Number(school.fatraceSchoolId) === Number(state.schoolId),
  ) || null;
}

function renderFavoriteButton() {
  const school = selectedSchool();
  const isFavorite = school && Number(school.fatraceSchoolId) === state.favoriteSchoolId;
  refs.favoriteSchoolButton.disabled = !school;
  refs.favoriteSchoolButton.classList.toggle("is-favorite", Boolean(isFavorite));
  refs.favoriteSchoolButton.textContent = isFavorite ? "★ 我的最愛（可取消）" : "☆ 設為我的最愛";
  refs.favoriteSchoolButton.setAttribute("aria-pressed", String(Boolean(isFavorite)));
}

function populateSchoolSelectors() {
  const districts = [];
  const seenDistricts = new Set();
  for (const school of state.schoolDirectory) {
    const key = districtKey(school);
    if (!seenDistricts.has(key)) {
      seenDistricts.add(key);
      districts.push({ key, city: school.city, district: school.district });
    }
  }
  const activeSchool = selectedSchool();
  if (activeSchool) state.district = districtKey(activeSchool);
  if (!state.district || !seenDistricts.has(state.district)) {
    state.district = districts[0]?.key || null;
  }

  refs.districtSelect.replaceChildren();
  for (const district of districts) {
    const option = node("option", "", `${district.city} · ${district.district}`);
    option.value = district.key;
    refs.districtSelect.append(option);
  }
  refs.districtSelect.value = state.district || "";

  refs.schoolSelect.replaceChildren();
  const placeholder = node("option", "", "請選擇國小");
  placeholder.value = "";
  refs.schoolSelect.append(placeholder);
  for (const school of state.schoolDirectory.filter((item) => districtKey(item) === state.district)) {
    const option = node("option", "", school.name);
    option.value = String(school.fatraceSchoolId);
    refs.schoolSelect.append(option);
  }
  refs.schoolSelect.value = activeSchool ? String(activeSchool.fatraceSchoolId) : "";
  renderFavoriteButton();
}

function renderSchoolContext(dashboard) {
  if (Array.isArray(dashboard.schoolDirectory) && dashboard.schoolDirectory.length) {
    state.schoolDirectory = dashboard.schoolDirectory;
  }
  if (dashboard.school) {
    state.schoolId = Number(dashboard.school.fatraceSchoolId);
    state.district = districtKey(dashboard.school);
    populateSchoolSelectors();
    refs.brandSchoolLabel.textContent = `${dashboard.school.name}午餐助手`;
    const complete = dashboard.viewMode === "detailed";
    refs.schoolDataScope.textContent = complete
      ? "校方完整菜單＋教育部當日紀錄"
      : "教育部當日實際供餐公開紀錄";
    refs.footerSource.textContent = complete
      ? "資料來源：忠信國小午餐網、教育部校園食材登錄平臺 · 僅供家庭餐食規劃參考"
      : OfficialDiet.profile(dashboard.record).hasVariants
        ? `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 主食、主副菜依「素」字標示分組`
        : `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 完整官方紀錄`;
  }
}

function setViewMode(mode, { showOfficialMealTypes = false } = {}) {
  const official = mode === "officialDaily";
  document.body.dataset.viewMode = official ? "official" : "detailed";
  refs.week.hidden = false;
  refs.todayGrid.hidden = false;
  refs.traceability.hidden = false;
  refs.news.hidden = false;
  refs.mealTypeSwitch.hidden = official && !showOfficialMealTypes;
  refs.mealTypeSwitch.setAttribute(
    "aria-label",
    official ? "依官方菜名標示切換葷食或素食" : "選擇午餐餐別",
  );
  refs.mealTypeMeat.textContent = "葷食";
  refs.mealTypeVegetarian.textContent = "素食";
  refs.nutritionCard.hidden = official;
  refs.dinnerCard.hidden = official;
  refs.standard.hidden = official;
  refs.learn.hidden = official;
  refs.insights.hidden = official;
  refs.source.hidden = official;
  refs.openDetail.hidden = official;
  refs.officialSourceLink.hidden = !official;
  refs.menuBoard.classList.toggle("official-menu-board", official);
  refs.menuKicker.textContent = official ? "OFFICIAL DAILY RECORD" : "SELECTED PLATE";
  refs.menuHeading.textContent = official ? "當日供餐紀錄" : "午餐內容";
  refs.reviewBadge.textContent = official ? "✓ 官方公開紀錄" : "✓ 已校讀";
  refs.mainDishButton.firstElementChild.textContent = official ? "主菜" : "這餐主角";
  refs.traceabilityKicker.textContent = official ? "OFFICIAL INGREDIENT RECORD" : "SOURCE TO PLATE";
  refs.traceabilityHeading.textContent = official ? "教育部公開食材紀錄" : "今日供餐食材追溯";
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"]')) {
    link.hidden = false;
  }
  for (const link of document.querySelectorAll('a[href="#standard"], a[href="#insights"]')) {
    link.hidden = official;
  }
}

function renderNoSchoolSelected() {
  state.schoolId = null;
  state.dashboard = null;
  populateSchoolSelectors();
  document.body.dataset.viewMode = "empty";
  refs.mealTypeSwitch.hidden = true;
  refs.week.hidden = true;
  refs.todayGrid.hidden = true;
  refs.traceability.hidden = true;
  refs.standard.hidden = true;
  refs.learn.hidden = true;
  refs.insights.hidden = true;
  refs.news.hidden = true;
  refs.source.hidden = true;
  refs.todayLabel.textContent = formatDate(localIsoDate(), { year: "numeric", weekday: "long" });
  refs.mealMoment.textContent = "今天想看，";
  refs.heroDish.textContent = "哪一間國小？";
  refs.introNote.textContent = "先選行政區與學校；設成我的最愛後，下次進站才會優先讀取那間學校。";
  refs.brandSchoolLabel.textContent = "臺中市國小午餐助手";
  refs.schoolDataScope.textContent = "尚未選擇學校，不讀取午餐資料";
  refs.footerSource.textContent = "選擇學校後，才會讀取對應的公開午餐資料。";
  refs.errorState.hidden = true;
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"], a[href="#standard"], a[href="#insights"]')) {
    link.hidden = true;
  }
  if (state.account.child) renderPassportFoodChoices();
  setDashboardStatus("ready", "請先選擇學校");
}

function officialDishes(record, mealType = null) {
  return OfficialDiet.filter(record, mealType).map((dish) => ({
      ...dish,
      officialRecord: true,
      ingredients: (dish.ingredients || []).map((ingredient) => ({
        ...ingredient,
        officialRecord: true,
      })),
    }));
}

function officialMainDish(dishes) {
  return dishes.find((dish) => dish.category === "主菜") || dishes[0] || null;
}

function renderOfficialMeal(dashboard) {
  const record = dashboard.record;
  const profile = OfficialDiet.profile(record);
  const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  const heroIndex = Math.max(0, dishes.indexOf(officialMainDish(dishes)));
  const heroDish = dishes[heroIndex];
  state.dishDetails = dishes;
  state.activeDishIndex = -1;
  refs.mealList.replaceChildren();

  if (!record) {
    refs.mainDish.textContent = "尚未取得這一天的公開紀錄";
    refs.heroDish.textContent = "資料尚未發布";
    refs.mainDishButton.disabled = true;
    refs.mainDishButton.onclick = null;
    refs.dishCount.textContent = "不會拿其他日期的紀錄代替今天";
    refs.allergenRow.textContent = "請改選已收錄日期，或直接到教育部公開頁確認。";
    refs.mealTypeNote.textContent = dashboard.dataNotice;
    return;
  }

  refs.heroDish.textContent = `${summary.dishCount} 道公開菜色`;
  refs.mainDish.textContent = heroDish?.name || "本日無菜色";
  refs.mainDishButton.disabled = !heroDish;
  refs.mainDishButton.setAttribute(
    "aria-label",
    heroDish ? `查看「${heroDish.name}」的官方食材紀錄` : "本日無菜色",
  );
  refs.mainDishButton.onclick = heroDish
    ? () => openDishDetail(heroIndex, refs.mainDishButton)
    : null;
  const groupingLabel = profile.hasVariants
    ? `${state.mealType === "vegetarian" ? "素食" : "葷食"} · `
    : "";
  refs.dishCount.textContent = `${groupingLabel}官方公開 ${summary.dishCount} 道菜 · ${summary.ingredientCount} 項食材紀錄`;

  dishes.forEach((dish, index) => {
    if (index === heroIndex) return;
    const item = node("button", "meal-item");
    item.type = "button";
    item.setAttribute("aria-label", `查看${dish.category}「${dish.name}」的官方食材紀錄`);
    item.append(node("span", "", dish.category), node("strong", "", dish.name));
    item.addEventListener("click", () => openDishDetail(index, item));
    refs.mealList.append(item);
  });
  refs.allergenRow.textContent = profile.hasVariants
    ? "依官方菜名的「素」字拆分主食、主菜與副菜；蔬菜、湯品與附餐列為兩種分組共用。"
    : "這一天的主食或主菜沒有同時出現有「素」字與未標示「素」的菜色，因此保留官方完整菜色，不另外拆分。";
  refs.mealTypeNote.textContent = profile.hasVariants
    ? "這是依菜名標示所做的分組，不等同素食認證；共用菜色是否含動物性食材，仍以展開後的官方食材明細為準。"
    : "食材、產地、供應商與標章照同日官方公開紀錄呈現；不代表孩子實際攝取量。";
}

function renderOfficialIngredient(ingredient) {
  const card = node("article", "ingredient-card");
  const heading = node("div", "ingredient-heading");
  const certification = ingredient.certifications?.[0];
  heading.append(
    node("strong", "", ingredient.name),
    node(
      "span",
      `certification-badge${certification ? "" : " empty"}`,
      certification?.name || "未提供標章",
    ),
  );
  const details = node("dl", "ingredient-details");
  if (ingredient.standardName && ingredient.standardName !== ingredient.name) {
    details.append(traceabilityDetail("標準名稱", ingredient.standardName));
  }
  if (ingredient.productName && ingredient.productName !== ingredient.name) {
    details.append(traceabilityDetail("產品名稱", ingredient.productName));
  }
  details.append(
    traceabilityDetail("原料產地（國）", ingredient.origin || "未提供"),
    traceabilityDetail("製造／生產者", ingredient.manufacturer || "未提供"),
    traceabilityDetail("平臺申報供應商", ingredient.supplierName || "未提供"),
  );
  if (ingredient.stockDate) {
    details.append(traceabilityDetail(
      "進貨日期",
      formatDate(ingredient.stockDate.slice(0, 10), { year: "numeric" }),
    ));
  }
  for (const item of ingredient.certifications || []) {
    details.append(traceabilityDetail(item.name, item.id || "未提供編號"));
  }
  card.append(heading, details);
  return card;
}

function renderOfficialTraceability(dashboard) {
  const record = dashboard.record;
  refs.traceabilityDishes.replaceChildren();
  refs.traceabilityStatus.className = "traceability-status";
  if (!record) {
    refs.traceabilityStatus.textContent = "尚未收錄";
    refs.traceabilityStatus.classList.add("unavailable");
    refs.traceabilityNotice.textContent = `${dashboard.selectedDate} 沒有已校讀的同日公開紀錄；本站不會用較早日期冒充今天。`;
    refs.traceabilitySummary.textContent = "指定日期無資料";
    const empty = node("div", "traceability-empty");
    empty.append(
      node("strong", "", "等待官方同日紀錄"),
      node("p", "", "資料取得並通過結構驗證後，才會加入這裡。"),
    );
    refs.traceabilityDishes.append(empty);
    refs.traceabilitySource.textContent = "";
    return;
  }

  const profile = OfficialDiet.profile(record);
  const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  refs.traceabilityStatus.textContent = `同日官方資料 · ${summary.ingredientCount} 項`;
  refs.traceabilityStatus.classList.add("verified");
  refs.traceabilityNotice.textContent = profile.hasVariants
    ? `${record.mealDate} 的主食、主菜與副菜依官方菜名的「素」字分組；蔬菜、湯品與附餐共用，食材內容仍以官方明細為準。`
    : `${record.mealDate} 的菜色與食材直接整理自教育部公開頁；主食或主菜未發現可配對的葷、素菜色，因此不拆分。`;
  refs.traceabilitySummary.textContent = `${summary.dishCount} 道菜 · ${summary.ingredientCount} 項食材 · ${summary.certifiedIngredientCount} 項附標章／溯源標示`;

  for (const dish of dishes) {
    const details = node("details", "traceability-dish");
    const summary = node("summary");
    const title = node("span", "traceability-dish-title");
    title.append(node("small", "", dish.category), node("strong", "", dish.name));
    summary.append(title, node("span", "traceability-count", `${dish.ingredients.length} 項食材`));
    const ingredients = node("div", "ingredient-grid");
    if (dish.ingredients.length) {
      ingredients.append(...dish.ingredients.map(renderOfficialIngredient));
    } else {
      ingredients.append(node("p", "news-empty", "官方頁面未列出這道菜的食材明細。"));
    }
    details.append(summary, ingredients);
    refs.traceabilityDishes.append(details);
  }
  refs.traceabilitySource.textContent = `資料來源：${record.source.name} · 供餐日期 ${record.mealDate} · 校讀 ${record.review.reviewedAt.slice(0, 10)}`;
}

function renderOfficialWeek(dashboard) {
  const dates = dashboard.availableDates || [];
  const selectedProfile = OfficialDiet.profile(dashboard.record);
  const groupingLabel = selectedProfile.hasVariants
    ? ` · ${state.mealType === "vegetarian" ? "素食" : "葷食"}`
    : "";
  refs.weekLabel.textContent = dates.length
    ? `已收錄 ${dates.length} 個供餐日 · 只顯示同日紀錄${groupingLabel}`
    : "尚未收錄供餐日";
  refs.weekDays.replaceChildren();
  for (const date of dates) {
    const record = dashboard.records?.[date] || (date === dashboard.selectedDate ? dashboard.record : null);
    const profile = OfficialDiet.profile(record);
    const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
    const mainDish = officialMainDish(dishes);
    const supportingDishes = dishes.filter((dish) => dish !== mainDish);
    const button = node("button", "day-card");
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-current", String(date === dashboard.selectedDate));
    const weekday = new Intl.DateTimeFormat("zh-TW", { weekday: "short" }).format(
      new Date(`${date}T12:00:00+08:00`),
    );
    const dateLine = node("div", "day-date");
    dateLine.append(node("span", "", weekday), node("strong", "", date.slice(-2)));
    button.append(
      dateLine,
      node("span", "day-dish-role", mainDish ? "主菜" : "供餐紀錄"),
      node("h3", "", mainDish?.name || "無供餐紀錄"),
      node("span", "day-traceability verified", `${dishes.length} 道官方菜色`),
      node("p", "", supportingDishes.slice(0, 3).map((dish) => dish.name).join(" · ") || "—"),
    );
    button.addEventListener("click", () => loadDashboard(date, { announce: true, focusWeekDay: true }));
    refs.weekDays.append(button);
  }
  const index = dates.indexOf(dashboard.selectedDate);
  refs.previousWeek.disabled = index <= 0;
  refs.nextWeek.disabled = index < 0 || index >= dates.length - 1;
  refs.previousWeek.onclick = index > 0
    ? () => loadDashboard(dates[index - 1], { announce: true })
    : null;
  refs.nextWeek.onclick = index >= 0 && index < dates.length - 1
    ? () => loadDashboard(dates[index + 1], { announce: true })
    : null;
}

function renderOfficial(dashboard) {
  const profile = OfficialDiet.profile(dashboard.record);
  const dishes = officialDishes(dashboard.record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  renderSchoolContext(dashboard);
  setViewMode("officialDaily", { showOfficialMealTypes: profile.hasVariants });
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  const date = dashboard.selectedDate || localIsoDate();
  refs.todayLabel.textContent = formatDate(date, { year: "numeric", weekday: "long" });
  refs.mealMoment.textContent = dashboard.record ? `${dashboard.school.name}這天，` : `${dashboard.school.name}這天，`;
  refs.introNote.textContent = dashboard.record
    ? `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}：` : ""}${summary.dishCount} 道菜、${summary.ingredientCount} 項食材，來自同日教育部公開紀錄。`
    : `${date} 尚無已校讀紀錄，不會拿別天資料代替。`;
  refs.officialSourceLink.href = dashboard.sourceUrl;
  renderOfficialMeal(dashboard);
  renderPassportFoodChoices();
  renderOfficialTraceability(dashboard);
  renderOfficialWeek(dashboard);
  const count = summary.dishCount;
  setDashboardStatus("ready", dashboard.record ? `同日官方紀錄 · ${count} 道菜` : "指定日期尚無資料");
  refs.errorState.hidden = true;
}

function render(dashboard) {
  if (dashboard.viewMode === "officialDaily") {
    renderOfficial(dashboard);
    return;
  }
  renderSchoolContext(dashboard);
  setViewMode("detailed");
  const day = dashboard.selected;
  state.mealType = dashboard.mealType;
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  refs.mealTypeNote.textContent = state.mealType === "vegetarian"
    ? "素食菜單可能含蛋、奶；用量為供餐廠商的每人食譜設計值，不代表實際攝取量。"
    : "用量為供餐廠商的每人食譜設計值，不代表實際攝取量。";
  const formatted = formatDate(day.date, { year: "numeric", weekday: "long" });
  refs.todayLabel.textContent = formatted;
  refs.mealMoment.textContent = LunchDateContext.mealMoment(day.date, localIsoDate());
  refs.introNote.textContent = dashboard.isFallback
    ? `指定日期沒有供餐資料，先顯示最近的 ${formatDate(day.date)}。`
    : `${dashboard.mealTypeLabel}：${day.meal.staple}、${day.meal.mainDish}；${day.meal.fruit ? `附餐 ${day.meal.fruit}；` : ""}食譜明細共 ${day.recipeDetails?.length || day.meal.sideDishes.length + 2} 道。`;
  renderMeal(day);
  renderPassportFoodChoices();
  renderNutrition(day.nutrition);
  renderStandard(dashboard);
  renderTraceability(dashboard.traceability);
  renderDinner(dashboard.dinnerSuggestion);
  renderFoodEducation(dashboard.foodEducation);
  renderHomeRecipe(dashboard.homeRecipe);
  renderWeek(dashboard);
  renderInsights(dashboard.insights, dashboard);
  renderArchive(dashboard);
  renderSource(day);
  setDashboardStatus("ready", `已整理 ${dashboard.totalDays} 個供餐日`);
  refs.errorState.hidden = true;
}

function announceSelection(dashboard) {
  if (dashboard.viewMode === "officialDaily") {
    const profile = OfficialDiet.profile(dashboard.record);
    const dishes = officialDishes(dashboard.record, profile.hasVariants ? state.mealType : null);
    refs.selectionAnnouncement.textContent = [
      dashboard.school.name,
      formatDate(dashboard.selectedDate, { year: "numeric", weekday: "long" }),
      dashboard.record
        ? `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}，` : ""}${dishes.length} 道官方公開菜色`
        : "尚無同日公開紀錄",
    ].join("，");
    return;
  }
  const day = dashboard.selected;
  refs.selectionAnnouncement.textContent = [
    formatDate(day.date, { year: "numeric", weekday: "long" }),
    `${dashboard.mealTypeLabel}午餐`,
    day.meal.mainDish,
  ].join("，");
}

async function loadDashboard(date, { announce = false, focusWeekDay = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setDashboardStatus("loading", state.dashboard ? "正在更新菜單…" : "正在讀取菜單…");
  try {
    const payload = await fetchDashboard(date);
    state.dashboard = payload;
    render(payload);
    if (!state.newsLoaded) loadNewsPreview();
    if (focusWeekDay) {
      const activeDate = payload.viewMode === "officialDaily"
        ? payload.selectedDate
        : payload.selected.date;
      const selectedDay = refs.weekDays.querySelector(
        `.day-card[data-date="${activeDate}"]`,
      );
      selectedDay?.focus({ preventScroll: true });
    }
    if (announce) announceSelection(payload);
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    setDashboardStatus("error", "資料讀取失敗");
  } finally {
    state.loading = false;
  }
}

refs.closeSource.addEventListener("click", () => closeSourceDialog());
refs.sourceDialog.addEventListener("click", (event) => {
  if (event.target === refs.sourceDialog) closeSourceDialog();
});
refs.sourceDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSourceDialog();
});
refs.sourceDialog.addEventListener("close", () => {
  state.sourceImageRequestId += 1;
  refs.sourceImage.onload = null;
  refs.sourceImage.onerror = null;
  const trigger = state.lastSourceTrigger;
  state.lastSourceTrigger = null;
  if (trigger?.isConnected) trigger.focus();
});

refs.closeDishDetail.addEventListener("click", () => closeDishDetail());
refs.dishDetailDialog.addEventListener("click", (event) => {
  if (event.target === refs.dishDetailDialog) closeDishDetail();
});
refs.dishDetailDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDishDetail();
});
refs.dishDetailDialog.addEventListener("close", () => {
  const trigger = state.lastDishTrigger;
  state.lastDishTrigger = null;
  if (trigger?.isConnected) trigger.focus();
});
refs.previousDish.addEventListener("click", () => {
  if (state.activeDishIndex > 0) {
    state.activeDishIndex -= 1;
    renderDishDetail();
  }
});
refs.nextDish.addEventListener("click", () => {
  if (state.activeDishIndex < state.dishDetails.length - 1) {
    state.activeDishIndex += 1;
    renderDishDetail();
  }
});

async function selectMealType(mealType) {
  if (mealType === state.mealType) return;
  if (state.dashboard?.viewMode === "officialDaily") {
    if (!OfficialDiet.profile(state.dashboard.record).hasVariants) return;
    state.mealType = mealType;
    window.localStorage.setItem("demeter-meal-type", mealType);
    renderOfficial(state.dashboard);
    announceSelection(state.dashboard);
    return;
  }
  state.mealType = mealType;
  window.localStorage.setItem("demeter-meal-type", mealType);
  const selectedDate = state.dashboard?.selected?.date || localIsoDate();
  await loadDashboard(selectedDate, { announce: true });
}

refs.mealTypeMeat.addEventListener("click", () => selectMealType("meat"));
refs.mealTypeVegetarian.addEventListener("click", () => selectMealType("vegetarian"));

async function selectSchool(schoolId) {
  const nextSchoolId = Number(schoolId);
  const exists = state.schoolDirectory.some(
    (school) => Number(school.fatraceSchoolId) === nextSchoolId,
  );
  if (!exists) {
    renderNoSchoolSelected();
    return;
  }
  if (nextSchoolId === state.schoolId && state.dashboard) return;
  state.schoolId = nextSchoolId;
  if (state.account.child) refs.encounterForm.hidden = true;
  const selectedDate = state.dashboard?.viewMode === "officialDaily"
    ? state.dashboard.selectedDate
    : state.dashboard?.selected?.date;
  await loadDashboard(selectedDate || localIsoDate(), { announce: true });
}

refs.schoolSelect.addEventListener("change", () => selectSchool(refs.schoolSelect.value));
refs.districtSelect.addEventListener("change", () => {
  state.district = refs.districtSelect.value;
  renderNoSchoolSelected();
  refs.schoolSelect.focus();
});
refs.favoriteSchoolButton.addEventListener("click", () => {
  const school = selectedSchool();
  if (!school) return;
  const schoolId = Number(school.fatraceSchoolId);
  if (state.favoriteSchoolId === schoolId) {
    state.favoriteSchoolId = null;
    window.localStorage.removeItem("demeter-favorite-school-id");
    refs.schoolDataScope.textContent = "已取消我的最愛；目前畫面仍保留，重新進站時不會自動讀取。";
  } else {
    state.favoriteSchoolId = schoolId;
    window.localStorage.setItem("demeter-favorite-school-id", String(schoolId));
    refs.schoolDataScope.textContent = `已將${school.name}設為我的最愛；下次進站會優先讀取。`;
  }
  renderFavoriteButton();
});

function selectGradeGroup(gradeGroup) {
  if (gradeGroup === state.gradeGroup) return;
  state.gradeGroup = gradeGroup;
  window.localStorage.setItem("demeter-grade-group", gradeGroup);
  if (state.dashboard) renderStandard(state.dashboard);
}

function selectStandardMode(mode) {
  if (mode === state.standardMode) return;
  state.standardMode = mode;
  window.localStorage.setItem("demeter-standard-mode", mode);
  if (state.dashboard) renderStandard(state.dashboard);
}

refs.gradeLower.addEventListener("click", () => selectGradeGroup("elementary_lower"));
refs.gradeUpper.addEventListener("click", () => selectGradeGroup("elementary_upper"));
refs.standardTarget.addEventListener("click", () => selectStandardMode("target"));
refs.standardTransitional.addEventListener("click", () => selectStandardMode("transitional"));

refs.accountButton.addEventListener("click", () => openAccountDialog(refs.accountButton));
refs.passportUnlock.addEventListener("click", () => openAccountDialog(refs.passportUnlock));
refs.closeAccountDialog.addEventListener("click", () => closeAccountDialog());
refs.accountDialog.addEventListener("click", (event) => {
  if (event.target === refs.accountDialog) closeAccountDialog();
});
refs.accountDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeAccountDialog();
});
refs.accountDialog.addEventListener("close", () => {
  const trigger = state.lastAccountTrigger;
  state.lastAccountTrigger = null;
  if (trigger?.isConnected) trigger.focus();
});
refs.emailAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await requestEmailAuthCode();
});
refs.emailCodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await verifyEmailAuthCode();
});
refs.authCode.addEventListener("input", () => {
  refs.authCode.value = refs.authCode.value.replace(/\D/g, "").slice(0, 6);
});
refs.changeAuthEmail.addEventListener("click", () => {
  state.authChallengeId = null;
  state.authEmail = null;
  refs.emailCodeForm.reset();
  setFormStatus(refs.authVerifyStatus);
  renderEmailAuthStep();
  refs.authEmail.focus();
});
refs.accountSignOut.addEventListener("click", async () => {
  refs.accountSignOut.disabled = true;
  try {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "暫時無法登出");
    resetEmailAuthForm();
    await loadAccount();
    refs.authEmail.focus();
  } catch (error) {
    refs.accountIdentity.textContent = error instanceof Error ? error.message : "暫時無法登出";
  } finally {
    refs.accountSignOut.disabled = false;
  }
});

refs.editChildButton.addEventListener("click", () => {
  const child = state.account.child;
  if (!child) return;
  state.editingChild = true;
  setFormStatus(refs.childFormStatus);
  renderAccount();
  refs.childNickname.focus();
});

refs.cancelChildEdit.addEventListener("click", () => {
  state.editingChild = false;
  setFormStatus(refs.childFormStatus);
  renderAccount();
  refs.editChildButton.focus();
});

refs.returnChildSchool.addEventListener("click", async () => {
  const schoolId = state.account.child?.schoolId;
  if (!schoolId) return;
  await selectSchool(schoolId);
  refs.passport.scrollIntoView({ behavior: "smooth", block: "start" });
});

refs.childForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = refs.childForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setFormStatus(refs.childFormStatus, "正在保存孩子資料…");
  try {
    const response = await fetch("/api/account/child", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: refs.childNickname.value,
        gradeGroup: refs.childGradeGroup.value,
        schoolId: refs.childSchool.value,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "孩子資料暫時無法儲存");
    const wasEditing = Boolean(state.account.child);
    state.editingChild = false;
    await loadAccount();
    setFormStatus(refs.encounterFormStatus, wasEditing ? "孩子資料已更新。" : "已建立孩子的營養午餐紀錄。", "success");
  } catch (error) {
    setFormStatus(refs.childFormStatus, error instanceof Error ? error.message : "孩子資料暫時無法儲存", "error");
  } finally {
    submit.disabled = false;
  }
});

refs.encounterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isViewingChildSchool()) {
    setFormStatus(refs.encounterFormStatus, "請先回到孩子就讀學校，再新增午餐紀錄。", "error");
    if (!refs.returnChildSchool.hidden) refs.returnChildSchool.focus();
    return;
  }
  const selectedSource = refs.passportFoodChoices.querySelector('input[name="dishSource"]:checked')?.value;
  const mealContext = selectedSource === OTHER_FOOD_CONTEXT ? "other" : "school_lunch";
  const dishName = mealContext === "school_lunch" ? selectedSource || null : null;
  const foodName = refs.customFoodName.value.trim() || dishName || "";
  const experience = new FormData(refs.encounterForm).get("experience");
  const reactions = [...refs.reactionChoices.querySelectorAll('input[name="reaction"]:checked')]
    .map((input) => input.value);
  if (!selectedSource) {
    setFormStatus(refs.encounterFormStatus, "請先選擇來源菜色，或選擇家裡／其他地方。", "error");
    refs.passportFoodChoices.querySelector("input")?.focus();
    return;
  }
  if (!foodName) {
    setFormStatus(refs.encounterFormStatus, "請輸入孩子在家裡或其他地方遇到的食物。", "error");
    refs.customFoodName.focus();
    return;
  }
  if (!experience) {
    setFormStatus(refs.encounterFormStatus, "請選擇孩子這次的食物經驗。", "error");
    return;
  }
  const submit = refs.encounterForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setFormStatus(refs.encounterFormStatus, "正在儲存這筆紀錄…");
  try {
    const response = await fetch("/api/account/encounters", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mealDate: selectedMealDate(),
        mealType: state.mealType,
        mealContext,
        dishName,
        foodName,
        experience,
        reactions,
        childQuote: refs.encounterChildQuote.value,
        firstEncounter: refs.firstEncounter.checked,
        preparation: refs.encounterPreparation.value,
        note: refs.encounterNote.value,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "食物紀錄暫時無法儲存");
    refs.encounterForm.reset();
    setFormStatus(refs.encounterFormStatus, "已記下這次食物紀錄。", "success");
    await loadAccount();
  } catch (error) {
    setFormStatus(refs.encounterFormStatus, error instanceof Error ? error.message : "食物紀錄暫時無法儲存", "error");
  } finally {
    submit.disabled = false;
  }
});

refs.reactionChoices.addEventListener("change", (event) => {
  const changed = event.target.closest('input[name="reaction"]');
  if (!changed?.checked) return;
  const choices = [...refs.reactionChoices.querySelectorAll('input[name="reaction"]')];
  if (changed.value === "no_comment") {
    choices.forEach((choice) => {
      if (choice !== changed) choice.checked = false;
    });
  } else {
    const noComment = choices.find((choice) => choice.value === "no_comment");
    if (noComment) noComment.checked = false;
  }
});

function setupMobileNavigation() {
  const links = [...document.querySelectorAll('.mobile-nav a[href^="#"]')];
  const sectionTargets = new Map([
    ["today", "today"],
    ["todayGrid", "today"],
    ["week", "week"],
    ["traceability", "traceability"],
    ["passport", "passport"],
    ["standard", "traceability"],
    ["learn", "traceability"],
    ["insights", "traceability"],
    ["news", "traceability"],
    ["source", "traceability"],
  ]);
  const sections = [...sectionTargets.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  let updateFrame = 0;

  const setActive = (target) => {
    for (const link of links) {
      const isActive = link.hash === `#${target}`;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  };
  const update = () => {
    updateFrame = 0;
    const marker = Math.min(window.innerHeight * .34, 250);
    let target = "today";
    for (const section of sections) {
      if (section.hidden || !section.getClientRects().length) continue;
      if (section.getBoundingClientRect().top <= marker) {
        target = sectionTargets.get(section.id);
      }
    }
    setActive(target);
  };
  const queueUpdate = () => {
    if (!updateFrame) updateFrame = window.requestAnimationFrame(update);
  };

  for (const link of links) {
    link.addEventListener("click", () => setActive(link.hash.slice(1)));
  }
  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  update();
}

for (const link of document.querySelectorAll("a.today-link")) {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (state.schoolId) {
      await loadDashboard(localIsoDate(), { announce: true });
    } else {
      refs.schoolSelect.focus();
    }
    history.replaceState(null, "", "#today");
    document.getElementById("today").scrollIntoView();
  });
}

setupMobileNavigation();

async function initialize() {
  refs.authBirthDate.max = adultBirthDateMaximum();
  const accountRequest = loadAccount();
  setDashboardStatus("loading", "正在讀取學校名冊…");
  try {
    state.schoolDirectory = await fetchSchoolDirectory();
    await accountRequest;
    const childSchool = schoolById(state.account.child?.schoolId);
    const favorite = state.schoolDirectory.find(
      (school) => Number(school.fatraceSchoolId) === state.favoriteSchoolId,
    );
    const initialSchool = childSchool || favorite;
    if (!initialSchool) {
      state.favoriteSchoolId = null;
      window.localStorage.removeItem("demeter-favorite-school-id");
      renderAccount();
      renderNoSchoolSelected();
      return;
    }
    state.schoolId = Number(initialSchool.fatraceSchoolId);
    state.district = districtKey(initialSchool);
    populateSchoolSelectors();
    renderAccount();
    await loadDashboard(localIsoDate());
  } catch (error) {
    refs.errorState.hidden = false;
    refs.errorMessage.textContent = error instanceof Error ? error.message : "未知錯誤";
    setDashboardStatus("error", "學校名冊讀取失敗");
  }
}

initialize();
