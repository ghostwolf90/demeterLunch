const savedMealType = window.localStorage.getItem("demeter-meal-type");
const savedGradeGroup = window.localStorage.getItem("demeter-grade-group");
const savedStandardMode = window.localStorage.getItem("demeter-standard-mode");
window.localStorage.removeItem("demeter-active-child-id");
const savedActiveChildId = null;
const DEFAULT_SCHOOL_ID = 193609;
const state = {
  dashboard: null,
  loading: false,
  staticData: null,
  sampleData: null,
  schoolMealData: {},
  schoolId: null,
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
  accountRequestId: 0,
  dialogMotion: {
    account: { openFrame: 0, closeTimer: 0, closePromise: null },
    familyPlan: { openFrame: 0, closeTimer: 0, closePromise: null },
    source: { openFrame: 0, closeTimer: 0, closePromise: null },
  },
  account: {
    loading: true,
    authenticated: false,
    user: null,
    children: [],
    child: null,
    defaultSchoolId: null,
    encounters: [],
    encounterCount: 0,
    supportEmail: null,
    billingEnabled: false,
    subscriptionPlansVisible: false,
    error: null,
  },
  authChallengeId: null,
  authEmail: null,
  encounterMealCache: {},
  activeChildId: Number.isInteger(savedActiveChildId) && savedActiveChildId > 0 ? savedActiveChildId : null,
  editingChild: false,
  creatingChild: false,
  pendingDefaultSchoolId: null,
  parentAvatarFile: null,
  childAvatarFile: null,
  parentAvatarPreviewUrl: null,
  childAvatarPreviewUrl: null,
  lastAccountTrigger: null,
  accountDialogView: "family",
  onboardingActive: false,
  onboardingStartPending: false,
  lastFamilyPlanTrigger: null,
  schoolDataScopeTimer: 0,
  sampleRequestId: 0,
  dashboardRequestId: 0,
  dashboardAbortController: null,
};

const DISH_DETAIL_MOTION_MS = 360;
const DISH_DETAIL_REDUCED_MOTION_MS = 160;
const AUX_DIALOG_MOTION_MS = 320;
const AUX_DIALOG_REDUCED_MOTION_MS = 160;
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

const allergenOptions = [
  { code: "egg", label: "蛋", terms: ["蛋"] },
  { code: "milk", label: "奶類", terms: ["奶類", "牛奶", "羊奶", "乳製", "奶油", "起司", "乳酪", "奶粉"] },
  { code: "peanut", label: "花生", terms: ["花生", "土豆"] },
  { code: "tree_nuts", label: "堅果類", terms: ["堅果", "腰果", "核桃", "杏仁", "開心果", "栗子", "松子"] },
  { code: "sesame", label: "芝麻", terms: ["芝麻", "麻油"] },
  { code: "gluten", label: "麩質穀物", terms: ["麩質", "小麥", "麵粉", "麵筋", "麵腸", "麵包", "吐司", "饅頭", "麵條", "烏龍麵"] },
  { code: "soy", label: "大豆", terms: ["大豆", "黃豆", "豆腐", "豆干", "豆皮", "豆包", "豆漿", "味噌", "醬油"] },
  { code: "fish", label: "魚類", terms: ["魚類", "魚", "鮪", "鯖", "鮭", "鱈", "鯛", "鰹", "魚露"] },
  { code: "crustaceans", label: "甲殼類", terms: ["甲殼", "蝦", "蟹"] },
  { code: "mango", label: "芒果", terms: ["芒果"] },
  { code: "sulfites", label: "亞硫酸鹽", terms: ["亞硫酸"] },
];

const ids = [
  "encounterEntry", "encounterEntryToggle",
  "accountLoadingStatus",
  "dashboard", "todayLabel", "mealMoment", "heroDish", "introNote", "mainDish", "mealList",
  "allergenRow", "calories", "calorieUnit", "nutritionBars", "nutritionSourceNote", "dinnerTitle", "dinnerPicks",
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
  "districtSelect", "schoolSelect", "defaultSchoolButton", "schoolDataScope", "schoolBrowserNote", "schoolBrowserNoteText", "editChildFromSchoolPicker", "brandSchoolLabel", "footerSource",
  "sampleModeBanner", "sampleModeDate", "sampleSelectSchool",
  "mealTypeSwitch", "menuBoard", "menuKicker", "menuHeading", "reviewBadge",
  "officialSourceLink", "schoolMenuSourceButton", "schoolMenuNutritionButton", "nutritionCard", "dinnerCard", "standard", "learn",
  "week", "todayGrid", "traceability", "news", "insights", "source", "traceabilityKicker", "traceabilityHeading",
  "passport", "passportLocked", "passportUnlock", "passportSetup", "openChildSettings", "childForm", "childName", "childNickname",
  "childAvatarPreview", "childAvatarInput", "removeChildAvatar",
  "childGradeGroup", "childSchool", "childFormSubmit", "cancelChildEdit", "childSetupKicker", "childSetupTitle",
  "childSetupDescription", "childFormStatus", "passportWorkspace", "passportChildName", "passportChildSchool",
  "passportChildToolbar", "childSwitcher", "childPlanSummary", "addChildButton",
  "passportSchoolNotice", "passportSchoolNoticeText", "returnChildSchool", "editChildButton",
  "encounterForm", "passportFoodChoices", "passportOptionalDetails", "passportOptionalBadge", "customFoodRequirement", "customFoodName", "customFoodHint", "experienceChoices", "noEatDetails", "reactionChoices",
  "encounterChildQuote", "encounterPreparation", "encounterNote",
  "encounterFormStatus", "encounterList", "allEncounterRecords", "accountButton", "accountAvatar", "accountButtonText",
  "accountDialog", "closeAccountDialog", "accountSignedOutView", "accountSignedInView", "accountIdentity", "accountIntentNotice",
  "accountSupport", "accountSupportEmail", "accountPlanPanel", "accountPlanName", "accountChildUsage",
  "accountPlanDescription", "accountPlanOptions", "accountPlanStatus", "accountSubscriptionState", "accountSubscriptionDetail",
  "familyPlanDialog", "closeFamilyPlanDialog", "closeFamilyPlanAction", "familyPlanCurrentName", "familyPlanCurrentBadge",
  "familyPlanCurrentDescription", "familyPlanSubscriptionDetail", "familyPlanChildUsage", "familyPlanFeatureList",
  "familyPlanAvailability", "familyPlanComparison",
  "parentAvatarPreview", "parentAvatarInput", "removeParentAvatar", "parentProfileForm", "parentName",
  "parentNickname", "saveParentProfile", "parentProfileStatus", "accountChildList", "accountAddChild",
  "accountFamilyStatus", "accountChildEditor", "accountChildBack",
  "emailAuthForm", "authEmail", "authBirthDate", "authCaregiverConfirmed", "requestAuthCode", "authRequestStatus",
  "emailCodeStep", "authMaskedEmail", "emailCodeForm", "authCode", "verifyAuthCode", "authVerifyStatus",
  "changeAuthEmail", "accountSignOut",
];
const refs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const accountPlanOptionsTemplate = document.getElementById("accountPlanOptionsTemplate");
const familyPlanComparisonTemplate = document.getElementById("familyPlanComparisonTemplate");

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function profileDisplayName(profile, fallback = "家庭成員") {
  return profile?.displayName || profile?.nickname || profile?.name || fallback;
}

function accountNeedsOnboarding(account = state.account) {
  return account?.authenticated === true
    && account?.onboarding?.required === true
    && !account?.child;
}

function trackOnboardingEvent(name) {
  if (!["onboarding_started", "onboarding_completed", "onboarding_skipped"].includes(name)) return;
  if (typeof window.gtag === "function") window.gtag("event", name);
}

async function markOnboardingStarted() {
  if (!state.onboardingActive || state.onboardingStartPending) return;
  state.onboardingStartPending = true;
  try {
    const response = await fetch("/api/account/onboarding", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "Unable to start onboarding");
    if (payload.shouldTrack === true) trackOnboardingEvent("onboarding_started");
  } catch (error) {
    console.error("Unable to record account onboarding start", error);
  } finally {
    state.onboardingStartPending = false;
  }
}

async function skipOnboarding() {
  refs.cancelChildEdit.disabled = true;
  setFormStatus(refs.childFormStatus, "正在保留稍後設定…", "loading");
  try {
    const response = await fetch("/api/account/onboarding", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "skip" }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前無法保留稍後設定，請稍後再試。");
    if (payload.shouldTrack === true) trackOnboardingEvent("onboarding_skipped");
    state.onboardingActive = false;
    state.creatingChild = false;
    state.editingChild = false;
    resetAvatarSelection("child");
    await loadAccount({ childId: null });
    setFormStatus(refs.accountFamilyStatus, "已保留稍後設定；需要時可從孩子設定新增資料。", "success");
  } catch (error) {
    setFormStatus(
      refs.childFormStatus,
      error instanceof Error ? error.message : "目前無法保留稍後設定，請稍後再試。",
      "error",
    );
  } finally {
    refs.cancelChildEdit.disabled = false;
  }
}

function renderProfileAvatar(container, profile, previewUrl = null) {
  const displayName = profileDisplayName(profile, "家");
  const source = previewUrl || profile?.avatarUrl;
  container.replaceChildren();
  if (source) {
    const image = document.createElement("img");
    image.src = source;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    container.append(image);
  } else {
    container.textContent = displayName.slice(0, 1) || "家";
  }
}

function resetAvatarSelection(kind) {
  const urlKey = kind === "parent" ? "parentAvatarPreviewUrl" : "childAvatarPreviewUrl";
  const fileKey = kind === "parent" ? "parentAvatarFile" : "childAvatarFile";
  if (state[urlKey]) URL.revokeObjectURL(state[urlKey]);
  state[urlKey] = null;
  state[fileKey] = null;
  const input = kind === "parent" ? refs.parentAvatarInput : refs.childAvatarInput;
  if (input) input.value = "";
}

function selectAvatarFile(kind, file) {
  if (!file) return;
  const type = file.type.toLowerCase();
  const supportedType = /^image\/(?:jpeg|png|webp|heic|heif)$/.test(type);
  const supportedName = /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if ((!supportedType && !supportedName) || file.size > 10 * 1024 * 1024) {
    const status = kind === "parent" ? refs.parentProfileStatus : refs.childFormStatus;
    setFormStatus(status, "請選擇 10MB 以內的 JPG、PNG、WebP 或 HEIC 照片。", "error");
    return;
  }
  resetAvatarSelection(kind);
  const url = URL.createObjectURL(file);
  if (kind === "parent") {
    state.parentAvatarFile = file;
    state.parentAvatarPreviewUrl = url;
    renderProfileAvatar(refs.parentAvatarPreview, state.account.user, url);
  } else {
    state.childAvatarFile = file;
    state.childAvatarPreviewUrl = url;
    renderProfileAvatar(refs.childAvatarPreview, state.account.child, url);
  }
}

async function decodeAvatarImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Older mobile Safari can display a photo even when createImageBitmap cannot decode it.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("這張照片無法讀取，請改選 JPG、PNG、WebP 或 HEIC 照片。");
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressedAvatar(file) {
  const decoded = await decodeAvatarImage(file);
  try {
    const size = Math.min(512, decoded.width, decoded.height);
    const sourceSize = Math.min(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("這個瀏覽器無法處理照片");
    context.drawImage(
      decoded.source,
      (decoded.width - sourceSize) / 2,
      (decoded.height - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size,
    );
    let blob = await canvasBlob(canvas, "image/webp", 0.84);
    if (!blob) throw new Error("照片處理失敗");
    let outputType = blob.type.toLowerCase();
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    if (!extensions[outputType]) {
      blob = await canvasBlob(canvas, "image/jpeg", 0.86);
      if (!blob) throw new Error("照片處理失敗");
      outputType = blob.type.toLowerCase();
    }
    const extension = extensions[outputType];
    if (!extension) throw new Error("這個瀏覽器無法輸出支援的照片格式");
    return new File([blob], `avatar.${extension}`, { type: outputType });
  } finally {
    decoded.close();
  }
}

async function uploadAvatar(scope, childId, file) {
  const form = new FormData();
  form.set("scope", scope);
  if (childId) form.set("childId", String(childId));
  form.set("avatar", await compressedAvatar(file));
  const response = await fetch("/api/account/avatar", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(payload.error || "大頭貼暫時無法儲存");
}

async function deleteAvatar(childId = null) {
  const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
  const response = await fetch(`/api/account/avatar${query}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(payload.error || "大頭貼暫時無法移除");
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

function setChildAllergenSelection(codes) {
  const selected = new Set(Array.isArray(codes) ? codes : []);
  for (const input of refs.childForm.querySelectorAll('input[name="childAllergen"]')) {
    input.checked = selected.has(input.value);
  }
}

function selectedChildAllergenCodes() {
  return [...refs.childForm.querySelectorAll('input[name="childAllergen"]:checked')]
    .map((input) => input.value);
}

function matchingChildAllergens(evidenceTexts) {
  if (!state.account.child || !isViewingChildSchool()) return [];
  const selected = new Set(Array.isArray(state.account.child.allergenCodes)
    ? state.account.child.allergenCodes
    : []);
  const evidence = evidenceTexts
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
  return allergenOptions
    .filter((option) => selected.has(option.code)
      && evidence.some((text) => option.terms.some((term) => text.includes(term))))
    .map((option) => option.label);
}

function renderAllergenNotice(evidenceTexts, fallbackText, { personalize = true } = {}) {
  const matches = personalize ? matchingChildAllergens(evidenceTexts) : [];
  refs.allergenRow.classList.toggle("is-personal-alert", matches.length > 0);
  refs.allergenRow.textContent = matches.length
    ? `⚠ ${profileDisplayName(state.account.child, "孩子")}需留意：${matches.join("、")}。這天已取得的菜單或食材資料中有相符項目；請再向校方確認實際食材與製程。`
    : fallbackText;
}

function renderPassportSchoolContext() {
  const child = state.account.child;
  if (!child) return;
  const childSchool = schoolById(child.schoolId);
  const viewingSchool = selectedSchool();
  refs.passportChildSchool.textContent = childSchool?.name || "尚未設定";
  const mismatch = Boolean(childSchool && !isViewingChildSchool());
  const missing = !childSchool;
  refs.schoolBrowserNote.hidden = !mismatch;
  refs.schoolBrowserNoteText.textContent = mismatch
    ? `僅切換公開午餐；${profileDisplayName(child, "孩子")}的學校仍是${childSchool.name}。`
    : "";
  refs.passportSchoolNotice.hidden = !mismatch && !missing;
  refs.encounterForm.hidden = mismatch || missing;
  refs.returnChildSchool.hidden = missing;
  if (missing) {
    refs.passportSchoolNoticeText.textContent = `請先到「孩子資料」設定${profileDisplayName(child, "孩子")}就讀的國小，設定後才能新增午餐紀錄。`;
  } else if (mismatch) {
    refs.passportSchoolNoticeText.textContent = viewingSchool
      ? `目前正在查看${viewingSchool.name}的公開午餐；${profileDisplayName(child, "孩子")}的午餐紀錄仍屬於${childSchool.name}。回到${childSchool.name}後才能新增紀錄。`
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
    refs.passportFoodChoices.append(node("p", "encounter-empty", "尚未取得孩子學校這一天的菜單，暫時無法新增午餐紀錄；請稍後再試，或改選已有菜單的日期。"));
  }

  const foods = child && viewingChildSchool ? passportFoodOptions() : [];
  const choices = [
    ...foods.map((food) => ({ value: food, label: food })),
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
  syncPassportOptionalDetails();
}

function syncPassportOptionalDetails() {
  refs.customFoodName.setAttribute("aria-required", "false");
  refs.passportOptionalBadge.textContent = "選填";
  refs.customFoodRequirement.textContent = "食物名稱（可不填）";
  refs.customFoodHint.textContent = "不填會記下整道菜；填寫時仍會保留上一步選的來源菜色。";
}

function resetPassportOptionalDetails() {
  refs.passportOptionalDetails.open = false;
  syncPassportOptionalDetails();
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
  const encounters = (state.account.encounters || []).slice(0, 3);
  const encounterCount = Number(state.account.encounterCount) || encounters.length;
  refs.allEncounterRecords.hidden = encounterCount <= 3;
  refs.allEncounterRecords.href = `./records.html?childId=${encodeURIComponent(state.account.child.id)}`;
  refs.allEncounterRecords.textContent = `查看全部 ${encounterCount} 筆飲食紀錄`;
  if (!encounters.length) {
    refs.encounterList.append(node("p", "encounter-empty", "這裡還沒有紀錄。下次聊到午餐，有想記住的話再留下來。"));
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
      node("p", "encounter-stage", experienceLabels[encounter.experience] || "未記錄接觸方式"),
      node("p", "encounter-origin", encounterOriginText(encounter)),
    );
    const reactionText = (encounter.reactions || [])
      .map((reaction) => reactionLabels[reaction])
      .filter(Boolean)
      .join("、");
    const detailCopy = node("div", "encounter-detail-copy");
    if (encounter.firstEncounter) {
      detailCopy.append(node("p", "encounter-first", "第一次遇到這個食物"));
    }
    if (reactionText) detailCopy.append(node("p", "encounter-reactions", reactionText));
    if (encounter.childQuote) detailCopy.append(node("p", "encounter-quote", `孩子說：「${encounter.childQuote}」`));
    if (encounter.preparation) detailCopy.append(node("p", "encounter-note", `做法：${encounter.preparation}`));
    if (encounter.note) detailCopy.append(node("p", "encounter-note", `家長筆記：${encounter.note}`));
    const expandLabel = node("span", "encounter-expand-label", "查看詳情");
    summary.append(summaryBody, expandLabel);
    const mealPreview = node("div", "encounter-meal-preview");
    mealPreview.setAttribute("aria-live", "polite");
    item.append(summary);
    detailCopy.append(PassportMemory.actions(encounter, state.account.child.id, refreshPassportMemories));
    item.append(detailCopy, mealPreview);
    item.addEventListener("toggle", async () => {
      expandLabel.textContent = item.open ? "收起詳情" : "查看詳情";
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

async function publicSiteData(signal) {
  if (state.staticData) return state.staticData;
  const response = await fetch("./data/site-data.json", { signal });
  if (!response.ok) throw new Error(`無法讀取公開版資料（HTTP ${response.status}）`);
  state.staticData = await response.json();
  return state.staticData;
}

async function sampleSiteData() {
  if (state.sampleData) return state.sampleData;
  const response = await fetch("./data/sample-data.json");
  if (!response.ok) throw new Error(`無法讀取功能範例（HTTP ${response.status}）`);
  state.sampleData = await response.json();
  return state.sampleData;
}

async function publicSchoolMealData(schoolId, signal) {
  const key = String(schoolId);
  if (state.schoolMealData[key]) return state.schoolMealData[key];
  const response = await fetch(`./data/school-meals/${encodeURIComponent(key)}.json`, { signal });
  if (!response.ok) throw new Error(`無法讀取學校午餐資料（HTTP ${response.status}）`);
  state.schoolMealData[key] = await response.json();
  return state.schoolMealData[key];
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
  const schoolId = Number(encounter.schoolId);
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

  if (schoolId === DEFAULT_SCHOOL_ID) {
    const data = await publicSiteData();
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

function rememberActiveChild(child) {
  const childId = Number(child?.id);
  state.activeChildId = Number.isInteger(childId) && childId > 0 ? childId : null;
  window.localStorage.removeItem("demeter-active-child-id");
}

function accountEndpoint(childId = state.activeChildId) {
  return Number.isInteger(childId) && childId > 0
    ? `/api/account?childId=${encodeURIComponent(childId)}`
    : "/api/account";
}

function renderChildNavigation() {
  const account = state.account;
  const children = Array.isArray(account.children) ? account.children : [];
  const authenticated = Boolean(account.authenticated);
  refs.passportChildToolbar.hidden = !authenticated || !children.length;
  refs.childSwitcher.replaceChildren();
  children.forEach((child) => {
    const button = node("button", "");
    button.type = "button";
    const avatar = node("span", "child-switcher-avatar");
    renderProfileAvatar(avatar, child);
    const displayName = profileDisplayName(child, "孩子");
    button.append(avatar, document.createTextNode(displayName));
    const active = Number(child.id) === Number(account.child?.id);
    if (active) button.classList.add("is-active");
    button.setAttribute(
      "aria-label",
      `開啟${displayName}的孩子設定${active ? "，目前使用中的一口護照" : ""}`,
    );
    button.title = `開啟${displayName}的孩子設定`;
    button.addEventListener("click", () => openPassportChildSettings(child.id, button));
    refs.childSwitcher.append(button);
  });
  const planName = account.planDetails?.name || "免費方案";
  const childLimit = Number(account.childLimit || account.planDetails?.childLimit || 1);
  refs.childPlanSummary.textContent = `${planName} · ${children.length}/${childLimit} 位孩子`;
  const paidPlan = account.plan === "family_monthly" || account.plan === "family_yearly";
  refs.addChildButton.disabled = false;
  refs.addChildButton.textContent = account.canAddChild
    ? "＋ 新增孩子"
    : paidPlan ? "查看目前方案" : "查看目前限制";
  if (account.canAddChild) refs.addChildButton.removeAttribute("aria-haspopup");
  else refs.addChildButton.setAttribute("aria-haspopup", "dialog");
}

function renderAccountChildren() {
  const children = Array.isArray(state.account.children) ? state.account.children : [];
  refs.accountChildList.replaceChildren();
  refs.accountAddChild.disabled = !state.account.canAddChild;
  refs.accountAddChild.textContent = state.account.canAddChild ? "新增孩子" : "名額已滿";
  if (!children.length) {
    refs.accountChildList.append(node("p", "account-child-empty", "還沒有孩子資料，可以先建立第一位孩子。"));
    return;
  }
  children.forEach((child) => {
    const row = node("div", "account-child-row");
    const avatar = node("span", "account-child-avatar");
    renderProfileAvatar(avatar, child);
    const copy = node("div", "account-child-copy");
    const school = schoolById(child.schoolId);
    copy.append(
      node("strong", "", profileDisplayName(child, "孩子")),
      node("span", "", `${school?.name || "尚未設定學校"}${child.nickname ? ` · 姓名 ${child.name}` : ""}`),
    );
    const edit = node("button", "", "修改");
    edit.type = "button";
    edit.dataset.childId = String(child.id);
    edit.addEventListener("click", async () => {
      if (Number(child.id) !== Number(state.account.child?.id)) {
        rememberActiveChild(child);
        await loadAccount({ childId: Number(child.id) });
      }
      openChildEditor(refs.childName, { trigger: edit });
    });
    row.append(avatar, copy, edit);
    refs.accountChildList.append(row);
  });
}

function renderAccountPlan() {
  const account = state.account;
  const children = Array.isArray(account.children) ? account.children : [];
  const plan = account.planDetails || { name: "免費方案", childLimit: 1 };
  const paidPlan = account.plan === "family_monthly" || account.plan === "family_yearly";
  refs.accountPlanPanel.hidden = !account.authenticated;
  refs.accountPlanName.textContent = plan.name;
  refs.accountChildUsage.textContent = `${children.length} / ${plan.childLimit} 位孩子`;
  refs.accountSubscriptionState.textContent = account.subscription?.statusLabel || "免費使用中";
  refs.accountSubscriptionDetail.textContent = account.subscription?.message || "目前使用免費方案。";
  refs.accountPlanDescription.textContent = paidPlan
    ? "家庭方案最多可建立 3 位孩子，每位孩子的飲食紀錄會分開保存。"
    : "免費家庭帳號目前可建立 1 位孩子，並使用現階段開放的家庭飲食紀錄功能。";
  const plansVisible = account.billingEnabled === true && account.subscriptionPlansVisible === true;
  refs.accountPlanOptions.replaceChildren();
  if (plansVisible && !paidPlan && accountPlanOptionsTemplate) {
    refs.accountPlanOptions.append(accountPlanOptionsTemplate.content.cloneNode(true));
  }
  refs.accountPlanOptions.hidden = !plansVisible || paidPlan;
  refs.accountPlanStatus.textContent = paidPlan
    ? "目前方案已可使用多孩子功能。"
    : plansVisible
      ? "可選方案會在正式開放後提供申請方式。"
      : "目前開放免費體驗；其他家庭功能若有調整，將另行公告。";
}

function renderFamilyPlan() {
  const account = state.account;
  const children = Array.isArray(account.children) ? account.children : [];
  const planId = account.plan || "free";
  const plan = account.planDetails || { name: "免費方案", childLimit: 1 };
  const paidPlan = planId === "family_monthly" || planId === "family_yearly";
  const featureLabels = paidPlan
    ? [
        "最多建立 3 位孩子，並快速切換每位孩子的一口護照",
        "每位孩子分開保存就讀學校、需留意食物與飲食紀錄",
        "依孩子本人學校的同日資料顯示個人化站內提醒",
        "回看記過的食物、孩子原話與家長筆記",
      ]
    : [
        "建立 1 位孩子的一口護照",
        "保存孩子的就讀學校、需留意食物與飲食紀錄",
        "依孩子本人學校的同日資料顯示個人化站內提醒",
        "回看記過的食物、孩子原話與家長筆記",
      ];

  refs.familyPlanCurrentName.textContent = plan.name;
  refs.familyPlanCurrentBadge.textContent = account.subscription?.statusLabel || "免費使用中";
  refs.familyPlanSubscriptionDetail.textContent = account.subscription?.message || "目前使用免費方案。";
  refs.familyPlanChildUsage.textContent = `${children.length} / ${plan.childLimit} 位孩子`;
  refs.familyPlanCurrentDescription.textContent = paidPlan
    ? "家庭方案最多可建立 3 位孩子，每位孩子的資料與一口護照會分開保存。"
    : "免費方案可建立 1 位孩子，保存午餐紀錄、孩子原話與家長筆記。";
  refs.familyPlanFeatureList.replaceChildren(
    ...featureLabels.map((label) => node("li", "", label)),
  );
  const plansVisible = account.billingEnabled === true && account.subscriptionPlansVisible === true;
  refs.familyPlanComparison.replaceChildren();
  if (plansVisible && familyPlanComparisonTemplate) {
    refs.familyPlanComparison.append(familyPlanComparisonTemplate.content.cloneNode(true));
  }
  refs.familyPlanComparison.hidden = !plansVisible;
  refs.familyPlanAvailability.textContent = paidPlan
    ? "你目前的家庭方案已可使用多孩子功能。"
    : plansVisible
      ? "可選方案會在正式開放後提供申請方式。"
      : "好好吃飯目前開放免費體驗；免費家庭帳號目前可建立 1 位孩子。";

  refs.familyPlanDialog.querySelectorAll("[data-plan-id]").forEach((card) => {
    const current = card.dataset.planId === planId;
    card.classList.toggle("is-current", current);
    if (current) card.setAttribute("aria-current", "true");
    else card.removeAttribute("aria-current");
    const stateLabel = card.querySelector(".family-plan-card-state");
    if (stateLabel) stateLabel.textContent = current ? "目前方案" : "方案選項";
  });
}

function renderAccount() {
  const account = state.account;
  const authenticated = Boolean(account.authenticated);
  const onboardingActive = authenticated && state.onboardingActive;
  refs.accountButton.classList.toggle("is-authenticated", authenticated);
  renderProfileAvatar(refs.accountAvatar, authenticated ? account.user : null);
  refs.accountButton.disabled = account.loading || (!authenticated && !EMAIL_REGISTRATION_ENABLED);
  refs.accountButton.setAttribute("aria-busy", String(account.loading));
  refs.accountButton.title = account.loading ? "正在確認登入狀態" : authenticated ? "家庭帳號設定" : "登入或建立免費家庭帳號";
  refs.accountLoadingStatus.hidden = !account.loading;
  refs.accountButton.setAttribute("aria-disabled", String(refs.accountButton.disabled));
  refs.accountButtonText.textContent = account.loading ? "正在確認登入…" : authenticated
    ? profileDisplayName(account.user, "家庭帳號")
    : EMAIL_REGISTRATION_ENABLED ? "登入／免費註冊" : "登入／免費註冊（準備中）";
  refs.accountSignedOutView.hidden = account.loading || authenticated;
  refs.accountSignedInView.hidden = !authenticated;
  const childSettingsView = authenticated && !onboardingActive && state.accountDialogView === "child";
  refs.accountSignedInView.classList.toggle("is-child-settings-view", childSettingsView);
  refs.accountSignedInView.classList.toggle("is-onboarding", onboardingActive);
  refs.accountChildBack.hidden = !childSettingsView;
  renderChildNavigation();
  renderAccountChildren();
  renderAccountPlan();
  renderFamilyPlan();
  const supportEmail = authenticated && typeof account.supportEmail === "string"
    ? account.supportEmail.trim()
    : "";
  refs.accountSupport.hidden = !supportEmail;
  refs.accountSupportEmail.textContent = supportEmail;
  if (supportEmail) {
    refs.accountSupportEmail.href = `mailto:${supportEmail}?subject=${encodeURIComponent("好好吃飯使用問題")}`;
    refs.accountSupportEmail.setAttribute("aria-label", `寫信給好好吃飯客服 ${supportEmail}`);
  } else {
    refs.accountSupportEmail.removeAttribute("href");
    refs.accountSupportEmail.removeAttribute("aria-label");
  }
  renderEmailAuthStep();
  if (authenticated) {
    refs.accountIdentity.textContent = account.user?.email
      ? `${account.user.displayName} · ${account.user.email}`
      : `${account.user?.displayName || "家長"} · 免費會員`;
    if (!refs.parentProfileForm.contains(document.activeElement)) {
      refs.parentName.value = account.user?.name || account.user?.displayName || "家長";
      refs.parentNickname.value = account.user?.nickname || "";
    }
    renderProfileAvatar(refs.parentAvatarPreview, account.user, state.parentAvatarPreviewUrl);
    refs.removeParentAvatar.hidden = !account.user?.avatarUrl;
  }

  refs.passportLocked.hidden = account.loading || authenticated;
  const childEditorOpen = authenticated && (onboardingActive || state.editingChild || state.creatingChild);
  refs.accountChildEditor.hidden = !childEditorOpen;
  refs.passportSetup.hidden = !authenticated || Boolean(account.child);
  refs.passportWorkspace.hidden = !authenticated || !account.child;
  refs.schoolBrowserNote.hidden = true;
  if (onboardingActive) {
    refs.childSetupKicker.textContent = "首次設定";
    refs.childSetupTitle.textContent = "為孩子建立第一份飲食紀錄";
    refs.childSetupDescription.textContent = "先填孩子的基本資料與就讀學校，之後記午餐時，就能帶入孩子學校的菜色。";
    refs.childFormSubmit.textContent = "建立孩子資料";
    refs.cancelChildEdit.textContent = "稍後再設定";
    refs.cancelChildEdit.hidden = false;
    renderProfileAvatar(refs.childAvatarPreview, null, state.childAvatarPreviewUrl);
    refs.removeChildAvatar.hidden = true;
    populateChildSchoolSelect(state.schoolId);
  } else if (authenticated && state.creatingChild) {
    refs.childSetupKicker.textContent = "孩子設定";
    refs.childSetupTitle.textContent = "新增孩子資料";
    refs.childSetupDescription.textContent = `目前有 ${(account.children || []).length} 位，${account.planDetails?.name || "目前方案"}最多可建立 ${account.childLimit || 1} 位孩子。`;
    refs.childFormSubmit.textContent = "新增孩子";
    refs.cancelChildEdit.textContent = "取消";
    refs.cancelChildEdit.hidden = false;
    refs.childName.value = "";
    refs.childNickname.value = "";
    renderProfileAvatar(refs.childAvatarPreview, null, state.childAvatarPreviewUrl);
    refs.removeChildAvatar.hidden = true;
    populateChildSchoolSelect(state.schoolId);
  } else if (authenticated && account.child) {
    const childDisplayName = profileDisplayName(account.child, "孩子");
    refs.passportChildName.textContent = childDisplayName;
    refs.childName.value = account.child.name || childDisplayName;
    refs.childNickname.value = account.child.nickname || "";
    renderProfileAvatar(refs.childAvatarPreview, account.child, state.childAvatarPreviewUrl);
    refs.removeChildAvatar.hidden = !account.child.avatarUrl;
    refs.childGradeGroup.value = account.child.gradeGroup;
    setChildAllergenSelection(account.child.allergenCodes);
    refs.childSetupKicker.textContent = "孩子設定";
    refs.childSetupTitle.textContent = `編輯${childDisplayName}的設定`;
    refs.childSetupDescription.textContent = "就讀學校只會在這裡變更；上方選校只是查看其他學校的公開午餐。";
    refs.childFormSubmit.textContent = "儲存孩子資料";
    refs.cancelChildEdit.textContent = "取消";
    refs.cancelChildEdit.hidden = false;
    populateChildSchoolSelect(account.child.schoolId);
    renderPassportSchoolContext();
    renderPassportFoodChoices();
    renderEncounterHistory();
  } else if (authenticated) {
    refs.childSetupKicker.textContent = "孩子設定";
    refs.childSetupTitle.textContent = "建立第一位孩子的資料";
    refs.childSetupDescription.textContent = "姓名只用在家庭帳號內；可另外設定暱稱，畫面會優先顯示暱稱。";
    refs.childFormSubmit.textContent = "建立免費飲食紀錄";
    refs.cancelChildEdit.textContent = "取消";
    refs.cancelChildEdit.hidden = true;
    refs.childName.value = "";
    refs.childNickname.value = "";
    renderProfileAvatar(refs.childAvatarPreview, null, state.childAvatarPreviewUrl);
    refs.removeChildAvatar.hidden = true;
    populateChildSchoolSelect(state.schoolId);
  }
  renderDefaultSchoolButton();
}

function renderEmailAuthStep() {
  const awaitingCode = EMAIL_REGISTRATION_ENABLED && Boolean(state.authChallengeId);
  refs.emailAuthForm.hidden = awaitingCode;
  refs.emailCodeStep.hidden = !awaitingCode;
  refs.requestAuthCode.disabled = !EMAIL_REGISTRATION_ENABLED;
  refs.requestAuthCode.setAttribute("aria-disabled", String(!EMAIL_REGISTRATION_ENABLED));
}

async function loadAccount({ childId = state.activeChildId } = {}) {
  const ticket = ++state.accountRequestId;
  const wasOnboarding = state.onboardingActive;
  try {
    const response = await fetch(accountEndpoint(childId), { cache: "no-store", credentials: "same-origin" });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前還無法顯示家庭帳號資料，請稍後再試。");
    if (ticket !== state.accountRequestId) return;
    state.account = { ...payload, loading: false, error: null };
    state.onboardingActive = accountNeedsOnboarding(payload);
    if (state.onboardingActive) {
      if (!wasOnboarding) {
        resetAvatarSelection("child");
        refs.childForm.reset();
        setFormStatus(refs.childFormStatus);
      }
      state.creatingChild = true;
      state.editingChild = false;
      state.accountDialogView = "family";
    } else if (wasOnboarding) {
      state.creatingChild = false;
      state.editingChild = false;
    }
    rememberActiveChild(payload.child);
  } catch (error) {
    if (ticket !== state.accountRequestId) return;
    state.account = {
      loading: false,
      authenticated: false,
      user: null,
      children: [],
      child: null,
      defaultSchoolId: null,
      encounters: [],
      encounterCount: 0,
      supportEmail: null,
      error: error instanceof Error ? error.message : "目前還無法顯示家庭帳號資料，請稍後再試。",
    };
    state.onboardingActive = false;
  }
  renderAccount();
  if (!state.account.authenticated || !state.account.child) PassportMemory.clear();
  if (state.onboardingActive && refs.accountDialog.open) void markOnboardingStarted();
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
    if (!response.ok) throw new Error(payload.error || "目前無法寄送驗證碼，請稍後再試。");
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
      error instanceof Error ? error.message : "目前無法寄送驗證碼，請稍後再試。",
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
    if (!response.ok) throw new Error(payload.error || "目前無法確認驗證碼，請稍後再試。");
    PassportMemory.clear();
    resetEmailAuthForm();
    await loadAccount();
    const pendingDefaultSchoolId = state.pendingDefaultSchoolId;
    if (pendingDefaultSchoolId) {
      try {
        await persistDefaultSchool(pendingDefaultSchoolId);
        setSchoolDataScope("已設為預設學校，會隨帳號同步。", { temporary: true });
      } catch (error) {
        setSchoolDataScope(error instanceof Error ? error.message : "目前無法更新預設學校，請稍後再試。");
      }
    }
    if (state.onboardingActive) {
      void markOnboardingStarted();
      focusAccountChildEditor(refs.childName);
    } else {
      await closeAccountDialog();
      if (state.account.child) {
        refs.passport.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  } catch (error) {
    setFormStatus(
      refs.authVerifyStatus,
      error instanceof Error ? error.message : "目前無法確認驗證碼，請稍後再試。",
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

function renderAccountIntentNotice() {
  const school = schoolById(state.pendingDefaultSchoolId);
  refs.accountIntentNotice.hidden = !school;
  refs.accountIntentNotice.textContent = school
    ? `登入後會將${school.name}設為預設學校。`
    : "";
}

function openAccountDialog(trigger, { view = "family" } = {}) {
  if (state.account.loading || (!state.account.authenticated && !EMAIL_REGISTRATION_ENABLED)) return;
  state.lastAccountTrigger = trigger || document.activeElement;
  state.accountDialogView = view;
  renderAccount();
  renderAccountIntentNotice();
  openStagedDialog(
    refs.accountDialog,
    state.dialogMotion.account,
    refs.closeAccountDialog,
  );
  refs.accountDialog.querySelector(".account-dialog-shell")?.scrollTo({ top: 0 });
  if (state.onboardingActive) void markOnboardingStarted();
}

function closeAccountDialog(options) {
  return closeStagedDialog(refs.accountDialog, state.dialogMotion.account, options);
}

function openRequestedAccountDialog() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("account") !== "1") return;
  url.searchParams.delete("account");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  openAccountDialog(refs.accountButton);
}

function openFamilyPlanDialog(trigger) {
  if (!state.account.authenticated) {
    openAccountDialog(trigger);
    return;
  }
  state.lastFamilyPlanTrigger = trigger || document.activeElement;
  renderFamilyPlan();
  openStagedDialog(
    refs.familyPlanDialog,
    state.dialogMotion.familyPlan,
    refs.closeFamilyPlanDialog,
  );
  refs.familyPlanDialog.querySelector(".family-plan-shell")?.scrollTo({ top: 0 });
}

function closeFamilyPlanDialog(options) {
  return closeStagedDialog(refs.familyPlanDialog, state.dialogMotion.familyPlan, options);
}

function openSourceDialog(trigger) {
  state.lastSourceTrigger = trigger || document.activeElement;
  openStagedDialog(refs.sourceDialog, state.dialogMotion.source, refs.closeSource);
}

function closeSourceDialog(options) {
  return closeStagedDialog(refs.sourceDialog, state.dialogMotion.source, options);
}

function setDashboardStatus(status) {
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

function dashboardFromStatic(data, selectedDate, mealType, preferLatest = false) {
  const variant = data.variants[mealType];
  const official = data.officialSchoolMeals || { schools: [], records: {} };
  const school = official.schools.find((item) => Number(item.fatraceSchoolId) === DEFAULT_SCHOOL_ID);
  const targetDate = preferLatest
    ? LunchDateContext.latestMealDate(variant.days.map((day) => day.date), selectedDate) || selectedDate
    : selectedDate;
  const exact = variant.days.find((day) => day.date === targetDate);
  const earlier = variant.days.filter((day) => day.date <= targetDate);
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
    isFallback: active.date !== selectedDate,
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

function sampleDashboardFromStatic(data, selectedDate, mealType) {
  const variant = data.variants?.[mealType];
  const today = localIsoDate();
  const sampleWeek = LunchSampleDashboard.selectSampleWeek(variant?.days || [], today);
  if (!sampleWeek) throw new Error("目前沒有足夠的已校讀資料可建立功能範例");
  const hasSelectedDate = variant.days.some((day) => day.date === selectedDate && day.date <= today);
  const activeDate = hasSelectedDate ? selectedDate : sampleWeek.selectedDate;
  const dashboard = dashboardFromStatic(data, activeDate, mealType);
  return {
    ...dashboard,
    archive: dashboard.archive.filter((week) => week.endDate <= today),
    isSample: true,
    sampleWeek,
  };
}

function officialDashboardFromStatic(data, selectedDate, schoolId, mealType) {
  const catalog = data.officialSchoolMeals || {
    schools: state.schoolDirectory,
    records: { [String(schoolId)]: data.records || {} },
  };
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

function latestOfficialDashboard(dashboard, requestedDate) {
  const selectedDate = LunchDateContext.latestMealDate(
    dashboard.availableDates,
    requestedDate,
  );
  const record = selectedDate
    ? dashboard.records?.[selectedDate] || (selectedDate === dashboard.selectedDate ? dashboard.record : null)
    : null;
  if (!selectedDate || !record) return dashboard;
  return {
    ...dashboard,
    requestedDate,
    selectedDate,
    record,
    isMissing: false,
    sourceUrl: record.source?.url || `https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=${encodeURIComponent(dashboard.school.fatraceSchoolId)}&period=${encodeURIComponent(selectedDate)}`,
  };
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

async function fetchDashboard(date, {
  preferLatest = false,
  schoolId = state.schoolId,
  mealType = state.mealType,
  signal,
} = {}) {
  if (!schoolId) throw new Error("請先選擇學校");
  if (schoolId !== DEFAULT_SCHOOL_ID || isLocalApiAvailable()) {
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}&mealType=${encodeURIComponent(mealType)}&schoolId=${encodeURIComponent(schoolId)}`, { signal });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (response.ok && isJson) {
        const dashboard = await response.json();
        if (dashboard.record) return dashboard;
        if (preferLatest) {
          const latest = latestOfficialDashboard(dashboard, date);
          if (latest.record) return latest;
        }
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      console.info("Live API unavailable; using the reviewed static snapshot.", error);
    }
  }
  if (schoolId === DEFAULT_SCHOOL_ID) {
    return dashboardFromStatic(await publicSiteData(signal), date, mealType, preferLatest);
  }
  const dashboard = officialDashboardFromStatic(
    await publicSchoolMealData(schoolId, signal),
    date,
    schoolId,
    mealType,
  );
  return preferLatest ? latestOfficialDashboard(dashboard, date) : dashboard;
}

async function fetchSchoolDirectory() {
  const response = await fetch("./data/schools.json");
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

function renderMeal(day, { personalizeAllergens = true } = {}) {
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
  renderAllergenNotice(
    day.allergens,
    day.allergens.length
      ? `原圖標示／菜名可辨識的過敏原：${day.allergens.join("、")}`
      : "過敏原資訊請仍以校方原始菜單與個人需求核對。",
    { personalize: personalizeAllergens },
  );
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
  refs.dishDetailCount.textContent = dish.schoolMenu?.servingText
    ? `校方設計每份 ${dish.schoolMenu.servingText} · 官方食材 ${ingredients.length} 項`
    : `食譜明細共 ${ingredients.length} 項`;
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
    ? dish.schoolMenu?.servingText
      ? "每份設計重量來自校方週菜單；食材名稱、產地、供應商與標章來自教育部同日公開紀錄。"
      : "食材名稱、產地、供應商與標章照教育部當日公開紀錄呈現；官方頁面沒有提供每人用量。"
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

function nutritionEntries(nutrition, { includeMilk = false } = {}) {
  const entries = [
    ["全穀雜糧", nutrition.wholeGrainsServings, 6],
    ["豆魚蛋肉", nutrition.proteinServings, 5],
    ["蔬菜", nutrition.vegetablesServings, 3],
    ["油脂堅果", nutrition.oilsNutsServings, 4],
    ["水果", nutrition.fruitServings, 2],
  ];
  if (includeMilk) entries.splice(4, 0, ["乳品", nutrition.milkServings, 2]);
  return entries;
}

function appendNutritionRows(container, nutrition, options = {}) {
  const fragment = document.createDocumentFragment();
  for (const [label, value, scale] of nutritionEntries(nutrition, options)) {
    const unavailable = value === null || value === undefined || value === "";
    const numericValue = unavailable ? null : Number(value);
    const displayValue = Number.isFinite(numericValue) ? numericValue : null;
    const row = node("div", "nutrition-row");
    row.classList.toggle("is-unavailable", displayValue === null);
    const track = node("div", "bar-track");
    const fill = node("div", "bar-fill");
    fill.style.width = displayValue === null ? "0%" : `${Math.min(100, (displayValue / scale) * 100)}%`;
    track.append(fill);
    row.append(node("span", "", label), track, node("strong", "", displayValue === null ? "未提供" : `${displayValue} 份`));
    fragment.append(row);
  }
  container.append(fragment);
}

function renderNutrition(nutrition) {
  refs.calories.textContent = LunchNumberFormat.sourceCalories(nutrition.caloriesKcal);
  refs.calorieUnit.textContent = "kcal";
  refs.nutritionBars.classList.remove("has-multiple-snapshots");
  refs.nutritionBars.replaceChildren();
  appendNutritionRows(refs.nutritionBars, nutrition);
  refs.nutritionSourceNote.textContent = "份數與熱量照學校公布的營養分析登錄。";
}

function renderOfficialNutrition(snapshots) {
  refs.nutritionBars.replaceChildren();
  refs.nutritionBars.classList.toggle("has-multiple-snapshots", snapshots.length > 1);
  if (snapshots.length === 1) {
    const snapshot = snapshots[0];
    refs.calories.textContent = LunchNumberFormat.sourceCalories(snapshot.nutrition.caloriesKcal);
    refs.calorieUnit.textContent = "kcal";
    appendNutritionRows(refs.nutritionBars, snapshot.nutrition, { includeMilk: true });
  } else {
    refs.calories.textContent = `${snapshots.length} 筆`;
    refs.calorieUnit.textContent = "分列";
    for (const snapshot of snapshots) {
      const section = node("section", "nutrition-snapshot");
      const heading = node("div", "nutrition-snapshot-heading");
      heading.append(
        node("strong", "", snapshot.kitchenName),
        node("span", "", `${LunchNumberFormat.sourceCalories(snapshot.nutrition.caloriesKcal)} kcal`),
      );
      section.append(heading);
      appendNutritionRows(section, snapshot.nutrition, { includeMilk: true });
      refs.nutritionBars.append(section);
    }
  }
  const schoolMenuSnapshots = snapshots.every((snapshot) => snapshot.sourceType === "school_weekly_menu");
  refs.nutritionSourceNote.textContent = schoolMenuSnapshots
    ? "低、高年級份數與熱量照校方週菜單分列；原表未刊載乳品份數，本站不推定為 0。"
    : snapshots.length > 1
      ? "教育部平臺同日有多筆供餐批次；份數與熱量依供餐廚房分列，不加總、不平均也不推估。"
      : "份數與熱量照教育部平臺「六大類食物份數及熱量」同日登錄。";
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

function dinnerRecipeSearchUrl(dishName) {
  const query = `${dishName} 食譜 做法 site:cookpad.com/tw`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function dinnerRecipeLink(dishName) {
  const link = node("a", "", dishName);
  const icon = node("span", "dinner-search-icon", "↗");
  icon.setAttribute("aria-hidden", "true");
  link.href = dinnerRecipeSearchUrl(dishName);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";
  link.setAttribute("aria-label", `搜尋「${dishName}」的食譜，另開新分頁`);
  link.append(icon);
  return link;
}

function renderDinner(suggestion) {
  refs.dinnerTitle.textContent = "今晚吃什麼？從孩子的午餐找靈感";
  refs.dinnerPicks.replaceChildren(...suggestion.recommendations.map(dinnerRecipeLink));
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
  refs.weekLabel.textContent = `${dashboard.isSample ? "功能範例 · " : ""}第 ${active.week} 週 · ${compactDate(active.weekStartDate)}–${compactDate(active.weekEndDate)}`;
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
    const selectDate = dashboard.isSample ? loadSampleDashboard : loadDashboard;
    button.addEventListener("click", () => selectDate(day.date, {
      announce: true,
      focusWeekDay: true,
    }));
    refs.weekDays.append(button);
  }

  const archiveIndex = dashboard.archive.findIndex((week) => week.id === active.weekId);
  refs.previousWeek.disabled = archiveIndex < 0 || archiveIndex >= dashboard.archive.length - 1;
  refs.nextWeek.disabled = archiveIndex <= 0;
  const selectDate = dashboard.isSample ? loadSampleDashboard : loadDashboard;
  refs.previousWeek.onclick = () => selectDate(
    dashboard.archive[archiveIndex + 1].startDate,
    { announce: true },
  );
  refs.nextWeek.onclick = () => selectDate(
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
    const selectDate = dashboard.isSample ? loadSampleDashboard : loadDashboard;
    button.addEventListener("click", () => selectDate(week.startDate, { announce: true }));
    refs.archiveList.append(button);
  }
}

function openSourceImage({ image, label, filename, kind = "summary", trigger }) {
  const requestId = ++state.sourceImageRequestId;
  refs.sourceImage.onload = null;
  refs.sourceImage.onerror = null;
  refs.sourceImage.removeAttribute("src");
  refs.sourceImage.alt = label;
  refs.downloadSource.href = image;
  refs.downloadSource.download = filename;
  refs.dialogTitle.textContent = label;
  refs.sourceDialog.dataset.kind = kind;
  setSourceImageState("loading", `正在載入${label}…`);
  openSourceDialog(trigger);
  refs.sourceImage.onload = async () => {
    try {
      await refs.sourceImage.decode();
    } catch (error) {
      // The load event already confirms usable pixels when decode is unavailable.
    }
    if (requestId === state.sourceImageRequestId) setSourceImageState("ready", `${label}已載入`);
  };
  refs.sourceImage.onerror = () => {
    if (requestId === state.sourceImageRequestId) {
      refs.sourceImage.alt = "";
      setSourceImageState("error", `${label}載入失敗，請稍後再試。`);
    }
  };
  refs.sourceImage.src = image;
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
    const imageExtension = image.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || "jpg";
    openSourceImage({
      image,
      label: `第 ${day.week} 週${label}`,
      filename: `week-${String(day.week).padStart(2, "0")}-${isDetail ? day.mealType : "menu"}.${imageExtension}`,
      kind,
      trigger,
    });
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

function schoolDataScopeText(dashboard = state.dashboard) {
  if (dashboard?.isSample) return "功能範例 · 尚未選校";
  if (!dashboard?.school) return "尚未選擇學校";
  return dashboard.viewMode === "detailed" || dashboard.record?.schoolMenu
    ? "完整菜單＋官方紀錄"
    : "官方當日供餐紀錄";
}

function setSchoolDataScope(message, { temporary = false } = {}) {
  window.clearTimeout(state.schoolDataScopeTimer);
  state.schoolDataScopeTimer = 0;
  refs.schoolDataScope.textContent = message;
  refs.schoolDataScope.classList.toggle("is-feedback", temporary);
  if (!temporary) return;
  state.schoolDataScopeTimer = window.setTimeout(() => {
    refs.schoolDataScope.textContent = schoolDataScopeText();
    refs.schoolDataScope.classList.remove("is-feedback");
    state.schoolDataScopeTimer = 0;
  }, 2600);
}

function renderDefaultSchoolButton() {
  const school = selectedSchool();
  const isDefault = school
    && Number(school.fatraceSchoolId) === Number(state.account.defaultSchoolId);
  refs.defaultSchoolButton.disabled = !school || state.account.loading;
  refs.defaultSchoolButton.classList.toggle("is-default", Boolean(isDefault));
  refs.defaultSchoolButton.textContent = isDefault ? "✓ 預設學校" : "☆ 設為預設學校";
  refs.defaultSchoolButton.setAttribute("aria-pressed", String(Boolean(isDefault)));
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
  renderDefaultSchoolButton();
}

function renderSchoolContext(dashboard) {
  if (Array.isArray(dashboard.schoolDirectory) && dashboard.schoolDirectory.length) {
    state.schoolDirectory = dashboard.schoolDirectory;
  }
  if (dashboard.school) {
    state.schoolId = Number(dashboard.school.fatraceSchoolId);
    state.district = districtKey(dashboard.school);
    populateSchoolSelectors();
    refs.brandSchoolLabel.textContent = "孩子的每一餐";
    const schoolMenu = dashboard.record?.schoolMenu;
    const complete = dashboard.viewMode === "detailed" || Boolean(schoolMenu);
    setSchoolDataScope(schoolDataScopeText(dashboard));
    refs.footerSource.textContent = complete
      ? schoolMenu
        ? `資料來源：${schoolMenu.source.name}、教育部校園食材登錄平臺 · 僅供家庭餐食規劃參考`
        : "資料來源：忠信國小午餐網、教育部校園食材登錄平臺 · 僅供家庭餐食規劃參考"
      : OfficialDiet.profile(dashboard.record).hasVariants
        ? `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 主食、主副菜依「素」字標示分組`
        : `資料來源：教育部校園食材登錄平臺（${dashboard.school.fullName}）· 完整官方紀錄`;
  }
}

function setViewMode(mode, { showOfficialMealTypes = false } = {}) {
  const official = mode === "officialDaily";
  const sample = mode === "sample";
  document.body.dataset.viewMode = official ? "official" : sample ? "sample" : "detailed";
  refs.sampleModeBanner.hidden = !sample;
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
  refs.schoolMenuSourceButton.hidden = true;
  refs.schoolMenuNutritionButton.hidden = true;
  refs.menuBoard.classList.toggle("official-menu-board", official);
  refs.menuKicker.textContent = official ? "官方當日資料" : sample ? "功能範例" : "選擇的午餐";
  refs.menuHeading.textContent = official ? "當日供餐紀錄" : sample ? "範例午餐內容" : "午餐內容";
  refs.reviewBadge.textContent = official ? "✓ 官方公開紀錄" : sample ? "功能範例" : "✓ 已校讀";
  refs.mainDishButton.firstElementChild.textContent = official ? "主菜" : "這餐主角";
  refs.traceabilityKicker.textContent = official ? "官方食材資料" : "食材來源";
  refs.traceabilityHeading.textContent = official ? "教育部公開食材紀錄" : sample ? "範例供餐食材來源" : "今日供餐食材來源";
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"]')) {
    link.hidden = false;
  }
  for (const link of document.querySelectorAll('a[href="#standard"], a[href="#insights"]')) {
    link.hidden = official;
  }
}

async function renderNoSchoolSelected() {
  cancelDashboardRequest();
  state.schoolId = null;
  state.dashboard = null;
  populateSchoolSelectors();
  document.body.dataset.viewMode = "empty";
  refs.mealTypeSwitch.hidden = true;
  refs.sampleModeBanner.hidden = true;
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
  refs.introNote.textContent = "先找孩子的學校，看看午餐菜單、營養資訊、食材來源與過敏原注意事項，也替晚餐找點想法。公開查詢免費，資料依各校公布內容提供。";
  refs.brandSchoolLabel.textContent = "孩子的每一餐";
  setSchoolDataScope("尚未選擇學校");
  refs.footerSource.textContent = "選擇學校後，才會讀取對應的公開午餐資料。";
  refs.errorState.hidden = true;
  for (const link of document.querySelectorAll('a[href="#week"], a[href="#traceability"], a[href="#standard"], a[href="#insights"]')) {
    link.hidden = true;
  }
  if (state.account.child) renderPassportFoodChoices();
  setDashboardStatus("loading", "正在準備功能範例…");
  await loadSampleDashboard();
}

function officialDishes(record, mealType = null) {
  return OfficialDiet.filter(record, mealType).map((dish) => ({
      ...dish,
      schoolMenu: OfficialDiet.schoolMenuDish(record, dish),
      officialRecord: true,
      ingredients: (dish.ingredients || []).map((ingredient) => ({
        ...ingredient,
        officialRecord: true,
      })),
    }));
}

function officialMainDish(dishes, record = null) {
  const plannedMain = record?.schoolMenu?.dishes?.find((dish) => dish.category === "主菜");
  const plannedMatch = plannedMain
    ? dishes.find((dish) => dish.schoolMenu === plannedMain)
    : null;
  return plannedMatch || dishes.find((dish) => dish.category === "主菜") || dishes[0] || null;
}

function renderOfficialMeal(dashboard) {
  const record = dashboard.record;
  const profile = OfficialDiet.profile(record);
  const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  const heroIndex = Math.max(0, dishes.indexOf(officialMainDish(dishes, record)));
  const heroDish = dishes[heroIndex];
  state.dishDetails = dishes;
  state.activeDishIndex = -1;
  refs.mealList.replaceChildren();

  if (!record) {
    refs.mainDish.textContent = "學校目前尚未公布這一天的菜單。";
    refs.heroDish.textContent = "菜單尚未公布";
    refs.mainDishButton.disabled = true;
    refs.mainDishButton.onclick = null;
    refs.dishCount.textContent = "本站不會拿其他日期的紀錄代替今天。";
    refs.allergenRow.classList.remove("is-personal-alert");
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
    item.append(
      node("span", "", dish.schoolMenu?.category || dish.category),
      node("strong", "", dish.name),
    );
    if (dish.schoolMenu?.servingText) item.append(node("em", "", `校方每份 ${dish.schoolMenu.servingText}`));
    item.addEventListener("click", () => openDishDetail(index, item));
    refs.mealList.append(item);
  });
  const monthDay = compactDate(record.mealDate);
  const schoolAllergenNotes = record.schoolMenu?.allergenNotes?.filter((note) => note.includes(monthDay)) || [];
  const officialIngredientEvidence = dishes.flatMap((dish) => (dish.ingredients || []).flatMap((ingredient) => [
    ingredient.name,
    ingredient.standardName,
    ingredient.productName,
  ]));
  renderAllergenNotice(
    [...schoolAllergenNotes, ...officialIngredientEvidence],
    schoolAllergenNotes.length
      ? `校方過敏提醒：${schoolAllergenNotes.join(" ")}`
      : profile.hasVariants
        ? "依官方菜名的「素」字拆分主食、主菜與副菜；蔬菜、湯品與附餐列為兩種分組共用。"
        : "這一天的主食或主菜沒有同時出現有「素」字與未標示「素」的菜色，因此保留官方完整菜色，不另外拆分。",
  );
  refs.mealTypeNote.textContent = profile.hasVariants
    ? "這是依菜名標示所做的分組，不等同素食認證；共用菜色是否含動物性食材，仍以展開後的官方食材明細為準。"
    : record.schoolMenu
      ? "菜色與設計重量照校方週菜單；食材、產地、供應商與標章照同日教育部公開紀錄。"
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
    refs.traceabilityNotice.textContent = `${dashboard.selectedDate} 尚未取得已校讀的同日公開紀錄；本站不會用較早日期代替今天。`;
    refs.traceabilitySummary.textContent = "指定日期無資料";
    const empty = node("div", "traceability-empty");
    empty.append(
      node("strong", "", "等待官方同日紀錄"),
      node("p", "", "取得官方同日資料並完成校讀後，才會加入這裡。"),
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
  const week = OfficialDiet.weekView(
    dashboard.availableDates || [],
    dashboard.selectedDate || localIsoDate(),
  );
  const dates = week.dates;
  refs.weekLabel.textContent = `${compactDate(week.start)}–${compactDate(week.end)}`;
  refs.weekDays.replaceChildren();
  for (const date of dates) {
    const record = dashboard.records?.[date] || (date === dashboard.selectedDate ? dashboard.record : null);
    const profile = OfficialDiet.profile(record);
    const dishes = officialDishes(record, profile.hasVariants ? state.mealType : null);
    const mainDish = officialMainDish(dishes, record);
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
  refs.previousWeek.disabled = !week.previousDate;
  refs.nextWeek.disabled = !week.nextDate;
  refs.previousWeek.onclick = week.previousDate
    ? () => loadDashboard(week.previousDate, { announce: true })
    : null;
  refs.nextWeek.onclick = week.nextDate
    ? () => loadDashboard(week.nextDate, { announce: true })
    : null;
}

function renderOfficial(dashboard) {
  const profile = OfficialDiet.profile(dashboard.record);
  const dishes = officialDishes(dashboard.record, profile.hasVariants ? state.mealType : null);
  const summary = OfficialDiet.summary(dishes);
  const nutritionSnapshots = OfficialDiet.nutritionSnapshots(dashboard.record);
  const dinnerSuggestion = OfficialDiet.dinnerSuggestion(dashboard.record, state.mealType);
  renderSchoolContext(dashboard);
  setViewMode("officialDaily", { showOfficialMealTypes: profile.hasVariants });
  refs.nutritionCard.hidden = nutritionSnapshots.length === 0;
  refs.dinnerCard.hidden = !dinnerSuggestion;
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  const date = dashboard.selectedDate || localIsoDate();
  refs.todayLabel.textContent = formatDate(date, { year: "numeric", weekday: "long" });
  refs.mealMoment.textContent = dashboard.record ? `${dashboard.school.name}這天，` : `${dashboard.school.name}這天，`;
  refs.introNote.textContent = dashboard.record
    ? dashboard.record.schoolMenu
      ? `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}：` : ""}校方完整菜單＋同日教育部食材紀錄。`
      : `${profile.hasVariants ? `${state.mealType === "vegetarian" ? "素食" : "葷食"}：` : ""}${summary.dishCount} 道菜、${summary.ingredientCount} 項食材，來自同日教育部公開紀錄。`
    : `${date} 尚無已校讀紀錄，不會拿別天資料代替。`;
  refs.officialSourceLink.href = dashboard.sourceUrl;
  const menuImages = dashboard.record?.schoolMenu?.source?.images;
  refs.schoolMenuSourceButton.hidden = !menuImages?.overview;
  refs.schoolMenuNutritionButton.hidden = !menuImages?.servingsNutrition;
  refs.schoolMenuSourceButton.onclick = menuImages?.overview
    ? () => openSourceImage({
      image: menuImages.overview,
      label: `${dashboard.school.name}第 ${dashboard.record.schoolMenu.week} 週校方菜單`,
      filename: `${dashboard.school.name}-week-${dashboard.record.schoolMenu.week}-menu.jpg`,
      trigger: refs.schoolMenuSourceButton,
    })
    : null;
  refs.schoolMenuNutritionButton.onclick = menuImages?.servingsNutrition
    ? () => openSourceImage({
      image: menuImages.servingsNutrition,
      label: `${dashboard.school.name}第 ${dashboard.record.schoolMenu.week} 週份量與營養表`,
      filename: `${dashboard.school.name}-week-${dashboard.record.schoolMenu.week}-nutrition.jpg`,
      kind: "detail",
      trigger: refs.schoolMenuNutritionButton,
    })
    : null;
  renderOfficialMeal(dashboard);
  if (nutritionSnapshots.length) renderOfficialNutrition(nutritionSnapshots);
  if (dinnerSuggestion) renderDinner(dinnerSuggestion);
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
  if (dashboard.isSample) {
    populateSchoolSelectors();
    refs.brandSchoolLabel.textContent = "孩子的每一餐";
    setSchoolDataScope("功能範例 · 尚未選校");
    refs.footerSource.textContent = "功能範例使用已校讀公開菜單；實際日期照頁面顯示，不代表今日或任何未選學校的供餐。";
  } else {
    renderSchoolContext(dashboard);
  }
  setViewMode(dashboard.isSample ? "sample" : "detailed");
  const day = dashboard.selected;
  state.mealType = dashboard.mealType;
  refs.mealTypeMeat.setAttribute("aria-pressed", String(state.mealType === "meat"));
  refs.mealTypeVegetarian.setAttribute("aria-pressed", String(state.mealType === "vegetarian"));
  refs.mealTypeNote.textContent = state.mealType === "vegetarian"
    ? "素食菜單可能含蛋、奶；用量為供餐廠商的每人食譜設計值，不代表實際攝取量。"
    : "用量為供餐廠商的每人食譜設計值，不代表實際攝取量。";
  const formatted = formatDate(day.date, { year: "numeric", weekday: "long" });
  refs.todayLabel.textContent = dashboard.isSample ? `功能範例 · ${formatted}` : formatted;
  refs.mealMoment.textContent = dashboard.isSample ? "先看一週，" : LunchDateContext.mealMoment(day.date, localIsoDate());
  refs.introNote.textContent = dashboard.isSample
    ? "先看看一週菜單、營養資訊、晚餐搭配與食材來源；選擇學校後會換成該校公開資料。"
    : dashboard.isFallback
    ? `指定日期沒有供餐資料，先顯示最近的 ${formatDate(day.date)}。`
    : `${dashboard.mealTypeLabel}：${day.meal.staple}、${day.meal.mainDish}；${day.meal.fruit ? `附餐 ${day.meal.fruit}；` : ""}食譜明細共 ${day.recipeDetails?.length || day.meal.sideDishes.length + 2} 道。`;
  renderMeal(day, { personalizeAllergens: !dashboard.isFallback && !dashboard.isSample });
  renderPassportFoodChoices();
  renderNutrition(day.nutrition);
  if (dashboard.isSample) {
    refs.nutritionSourceNote.textContent = "功能範例取自已校讀菜單；數值不代表今日或未選學校。";
  }
  renderStandard(dashboard);
  renderTraceability(dashboard.traceability);
  renderDinner(dashboard.dinnerSuggestion);
  renderFoodEducation(dashboard.foodEducation);
  renderHomeRecipe(dashboard.homeRecipe);
  renderWeek(dashboard);
  renderInsights(dashboard.insights, dashboard);
  renderArchive(dashboard);
  renderSource(day);
  if (dashboard.isSample) {
    refs.sampleModeDate.textContent = `目前示範 ${formatDate(day.weekStartDate, { year: "numeric" })}至${formatDate(day.weekEndDate)}的已校讀菜單；溯源卡保留實際資料日期，不代表今日食材、產地、供應商或批次。`;
  }
  setDashboardStatus("ready", dashboard.isSample ? "功能範例 · 選校後顯示該校資料" : `已整理 ${dashboard.totalDays} 個供餐日`);
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
    dashboard.isSample ? "功能範例" : null,
    formatDate(day.date, { year: "numeric", weekday: "long" }),
    `${dashboard.mealTypeLabel}午餐`,
    day.meal.mainDish,
  ].filter(Boolean).join("，");
}

async function loadSampleDashboard(date, { announce = false, focusWeekDay = false } = {}) {
  const requestId = ++state.sampleRequestId;
  setDashboardStatus("loading", state.dashboard?.isSample ? "正在更新功能範例…" : "正在準備功能範例…");
  try {
    const data = await sampleSiteData();
    if (requestId !== state.sampleRequestId || state.schoolId) return;
    const payload = sampleDashboardFromStatic(data, date, state.mealType);
    state.dashboard = payload;
    render(payload);
    if (!state.newsLoaded) loadNewsPreview();
    if (focusWeekDay) {
      refs.weekDays.querySelector(`.day-card[data-date="${payload.selected.date}"]`)?.focus({ preventScroll: true });
    }
    if (announce) announceSelection(payload);
  } catch (error) {
    if (requestId !== state.sampleRequestId || state.schoolId) return;
    console.error("Unable to prepare the sample dashboard", error);
    setDashboardStatus("ready", "請先選擇學校");
  }
}

function cancelDashboardRequest() {
  state.dashboardRequestId += 1;
  state.dashboardAbortController?.abort();
  state.dashboardAbortController = null;
  state.loading = false;
}

async function loadDashboard(date, { announce = false, focusWeekDay = false, preferLatest = false } = {}) {
  state.dashboardAbortController?.abort();
  const controller = new AbortController();
  const requestId = ++state.dashboardRequestId;
  const schoolId = state.schoolId;
  const mealType = state.mealType;
  state.dashboardAbortController = controller;
  state.loading = true;
  setDashboardStatus("loading", state.dashboard ? "正在更新菜單…" : "正在讀取菜單…");
  const isCurrentRequest = () => (
    requestId === state.dashboardRequestId &&
    schoolId === state.schoolId &&
    mealType === state.mealType &&
    !controller.signal.aborted
  );
  try {
    const payload = await fetchDashboard(date, {
      preferLatest,
      schoolId,
      mealType,
      signal: controller.signal,
    });
    if (!isCurrentRequest()) return;
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
    if (isAbortError(error) || !isCurrentRequest()) return;
    refs.errorState.hidden = false;
    console.error("Unable to load school lunch dashboard", error);
    refs.errorMessage.textContent = "目前還無法顯示這份菜單，請稍後再試。";
    setDashboardStatus("error", "菜單暫時無法顯示");
  } finally {
    if (requestId === state.dashboardRequestId) {
      if (state.dashboardAbortController === controller) {
        state.dashboardAbortController = null;
      }
      state.loading = false;
    }
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
  if (state.dashboard?.isSample) {
    await loadSampleDashboard(selectedDate, { announce: true });
    return;
  }
  await loadDashboard(selectedDate, { announce: true });
}

refs.mealTypeMeat.addEventListener("click", () => selectMealType("meat"));
refs.mealTypeVegetarian.addEventListener("click", () => selectMealType("vegetarian"));

async function selectSchool(schoolId) {
  state.sampleRequestId += 1;
  const nextSchoolId = Number(schoolId);
  const exists = state.schoolDirectory.some(
    (school) => Number(school.fatraceSchoolId) === nextSchoolId,
  );
  if (!exists) {
    await renderNoSchoolSelected();
    return;
  }
  if (nextSchoolId === state.schoolId && state.dashboard) return;
  state.schoolId = nextSchoolId;
  if (state.account.child) refs.encounterForm.hidden = true;
  await loadDashboard(localIsoDate(), { announce: true, preferLatest: true });
}

refs.schoolSelect.addEventListener("change", () => selectSchool(refs.schoolSelect.value));
refs.districtSelect.addEventListener("change", async () => {
  state.district = refs.districtSelect.value;
  await renderNoSchoolSelected();
  refs.schoolSelect.focus();
});
refs.sampleSelectSchool.addEventListener("click", () => {
  refs.schoolSelect.scrollIntoView({ behavior: "smooth", block: "center" });
  refs.schoolSelect.focus({ preventScroll: true });
});
async function persistDefaultSchool(schoolId) {
  const isClearing = Number(state.account.defaultSchoolId) === schoolId;
  refs.defaultSchoolButton.disabled = true;
  try {
    const response = await fetch("/api/account/default-school", {
      method: isClearing ? "DELETE" : "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: isClearing ? undefined : JSON.stringify({ schoolId }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前無法更新預設學校，請稍後再試。");
    state.account.defaultSchoolId = payload.defaultSchoolId ?? null;
    return isClearing;
  } finally {
    renderDefaultSchoolButton();
  }
}

refs.defaultSchoolButton.addEventListener("click", async () => {
  const school = selectedSchool();
  if (!school) return;
  const schoolId = Number(school.fatraceSchoolId);
  if (!state.account.authenticated) {
    state.pendingDefaultSchoolId = schoolId;
    openAccountDialog(refs.defaultSchoolButton);
    return;
  }
  try {
    const cleared = await persistDefaultSchool(schoolId);
    setSchoolDataScope(
      cleared ? "已取消預設學校。" : "已設為預設學校，會隨帳號同步。",
      { temporary: true },
    );
  } catch (error) {
    setSchoolDataScope(error instanceof Error ? error.message : "目前無法更新預設學校，請稍後再試。");
  } finally {
    renderDefaultSchoolButton();
  }
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
  if (event.target !== refs.accountDialog) return;
  event.preventDefault();
  closeAccountDialog();
});
refs.accountDialog.addEventListener("close", () => {
  state.pendingDefaultSchoolId = null;
  renderAccountIntentNotice();
  const trigger = state.lastAccountTrigger;
  state.lastAccountTrigger = null;
  if (trigger?.isConnected) trigger.focus();
});
refs.closeFamilyPlanDialog.addEventListener("click", () => closeFamilyPlanDialog());
refs.closeFamilyPlanAction.addEventListener("click", () => closeFamilyPlanDialog());
refs.familyPlanDialog.addEventListener("click", (event) => {
  if (event.target === refs.familyPlanDialog) closeFamilyPlanDialog();
});
refs.familyPlanDialog.addEventListener("cancel", (event) => {
  if (event.target !== refs.familyPlanDialog) return;
  event.preventDefault();
  closeFamilyPlanDialog();
});
refs.familyPlanDialog.addEventListener("close", () => {
  const trigger = state.lastFamilyPlanTrigger;
  state.lastFamilyPlanTrigger = null;
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
refs.parentAvatarInput.addEventListener("change", () => {
  selectAvatarFile("parent", refs.parentAvatarInput.files?.[0]);
});
refs.childAvatarInput.addEventListener("change", () => {
  selectAvatarFile("child", refs.childAvatarInput.files?.[0]);
});
refs.parentProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  refs.saveParentProfile.disabled = true;
  setFormStatus(refs.parentProfileStatus, "正在儲存個人設定…", "loading");
  try {
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: refs.parentName.value,
        nickname: refs.parentNickname.value,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前無法儲存家長資料，請稍後再試。");
    if (state.parentAvatarFile) {
      await uploadAvatar("parent", null, state.parentAvatarFile);
    }
    resetAvatarSelection("parent");
    await loadAccount({ childId: state.activeChildId });
    setFormStatus(refs.parentProfileStatus, "個人設定已更新。", "success");
  } catch (error) {
    setFormStatus(refs.parentProfileStatus, error instanceof Error ? error.message : "目前無法儲存家長資料，請稍後再試。", "error");
  } finally {
    refs.saveParentProfile.disabled = false;
  }
});
refs.removeParentAvatar.addEventListener("click", async () => {
  refs.removeParentAvatar.disabled = true;
  setFormStatus(refs.parentProfileStatus, "正在移除大頭貼…", "loading");
  try {
    await deleteAvatar();
    resetAvatarSelection("parent");
    await loadAccount({ childId: state.activeChildId });
    setFormStatus(refs.parentProfileStatus, "大頭貼已移除。", "success");
  } catch (error) {
    setFormStatus(refs.parentProfileStatus, error instanceof Error ? error.message : "大頭貼暫時無法移除", "error");
  } finally {
    refs.removeParentAvatar.disabled = false;
  }
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

function focusAccountChildEditor(focusTarget) {
  window.requestAnimationFrame(() => {
    if (state.onboardingActive) {
      refs.childSetupTitle.tabIndex = -1;
      refs.childSetupTitle.focus({ preventScroll: true });
      refs.accountDialog.querySelector(".account-dialog-shell")?.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    refs.accountChildEditor.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    focusTarget?.focus({ preventScroll: true });
  });
}

function openChildEditor(focusTarget, { trigger = document.activeElement, childOnly = false } = {}) {
  const child = state.account.child;
  if (!child) return;
  resetAvatarSelection("child");
  state.creatingChild = false;
  state.editingChild = true;
  state.accountDialogView = childOnly ? "child" : "family";
  setFormStatus(refs.childFormStatus);
  setFormStatus(refs.accountFamilyStatus);
  renderAccount();
  if (!refs.accountDialog.open) openAccountDialog(trigger, { view: state.accountDialogView });
  focusAccountChildEditor(focusTarget);
}

async function openPassportChildSettings(childId, trigger) {
  await selectAccountChild(childId);
  if (!state.account.child) return;
  openChildEditor(refs.childName, { trigger, childOnly: true });
}

async function selectAccountChild(childId) {
  PassportMemory.clear();
  const nextChild = (state.account.children || []).find((child) => Number(child.id) === Number(childId));
  if (!nextChild || Number(nextChild.id) === Number(state.account.child?.id)) return;
  state.editingChild = false;
  state.creatingChild = false;
  refs.encounterForm.reset();
  refs.encounterEntry.open = false;
  updateNoEatDetails();
  resetPassportOptionalDetails();
  rememberActiveChild(nextChild);
  await loadAccount({ childId: Number(nextChild.id) });
  if (state.account.child?.schoolId) await selectSchool(state.account.child.schoolId);
  setFormStatus(refs.encounterFormStatus, `已切換到${profileDisplayName(state.account.child, "這位孩子")}的紀錄。`, "success");
}

function startChildCreation(trigger = document.activeElement) {
  if (!state.account.canAddChild) {
    openFamilyPlanDialog(trigger);
    return;
  }
  state.editingChild = false;
  state.creatingChild = true;
  resetAvatarSelection("child");
  refs.childForm.reset();
  setFormStatus(refs.childFormStatus);
  setFormStatus(refs.accountFamilyStatus);
  renderAccount();
  if (!refs.accountDialog.open) openAccountDialog(trigger);
  focusAccountChildEditor(refs.childName);
}

refs.editChildButton.addEventListener("click", () => {
  openChildEditor(refs.childName, { trigger: refs.editChildButton });
});

refs.editChildFromSchoolPicker.addEventListener("click", () => {
  openChildEditor(refs.childSchool, { trigger: refs.editChildFromSchoolPicker });
});

refs.childPlanSummary.addEventListener("click", () => openFamilyPlanDialog(refs.childPlanSummary));
refs.addChildButton.addEventListener("click", () => startChildCreation(refs.addChildButton));
refs.accountAddChild.addEventListener("click", () => startChildCreation(refs.accountAddChild));
refs.openChildSettings.addEventListener("click", () => startChildCreation(refs.openChildSettings));

refs.accountChildBack.addEventListener("click", () => {
  const childId = Number(state.account.child?.id);
  state.accountDialogView = "family";
  state.editingChild = false;
  state.creatingChild = false;
  resetAvatarSelection("child");
  setFormStatus(refs.childFormStatus);
  renderAccount();
  const editButton = childId
    ? refs.accountChildList.querySelector(`[data-child-id="${childId}"]`)
    : null;
  (editButton || refs.accountAddChild).focus();
});

refs.removeChildAvatar.addEventListener("click", async () => {
  const childId = Number(state.account.child?.id);
  if (!childId) return;
  refs.removeChildAvatar.disabled = true;
  setFormStatus(refs.childFormStatus, "正在移除大頭貼…", "loading");
  try {
    await deleteAvatar(childId);
    resetAvatarSelection("child");
    await loadAccount({ childId });
    state.editingChild = true;
    renderAccount();
    setFormStatus(refs.childFormStatus, "大頭貼已移除。", "success");
  } catch (error) {
    setFormStatus(refs.childFormStatus, error instanceof Error ? error.message : "大頭貼暫時無法移除", "error");
  } finally {
    refs.removeChildAvatar.disabled = false;
  }
});

refs.cancelChildEdit.addEventListener("click", async () => {
  if (state.onboardingActive) {
    await skipOnboarding();
    return;
  }
  if (state.accountDialogView === "child") {
    refs.accountChildBack.click();
    return;
  }
  const wasCreating = state.creatingChild;
  const childId = Number(state.account.child?.id);
  state.editingChild = false;
  state.creatingChild = false;
  resetAvatarSelection("child");
  setFormStatus(refs.childFormStatus);
  renderAccount();
  if (wasCreating && !childId) {
    closeAccountDialog();
    return;
  }
  const editButton = childId
    ? refs.accountChildList.querySelector(`[data-child-id="${childId}"]`)
    : null;
  (wasCreating ? refs.accountAddChild : editButton || refs.accountAddChild).focus();
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
  setFormStatus(refs.childFormStatus, "正在儲存孩子資料…");
  try {
    const wasEditing = state.editingChild;
    const wasOnboarding = state.onboardingActive;
    const keepChildSettingsOpen = state.accountDialogView === "child";
    const response = await fetch("/api/account/child", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: wasEditing ? state.account.child?.id : null,
        name: refs.childName.value,
        nickname: refs.childNickname.value,
        gradeGroup: refs.childGradeGroup.value,
        schoolId: refs.childSchool.value,
        allergenCodes: selectedChildAllergenCodes(),
        onboarding: wasOnboarding,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前無法儲存孩子資料，請稍後再試。");
    if (payload.onboardingCompleted === true) trackOnboardingEvent("onboarding_completed");
    if (!wasEditing && payload.childId) {
      state.activeChildId = Number(payload.childId);
    }
    const savedChildId = Number(payload.childId || state.account.child?.id);
    if (state.childAvatarFile && savedChildId) {
      await uploadAvatar("child", savedChildId, state.childAvatarFile);
    }
    resetAvatarSelection("child");
    state.editingChild = keepChildSettingsOpen;
    state.creatingChild = false;
    await loadAccount({ childId: state.activeChildId });
    if (!wasEditing && state.account.child?.schoolId) await selectSchool(state.account.child.schoolId);
    if (wasEditing && state.dashboard) render(state.dashboard);
    const successMessage = wasEditing
      ? "孩子設定已更新。"
      : wasOnboarding
        ? "第一位孩子資料已建立；關閉設定後，就能開始記錄孩子的飲食。"
        : "已建立孩子資料。";
    if (keepChildSettingsOpen) {
      state.editingChild = true;
      renderAccount();
      setFormStatus(refs.childFormStatus, successMessage, "success");
    } else {
      setFormStatus(refs.accountFamilyStatus, successMessage, "success");
    }
    setFormStatus(refs.encounterFormStatus, successMessage, "success");
  } catch (error) {
    setFormStatus(refs.childFormStatus, error instanceof Error ? error.message : "目前無法儲存孩子資料，請稍後再試。", "error");
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
  const mealContext = "school_lunch";
  const dishName = selectedSource || null;
  const foodName = refs.customFoodName.value.trim() || dishName || "";
  const formData = new FormData(refs.encounterForm);
  let experience = formData.get("experience") || "unrecorded";
  if (experience === "not_eaten") experience = formData.get("noEatContact") || experience;
  const reaction = formData.get("reaction");
  const reactions = reaction ? [reaction] : [];
  const familiarity = formData.get("familiarity");
  if (!selectedSource || !passportFoodOptions().includes(selectedSource)) {
    setFormStatus(refs.encounterFormStatus, "請先選擇孩子學校這一天的來源菜色；尚未取得菜單時，請稍後再記。", "error");
    refs.passportFoodChoices.querySelector("input")?.focus();
    return;
  }
  if (!foodName) {
    setFormStatus(refs.encounterFormStatus, "請選擇這次午餐的來源菜色。", "error");
    refs.passportOptionalDetails.open = true;
    refs.customFoodName.focus();
    return;
  }
  if (experience === "unrecorded" && !reactions.length && !refs.encounterChildQuote.value.trim() && !refs.encounterNote.value.trim()) {
    setFormStatus(refs.encounterFormStatus, "留下一句原話、一點觀察或這次的感受就可以了。", "error");
    return;
  }
  const savingChildId = state.account.child.id;
  const submit = refs.encounterForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setFormStatus(refs.encounterFormStatus, "正在儲存這筆紀錄…");
  try {
    const response = await fetch("/api/account/encounters", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: state.account.child?.id,
        schoolId: state.account.child?.schoolId,
        mealDate: selectedMealDate(),
        mealType: state.mealType,
        mealContext,
        dishName,
        foodName,
        experience,
        reactions,
        childQuote: refs.encounterChildQuote.value,
        firstEncounter: familiarity === "first" ? true : familiarity === "previous" ? false : null,
        preparation: refs.encounterPreparation.value,
        note: refs.encounterNote.value,
      }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "目前無法儲存這筆飲食紀錄，請稍後再試。");
    if (state.account.child?.id !== savingChildId) return;
    refs.encounterForm.reset();
    updateNoEatDetails();
    resetPassportOptionalDetails();
    setMemoryMode("quote");
    setFormStatus(refs.encounterFormStatus, "已留下這次的記憶。", "success");
    await loadAccount({ childId: savingChildId });
    if (state.account.child?.id !== savingChildId) return;
    refs.encounterEntry.open = false;
    if (payload.encounter) PassportMemory.saved(payload.encounter, savingChildId, refreshPassportMemories);
    else refs.encounterEntryToggle.focus({ preventScroll: true });
  } catch (error) {
    setFormStatus(refs.encounterFormStatus, error instanceof Error ? error.message : "目前無法儲存這筆飲食紀錄，請稍後再試。", "error");
  } finally {
    submit.disabled = false;
  }
});

async function refreshPassportMemories() {
  const saved = document.getElementById("passportSavedMemory");
  if (saved) { saved.hidden = true; saved.replaceChildren(); }
  await loadAccount({ childId: state.account.child?.id });
}

function setMemoryMode(mode) {
  document.querySelectorAll("[data-memory-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.memoryMode === mode));
  });
  for (const [key, id] of [["quote", "memoryQuoteField"], ["note", "memoryNoteField"], ["experience", "memoryExperienceField"]]) {
    document.getElementById(id).hidden = key !== mode;
  }
}
document.querySelectorAll("[data-memory-mode]").forEach(button => {
  button.addEventListener("click", () => setMemoryMode(button.dataset.memoryMode));
});

function updateNoEatDetails() {
  const show = refs.experienceChoices.querySelector('input[name="experience"]:checked')?.value === "not_eaten";
  refs.noEatDetails.hidden = !show;
  if (!show) {
    refs.noEatDetails.querySelectorAll('input[name="noEatContact"]').forEach((input) => {
      input.checked = false;
    });
  }
}

function enableRadioDeselection(container) {
  let pointerInput = null;
  let pointerWasChecked = false;
  let selectedInput = container.querySelector('input[type="radio"]:checked');

  container.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    pointerInput = target?.matches('input[type="radio"]')
      ? target
      : target?.closest("label")?.querySelector('input[type="radio"]') || null;
    pointerWasChecked = Boolean(pointerInput?.checked);
  });
  container.addEventListener("pointercancel", () => {
    pointerInput = null;
    pointerWasChecked = false;
  });
  container.addEventListener("click", (event) => {
    const input = event.target instanceof Element && event.target.matches('input[type="radio"]')
      ? event.target
      : null;
    if (!input || !container.contains(input)) return;
    const virtualRepeat = !pointerInput && event.detail === 0 && selectedInput === input;
    if ((pointerInput === input && pointerWasChecked) || virtualRepeat) {
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    pointerInput = null;
    pointerWasChecked = false;
  });
  container.addEventListener("keydown", (event) => {
    const input = event.target instanceof Element && event.target.matches('input[type="radio"]')
      ? event.target
      : null;
    if (!input?.checked || (event.key !== " " && event.key !== "Spacebar")) return;
    event.preventDefault();
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  container.addEventListener("change", () => {
    selectedInput = container.querySelector('input[type="radio"]:checked');
  });
}

refs.experienceChoices.addEventListener("change", updateNoEatDetails);
refs.passportFoodChoices.addEventListener("change", () => {
  syncPassportOptionalDetails({ focusFoodName: true });
});
[
  refs.passportFoodChoices,
  refs.experienceChoices,
  refs.noEatDetails,
  refs.encounterForm.querySelector(".familiarity-list"),
  refs.reactionChoices,
].forEach(enableRadioDeselection);

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

function sectionIdFromHash(hash) {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return "";
  }
}

const initialSectionId = sectionIdFromHash(window.location.hash);
const homepageSectionIds = new Set([
  "today",
  "week",
  "traceability",
  "passport",
  "standard",
  "insights",
]);

async function restoreInitialSectionPosition() {
  if (!homepageSectionIds.has(initialSectionId)) return;
  if (sectionIdFromHash(window.location.hash) !== initialSectionId) return;
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  const target = document.getElementById(initialSectionId);
  if (!target || target.hidden || !target.getClientRects().length) return;
  const previousScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  target.scrollIntoView({ block: "start" });
  document.documentElement.style.scrollBehavior = previousScrollBehavior;
}

async function initialize() {
  renderAccount();
  refs.authBirthDate.max = adultBirthDateMaximum();
  const accountRequest = loadAccount();
  setDashboardStatus("loading", "正在讀取學校名冊…");
  try {
    state.schoolDirectory = await fetchSchoolDirectory();
    const sampleRequest = renderNoSchoolSelected();
    await accountRequest;
    openRequestedAccountDialog();
    if (state.onboardingActive) {
      if (!refs.accountDialog.open) openAccountDialog(refs.accountButton);
      focusAccountChildEditor(refs.childName);
    }
    const defaultSchool = schoolById(state.account.defaultSchoolId);
    const childSchool = schoolById(state.account.child?.schoolId);
    const initialSchool = defaultSchool || childSchool;
    if (!initialSchool) {
      renderAccount();
      await sampleRequest;
      return;
    }
    state.sampleRequestId += 1;
    state.schoolId = Number(initialSchool.fatraceSchoolId);
    state.district = districtKey(initialSchool);
    populateSchoolSelectors();
    renderAccount();
    await loadDashboard(localIsoDate());
  } catch (error) {
    refs.errorState.hidden = false;
    console.error("Unable to initialize school lunch site", error);
    refs.errorMessage.textContent = "目前還無法顯示學校與菜單資料，請稍後再試。";
    setDashboardStatus("error", "學校資料暫時無法顯示");
  } finally {
    await restoreInitialSectionPosition();
  }
}

initialize();
