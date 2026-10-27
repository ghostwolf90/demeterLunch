const accountPanelTriggers = document.querySelectorAll("[data-account-panel-trigger]");

if (accountPanelTriggers.length) {
  const state = {
    account: {
      loading: true,
      authenticated: false,
      user: null,
      children: [],
      child: null,
      supportEmail: null,
    },
    schools: [],
    activeChildId: Number(window.localStorage.getItem("demeter-active-child-id")) || null,
    authChallengeId: null,
    creatingChild: false,
    editingChild: false,
    lastTrigger: null,
    parentAvatarFile: null,
    parentAvatarPreviewUrl: null,
    childAvatarFile: null,
    childAvatarPreviewUrl: null,
    onboardingActive: false,
    onboardingStartPending: false,
    motion: { openFrame: 0, closeTimer: 0, closePromise: null },
  };

  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="account-dialog" id="sharedAccountDialog" aria-label="家庭帳號">
      <div class="account-dialog-shell">
        <button class="account-dialog-close modal-close-button" id="sharedCloseAccountDialog" type="button" aria-label="關閉帳號設定"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        <div class="account-signed-out-view" id="sharedAccountSignedOutView">
          <span class="account-dialog-mark" aria-hidden="true">家</span>
          <p class="kicker">免費建立家庭帳號</p>
          <h2>替孩子留一份飲食紀錄</h2>
          <p class="account-value-copy">登入後，可以保存孩子提過的食物、說過的話，還有你想記住的事。</p>
          <ul><li>免費建立 1 位孩子的飲食紀錄</li><li>記錄學校午餐與日常飲食</li><li>留下孩子對不同食物的感受與嘗試</li></ul>
          <form class="account-auth-form" id="sharedEmailAuthForm">
            <label>家長 Email
              <input id="sharedAuthEmail" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required placeholder="請輸入電子郵件" />
            </label>
            <label>家長／成年照顧者出生日期
              <input id="sharedAuthBirthDate" name="birthDate" type="date" autocomplete="bday" required />
              <small>只用來確認已滿 18 歲；完整生日不會保存。</small>
            </label>
            <label class="account-consent">
              <input id="sharedAuthCaregiverConfirmed" name="caregiverConfirmed" type="checkbox" required />
              <span>我確認我是年滿 18 歲的家長、法定監護人或獲家長授權的成年照顧者，此帳號不由孩子自行使用。</span>
            </label>
            <button class="account-sign-in" id="sharedRequestAuthCode" type="submit">寄送登入驗證碼</button>
            <p class="account-login-note">不需要設定密碼，透過 Email 驗證即可登入。</p>
            <p class="account-legal-note">繼續使用即表示你同意<a href="/terms">服務條款</a>，並已閱讀<a href="/privacy">隱私權政策</a>；公開午餐查詢不需要註冊。</p>
            <p class="account-registration-notice">驗證碼 10 分鐘內有效；完整生日不會保存。</p>
            <p class="form-status" id="sharedAuthRequestStatus" role="status" aria-live="polite"></p>
          </form>
          <div class="account-code-step" id="sharedEmailCodeStep" hidden>
            <p>已寄出驗證碼，請查看 <strong id="sharedAuthMaskedEmail">—</strong> 的信箱，並在 10 分鐘內輸入。</p>
            <form class="account-auth-form" id="sharedEmailCodeForm">
              <label>六位數驗證碼
                <input id="sharedAuthCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000" />
              </label>
              <button class="account-sign-in" id="sharedVerifyAuthCode" type="submit">驗證並登入</button>
              <p class="form-status" id="sharedAuthVerifyStatus" role="status" aria-live="polite"></p>
            </form>
            <button class="account-text-button" id="sharedChangeAuthEmail" type="button">返回並重新寄送驗證碼</button>
          </div>
          <details class="account-privacy"><summary>資料使用說明</summary><p>我們保存已驗證的家長 Email、成年確認結果，以及家長自行填寫的家庭成員姓名、暱稱、大頭貼與飲食紀錄。完整生日不會寫入資料庫，也不要求孩子提供 Email 或生日；大頭貼只供登入後的家庭帳號讀取。<a href="/privacy">查看完整隱私權政策</a></p></details>
          <p class="account-public-menu-note">只想查看學校午餐嗎？不需要註冊，也能免費使用。</p>
        </div>
        <div id="sharedAccountSignedInView" hidden>
          <div class="account-profile-hero">
            <div class="profile-avatar-preview is-parent" id="sharedParentAvatarPreview" aria-hidden="true">家</div>
            <div><p class="kicker">家庭帳號</p><h2>個人設定</h2><p id="sharedAccountIdentity">—</p></div>
          </div>
          <form class="profile-settings-form" id="sharedParentProfileForm">
            <div class="profile-photo-actions account-photo-actions">
              <label for="sharedParentAvatarInput">更換大頭貼</label>
              <input id="sharedParentAvatarInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden />
              <button class="profile-photo-remove" id="sharedRemoveParentAvatar" type="button" hidden>移除照片</button>
            </div>
            <div class="profile-settings-grid">
              <label><span class="field-heading">家長姓名</span><input id="sharedParentName" name="name" maxlength="40" autocomplete="name" required /></label>
              <label><span class="field-heading">暱稱 <span class="field-optional">選填</span></span><input id="sharedParentNickname" name="nickname" maxlength="20" autocomplete="nickname" /><small>有暱稱顯示暱稱，沒有則顯示姓名。</small></label>
            </div>
            <button class="profile-save-button" id="sharedSaveParentProfile" type="submit">儲存個人設定</button>
            <p class="form-status" id="sharedParentProfileStatus" role="status" aria-live="polite"></p>
          </form>
          <section class="account-family-panel" aria-labelledby="sharedAccountFamilyTitle">
            <div class="account-section-heading">
              <div><p class="kicker">家庭成員</p><h3 id="sharedAccountFamilyTitle">孩子設定</h3></div>
              <button id="sharedAccountAddChild" type="button">新增孩子</button>
            </div>
            <div class="account-child-list" id="sharedAccountChildList"></div>
            <p class="form-status account-family-status" id="sharedAccountFamilyStatus" role="status" aria-live="polite"></p>
            <div class="account-child-editor" id="sharedAccountChildEditor" hidden>
              <div class="account-child-editor-heading">
                <p class="kicker">孩子設定</p>
                <h4 id="sharedChildSetupTitle">編輯孩子設定</h4>
                <p id="sharedChildSetupDescription">姓名只用在家庭帳號內；可另外設定暱稱，畫面會優先顯示暱稱。</p>
              </div>
              <form class="child-form" id="sharedChildForm">
                <div class="profile-photo-field child-photo-field">
                  <div class="profile-avatar-preview" id="sharedChildAvatarPreview" aria-hidden="true">孩</div>
                  <div>
                    <strong>孩子大頭貼</strong>
                    <p>選填，照片只會顯示在登入後的家庭帳號。</p>
                    <div class="profile-photo-actions">
                      <label for="sharedChildAvatarInput">選擇照片</label>
                      <input id="sharedChildAvatarInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden />
                      <button class="profile-photo-remove" id="sharedRemoveChildAvatar" type="button" hidden>移除照片</button>
                    </div>
                  </div>
                </div>
                <label><span class="field-heading">孩子本名</span><input id="sharedChildName" name="name" maxlength="40" autocomplete="off" required placeholder="例如：林小禾" /></label>
                <label><span class="field-heading">孩子暱稱 <span class="field-optional">選填</span></span><input id="sharedChildNickname" name="nickname" maxlength="20" autocomplete="off" placeholder="例如：小禾" /><small>有填暱稱時，網站會優先顯示暱稱。</small></label>
                <label><span class="field-heading">年級</span><select id="sharedChildGradeGroup" name="gradeGroup"><option value="not_set">暫不設定</option><option value="elementary_lower">國小 1–3 年級</option><option value="elementary_upper">國小 4–6 年級</option></select></label>
                <label class="child-school-field"><span class="field-heading">孩子就讀國小</span><select id="sharedChildSchool" name="schoolId" required><option value="">正在讀取學校名冊…</option></select><small>這是孩子午餐紀錄所屬學校；切換公開學校只會查看，不會改掉這裡。</small></label>
                <fieldset class="child-allergen-fieldset">
                  <legend>需要留意的食物 <span>選填，可隨時修改</span></legend>
                  <p>選擇後，只要孩子學校的當日資料中有可辨識項目，午餐頁就會顯示個人提醒。</p>
                  <div class="allergen-choice-list">
                    <label><input type="checkbox" name="sharedChildAllergen" value="egg" /><span>蛋</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="milk" /><span>奶類</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="peanut" /><span>花生</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="tree_nuts" /><span>堅果類</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="sesame" /><span>芝麻</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="gluten" /><span>麩質穀物</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="soy" /><span>大豆</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="fish" /><span>魚類</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="crustaceans" /><span>甲殼類</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="mango" /><span>芒果</span></label>
                    <label><input type="checkbox" name="sharedChildAllergen" value="sulfites" /><span>亞硫酸鹽</span></label>
                  </div>
                  <small>各校多在當日 08:00–18:00 陸續公布；本站只在取得當日資料後顯示提醒，不會前一晚預測。未顯示提醒不代表餐點不含該食物，嚴重過敏仍請直接向校方確認。</small>
                </fieldset>
                <div class="child-form-actions">
                  <button id="sharedChildFormSubmit" type="submit">儲存孩子資料</button>
                  <button class="secondary" id="sharedCancelChildEdit" type="button">取消</button>
                </div>
                <p class="form-status" id="sharedChildFormStatus" role="status" aria-live="polite"></p>
              </form>
            </div>
          </section>
          <section class="account-plan-panel" id="sharedAccountPlanPanel" aria-labelledby="sharedAccountPlanName">
            <div class="account-plan-heading">
              <strong id="sharedAccountPlanName">免費方案</strong>
              <span id="sharedAccountSubscriptionState">免費使用中</span>
            </div>
            <p id="sharedAccountPlanDescription">免費家庭帳號目前可建立 1 位孩子，並使用現階段開放的家庭飲食紀錄功能。</p>
            <dl class="account-subscription-details">
              <div><dt>訂閱狀態</dt><dd id="sharedAccountSubscriptionDetail">目前使用免費方案。</dd></div>
              <div><dt>孩子名額</dt><dd id="sharedAccountChildUsage">0 / 1 位孩子</dd></div>
            </dl>
            <p class="account-plan-status" id="sharedAccountPlanStatus">目前開放免費體驗；其他家庭功能若有調整，將另行公告。</p>
          </section>
          <div class="account-support" id="sharedAccountSupport" hidden>
            <strong>需要協助嗎？</strong>
            <p>有使用上的問題，歡迎寫信給好好吃飯客服。</p>
            <a class="account-support-email" id="sharedAccountSupportEmail"></a>
            <div class="account-support-links"><a href="/support">前往支援中心</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a></div>
          </div>
          <button class="account-sign-in secondary" id="sharedAccountSignOut" type="button">登出</button>
        </div>
      </div>
    </dialog>
  `);

  const ids = [
    "sharedAccountDialog", "sharedCloseAccountDialog", "sharedAccountSignedOutView",
    "sharedAccountSignedInView", "sharedEmailAuthForm", "sharedAuthEmail",
    "sharedAuthBirthDate", "sharedAuthCaregiverConfirmed", "sharedRequestAuthCode",
    "sharedAuthRequestStatus", "sharedEmailCodeStep", "sharedEmailCodeForm",
    "sharedAuthCode", "sharedVerifyAuthCode", "sharedAuthVerifyStatus",
    "sharedAuthMaskedEmail", "sharedChangeAuthEmail", "sharedParentAvatarPreview",
    "sharedAccountIdentity", "sharedParentProfileForm", "sharedParentAvatarInput",
    "sharedRemoveParentAvatar", "sharedParentName", "sharedParentNickname",
    "sharedSaveParentProfile", "sharedParentProfileStatus", "sharedAccountAddChild",
    "sharedAccountChildList", "sharedAccountFamilyStatus", "sharedAccountChildEditor",
    "sharedChildSetupTitle", "sharedChildSetupDescription", "sharedChildForm",
    "sharedChildAvatarPreview", "sharedChildAvatarInput", "sharedRemoveChildAvatar",
    "sharedChildName", "sharedChildNickname", "sharedChildGradeGroup", "sharedChildSchool",
    "sharedChildFormSubmit", "sharedCancelChildEdit", "sharedChildFormStatus",
    "sharedAccountPlanPanel", "sharedAccountPlanName", "sharedAccountSubscriptionState",
    "sharedAccountPlanDescription", "sharedAccountSubscriptionDetail", "sharedAccountChildUsage",
    "sharedAccountPlanStatus", "sharedAccountSupport", "sharedAccountSupportEmail",
    "sharedAccountSignOut",
  ];
  const refs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function profileDisplayName(profile, fallback = "家庭帳號") {
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
    refs.sharedCancelChildEdit.disabled = true;
    setFormStatus(refs.sharedChildFormStatus, "正在保留稍後設定…");
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
      await loadAccount(null);
      setFormStatus(refs.sharedAccountFamilyStatus, "已保留稍後設定；需要時可從孩子設定新增資料。", "success");
    } catch (error) {
      setFormStatus(
        refs.sharedChildFormStatus,
        error instanceof Error ? error.message : "目前無法保留稍後設定，請稍後再試。",
        "error",
      );
    } finally {
      refs.sharedCancelChildEdit.disabled = false;
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
      if (displayName) LunchI18n.keep(container);
    }
  }

  function renderHeaderAccount() {
    const authenticated = state.account.authenticated === true;
    const pending = state.account.loading === true;
    const unresolved = pending || Boolean(state.account.error);
    const displayName = profileDisplayName(state.account.user);
    for (const trigger of accountPanelTriggers) {
      trigger.classList.toggle("is-authenticated", authenticated);
      trigger.disabled = pending;
      trigger.setAttribute("aria-busy", String(pending));
      const label = trigger.querySelector("[data-account-label]");
      const status = trigger.querySelector("[data-account-status]");
      const avatar = trigger.querySelector("[data-account-avatar]");
      if (authenticated) {
        if (label) label.textContent = displayName;
        if (label) LunchI18n.keep(label);
        if (status) {
          status.textContent = "";
          status.hidden = true;
        }
        if (avatar) renderProfileAvatar(avatar, state.account.user);
        trigger.setAttribute("aria-label", `帳號：${displayName}，已登入`);
        trigger.title = `開啟${displayName}的帳號設定`;
      } else {
        const signedOutLabel = label?.dataset.signedOutLabel || "帳號";
        if (label) label.textContent = signedOutLabel;
        if (status) {
          status.textContent = unresolved ? "" : "未登入";
          status.hidden = unresolved;
        }
        if (avatar) renderProfileAvatar(avatar, null);
        trigger.setAttribute("aria-label", unresolved ? signedOutLabel : `${signedOutLabel}，未登入`);
        trigger.title = unresolved ? "家庭帳號" : "登入或建立免費家庭帳號";
      }
    }
  }

  function responsePayload(response) {
    return response.json().catch(() => ({}));
  }

  function setFormStatus(element, message = "", status = "") {
    element.textContent = message;
    element.classList.toggle("is-error", status === "error");
    element.classList.toggle("is-success", status === "success");
  }

  function schoolById(schoolId) {
    return state.schools.find((school) => Number(school.fatraceSchoolId) === Number(schoolId)) || null;
  }

  function renderChildSchools(preferredSchoolId) {
    refs.sharedChildSchool.replaceChildren();
    const placeholder = node("option", "", state.schools.length ? "請選擇孩子就讀的國小" : "正在讀取學校名冊…");
    placeholder.value = "";
    refs.sharedChildSchool.append(placeholder);
    const groups = new Map();
    for (const school of state.schools) {
      const label = `${school.city} · ${school.district}`;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(school);
    }
    for (const [label, schools] of groups) {
      const group = document.createElement("optgroup");
      group.label = label;
      for (const school of schools) {
        const option = LunchI18n.keep(node("option", "", school.name));
        option.value = String(school.fatraceSchoolId);
        group.append(option);
      }
      refs.sharedChildSchool.append(group);
    }
    refs.sharedChildSchool.disabled = !state.schools.length;
    refs.sharedChildSchool.value = schoolById(preferredSchoolId) ? String(preferredSchoolId) : "";
  }

  function setChildAllergenSelection(codes) {
    const selected = new Set(Array.isArray(codes) ? codes : []);
    refs.sharedChildForm.querySelectorAll('input[name="sharedChildAllergen"]').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function selectedChildAllergenCodes() {
    return [...refs.sharedChildForm.querySelectorAll('input[name="sharedChildAllergen"]:checked')]
      .map((input) => input.value);
  }

  function renderChildren() {
    const children = Array.isArray(state.account.children) ? state.account.children : [];
    refs.sharedAccountChildList.replaceChildren();
    refs.sharedAccountAddChild.disabled = !state.account.canAddChild;
    refs.sharedAccountAddChild.textContent = state.account.canAddChild ? "新增孩子" : "名額已滿";
    if (!children.length) {
      refs.sharedAccountChildList.append(node("p", "account-child-empty", "還沒有孩子資料，可以先建立第一位孩子。"));
      return;
    }
    for (const child of children) {
      const row = node("div", "account-child-row");
      const avatar = node("span", "account-child-avatar");
      renderProfileAvatar(avatar, child);
      const copy = node("div", "account-child-copy");
      const school = schoolById(child.schoolId);
      copy.append(
        LunchI18n.keep(node("strong", "", profileDisplayName(child, "孩子"))),
        node("span", "", `${school?.name || "尚未設定學校"}${child.nickname ? ` · 姓名 ${child.name}` : ""}`),
      );
      const edit = node("button", "", "修改");
      edit.type = "button";
      edit.dataset.childId = String(child.id);
      edit.addEventListener("click", () => openChildEditor(Number(child.id), edit));
      row.append(avatar, copy, edit);
      refs.sharedAccountChildList.append(row);
    }
  }

  function renderPlan() {
    const children = Array.isArray(state.account.children) ? state.account.children : [];
    const plan = state.account.planDetails || { name: "免費方案", childLimit: 1 };
    const paidPlan = state.account.plan === "family_monthly" || state.account.plan === "family_yearly";
    refs.sharedAccountPlanName.textContent = plan.name;
    refs.sharedAccountSubscriptionState.textContent = state.account.subscription?.statusLabel || "免費使用中";
    refs.sharedAccountSubscriptionDetail.textContent = state.account.subscription?.message || "目前使用免費方案。";
    refs.sharedAccountChildUsage.textContent = `${children.length} / ${plan.childLimit} 位孩子`;
    refs.sharedAccountPlanDescription.textContent = paidPlan
      ? "家庭方案最多可建立 3 位孩子，每位孩子的飲食紀錄會分開保存。"
      : "免費家庭帳號目前可建立 1 位孩子，並使用現階段開放的家庭飲食紀錄功能。";
    refs.sharedAccountPlanStatus.textContent = paidPlan
      ? "目前方案已可使用多孩子功能。"
      : state.account.billingEnabled === true && state.account.subscriptionPlansVisible === true
        ? "可選方案會在正式開放後提供申請方式。"
        : "目前開放免費體驗；其他家庭功能若有調整，將另行公告。";
  }

  function fillChildEditor() {
    const child = state.account.child;
    if (state.onboardingActive) {
      refs.sharedChildSetupTitle.textContent = "為孩子建立第一份飲食紀錄";
      refs.sharedChildSetupDescription.textContent = "先填孩子的基本資料與就讀學校，之後記午餐時，就能帶入孩子學校的菜色。";
      refs.sharedChildFormSubmit.textContent = "建立孩子資料";
      refs.sharedCancelChildEdit.textContent = "稍後再設定";
      refs.sharedCancelChildEdit.hidden = false;
      renderProfileAvatar(refs.sharedChildAvatarPreview, null, state.childAvatarPreviewUrl);
      refs.sharedRemoveChildAvatar.hidden = true;
      renderChildSchools(refs.sharedChildSchool.value);
      return;
    }
    if (state.creatingChild) {
      refs.sharedChildSetupTitle.textContent = child ? "新增孩子資料" : "建立第一位孩子的資料";
      refs.sharedChildSetupDescription.textContent = child
        ? `目前有 ${(state.account.children || []).length} 位，${state.account.planDetails?.name || "目前方案"}最多可建立 ${state.account.childLimit || 1} 位孩子。`
        : "姓名只用在家庭帳號內；可另外設定暱稱，畫面會優先顯示暱稱。";
      refs.sharedChildFormSubmit.textContent = child ? "新增孩子" : "建立免費飲食紀錄";
      refs.sharedCancelChildEdit.textContent = "取消";
      refs.sharedChildName.value = "";
      refs.sharedChildNickname.value = "";
      refs.sharedChildGradeGroup.value = "not_set";
      renderProfileAvatar(refs.sharedChildAvatarPreview, null, state.childAvatarPreviewUrl);
      refs.sharedRemoveChildAvatar.hidden = true;
      setChildAllergenSelection([]);
      renderChildSchools("");
      refs.sharedCancelChildEdit.hidden = !child;
      return;
    }
    const displayName = profileDisplayName(child, "孩子");
    refs.sharedChildSetupTitle.textContent = `編輯${displayName}的設定`;
    refs.sharedChildSetupDescription.textContent = "就讀學校只會在這裡變更；公開選校只是查看其他學校的午餐。";
    refs.sharedChildFormSubmit.textContent = "儲存孩子資料";
    refs.sharedCancelChildEdit.textContent = "取消";
    refs.sharedChildName.value = child.name || displayName;
    refs.sharedChildNickname.value = child.nickname || "";
    refs.sharedChildGradeGroup.value = child.gradeGroup || "not_set";
    renderProfileAvatar(refs.sharedChildAvatarPreview, child, state.childAvatarPreviewUrl);
    refs.sharedRemoveChildAvatar.hidden = !child.avatarUrl;
    setChildAllergenSelection(child.allergenCodes);
    renderChildSchools(child.schoolId);
    refs.sharedCancelChildEdit.hidden = false;
  }

  function renderAccount() {
    const authenticated = state.account.authenticated === true;
    const onboardingActive = authenticated && state.onboardingActive;
    renderHeaderAccount();
    refs.sharedAccountSignedOutView.hidden = authenticated;
    refs.sharedAccountSignedInView.hidden = !authenticated;
    refs.sharedAccountSignedInView.classList.toggle("is-onboarding", onboardingActive);
    if (!authenticated) {
      renderEmailAuthStep();
      return;
    }
    refs.sharedAccountIdentity.textContent = state.account.user?.email
      ? `${profileDisplayName(state.account.user, "家長")} · ${state.account.user.email}`
      : `${profileDisplayName(state.account.user, "家長")} · 免費會員`;
    if (!refs.sharedParentProfileForm.contains(document.activeElement)) {
      refs.sharedParentName.value = state.account.user?.name || state.account.user?.displayName || "家長";
      refs.sharedParentNickname.value = state.account.user?.nickname || "";
    }
    renderProfileAvatar(refs.sharedParentAvatarPreview, state.account.user, state.parentAvatarPreviewUrl);
    refs.sharedRemoveParentAvatar.hidden = !state.account.user?.avatarUrl;
    renderChildren();
    renderPlan();
    const showEditor = onboardingActive || state.creatingChild || state.editingChild;
    refs.sharedAccountChildEditor.hidden = !showEditor;
    if (showEditor) fillChildEditor();
    const supportEmail = typeof state.account.supportEmail === "string" ? state.account.supportEmail.trim() : "";
    refs.sharedAccountSupport.hidden = !supportEmail;
    refs.sharedAccountSupportEmail.textContent = supportEmail;
    if (supportEmail) {
      refs.sharedAccountSupportEmail.href = `mailto:${supportEmail}?subject=${encodeURIComponent("好好吃飯使用問題")}`;
    } else {
      refs.sharedAccountSupportEmail.removeAttribute("href");
    }
  }

  function accountEndpoint(childId = state.activeChildId) {
    return Number.isInteger(childId) && childId > 0
      ? `/api/account?childId=${encodeURIComponent(childId)}`
      : "/api/account";
  }

  async function loadAccount(childId = state.activeChildId) {
    const wasOnboarding = state.onboardingActive;
    try {
      const response = await fetch(accountEndpoint(childId), { cache: "no-store", credentials: "same-origin" });
      const account = await responsePayload(response);
      if (!response.ok) throw new Error(account.error || "目前還無法顯示家庭帳號資料，請稍後再試。");
      state.account = account;
      state.onboardingActive = accountNeedsOnboarding(account);
      if (state.onboardingActive) {
        if (!wasOnboarding) {
          resetAvatarSelection("child");
          refs.sharedChildForm.reset();
          setFormStatus(refs.sharedChildFormStatus);
        }
        state.creatingChild = true;
        state.editingChild = false;
      } else if (wasOnboarding) {
        state.creatingChild = false;
        state.editingChild = false;
      }
      state.activeChildId = Number(account.child?.id) || null;
      if (state.activeChildId) window.localStorage.setItem("demeter-active-child-id", String(state.activeChildId));
    } catch (error) {
      state.account = {
        authenticated: false,
        user: null,
        children: [],
        child: null,
        supportEmail: null,
        error: error instanceof Error ? error.message : "目前還無法顯示家庭帳號資料，請稍後再試。",
      };
      state.onboardingActive = false;
    }
    renderAccount();
    if (state.onboardingActive && refs.sharedAccountDialog.open) void markOnboardingStarted();
  }

  async function loadSchools() {
    try {
      const response = await fetch("/api/schools", { cache: "force-cache" });
      const payload = await responsePayload(response);
      if (!response.ok || !Array.isArray(payload.schools)) throw new Error("無法讀取學校名冊");
      state.schools = payload.schools;
      if (state.account.authenticated) renderAccount();
    } catch {
      state.schools = [];
      if (state.account.authenticated) renderAccount();
    }
  }

  function renderEmailAuthStep() {
    const awaitingCode = Boolean(state.authChallengeId);
    refs.sharedEmailAuthForm.hidden = awaitingCode;
    refs.sharedEmailCodeStep.hidden = !awaitingCode;
  }

  async function requestEmailAuthCode() {
    if (!refs.sharedEmailAuthForm.reportValidity()) return;
    refs.sharedRequestAuthCode.disabled = true;
    setFormStatus(refs.sharedAuthRequestStatus, "正在寄送驗證碼…");
    try {
      const email = refs.sharedAuthEmail.value.trim();
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          birthDate: refs.sharedAuthBirthDate.value,
          caregiverConfirmed: refs.sharedAuthCaregiverConfirmed.checked,
        }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "目前無法寄送驗證碼，請稍後再試。");
      state.authChallengeId = payload.challengeId;
      refs.sharedAuthMaskedEmail.textContent = payload.maskedEmail || email;
      refs.sharedAuthCode.value = "";
      setFormStatus(refs.sharedAuthRequestStatus);
      setFormStatus(refs.sharedAuthVerifyStatus);
      renderEmailAuthStep();
      refs.sharedAuthCode.focus();
    } catch (error) {
      setFormStatus(refs.sharedAuthRequestStatus, error instanceof Error ? error.message : "目前無法寄送驗證碼，請稍後再試。", "error");
    } finally {
      refs.sharedRequestAuthCode.disabled = false;
    }
  }

  function resetEmailAuthForm() {
    state.authChallengeId = null;
    refs.sharedEmailAuthForm.reset();
    refs.sharedEmailCodeForm.reset();
    setFormStatus(refs.sharedAuthRequestStatus);
    setFormStatus(refs.sharedAuthVerifyStatus);
    renderEmailAuthStep();
  }

  async function verifyEmailAuthCode() {
    if (!refs.sharedEmailCodeForm.reportValidity() || !state.authChallengeId) return;
    refs.sharedVerifyAuthCode.disabled = true;
    setFormStatus(refs.sharedAuthVerifyStatus, "正在驗證…");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ challengeId: state.authChallengeId, code: refs.sharedAuthCode.value }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "目前無法確認驗證碼，請稍後再試。");
      resetEmailAuthForm();
      await loadAccount();
      if (state.onboardingActive) {
        void markOnboardingStarted();
        focusChildEditor();
      }
    } catch (error) {
      setFormStatus(refs.sharedAuthVerifyStatus, error instanceof Error ? error.message : "目前無法確認驗證碼，請稍後再試。", "error");
    } finally {
      refs.sharedVerifyAuthCode.disabled = false;
    }
  }

  function resetAvatarSelection(kind) {
    const urlKey = kind === "parent" ? "parentAvatarPreviewUrl" : "childAvatarPreviewUrl";
    const fileKey = kind === "parent" ? "parentAvatarFile" : "childAvatarFile";
    if (state[urlKey]) URL.revokeObjectURL(state[urlKey]);
    state[urlKey] = null;
    state[fileKey] = null;
    const input = kind === "parent" ? refs.sharedParentAvatarInput : refs.sharedChildAvatarInput;
    input.value = "";
  }

  function selectAvatarFile(kind, file) {
    if (!file) return;
    const supported = /^image\/(?:jpeg|png|webp|heic|heif)$/i.test(file.type) || /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
    const status = kind === "parent" ? refs.sharedParentProfileStatus : refs.sharedChildFormStatus;
    if (!supported || file.size > 10 * 1024 * 1024) {
      setFormStatus(status, "請選擇 10MB 以內的 JPG、PNG、WebP 或 HEIC 照片。", "error");
      return;
    }
    resetAvatarSelection(kind);
    const url = URL.createObjectURL(file);
    if (kind === "parent") {
      state.parentAvatarFile = file;
      state.parentAvatarPreviewUrl = url;
      renderProfileAvatar(refs.sharedParentAvatarPreview, state.account.user, url);
    } else {
      state.childAvatarFile = file;
      state.childAvatarPreviewUrl = url;
      renderProfileAvatar(refs.sharedChildAvatarPreview, state.account.child, url);
    }
  }

  async function decodeAvatarImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch {
        // Safari may need the image element fallback for HEIC photos.
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
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
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
      context.drawImage(decoded.source, (decoded.width - sourceSize) / 2, (decoded.height - sourceSize) / 2, sourceSize, sourceSize, 0, 0, size, size);
      let blob = await canvasBlob(canvas, "image/webp", 0.84);
      if (!blob) throw new Error("照片處理失敗");
      let outputType = blob.type.toLowerCase();
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
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
    const response = await fetch("/api/account/avatar", { method: "POST", credentials: "same-origin", body: form });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "大頭貼暫時無法儲存");
  }

  async function deleteAvatar(childId = null) {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const response = await fetch(`/api/account/avatar${query}`, { method: "DELETE", credentials: "same-origin" });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || "大頭貼暫時無法移除");
  }

  function focusChildEditor() {
    window.requestAnimationFrame(() => {
      if (state.onboardingActive) {
        refs.sharedChildSetupTitle.tabIndex = -1;
        refs.sharedChildSetupTitle.focus({ preventScroll: true });
        refs.sharedAccountDialog.querySelector(".account-dialog-shell")?.scrollTo({ top: 0, behavior: "auto" });
        return;
      }
      refs.sharedAccountChildEditor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      refs.sharedChildName.focus({ preventScroll: true });
    });
  }

  async function openChildEditor(childId, trigger) {
    state.creatingChild = false;
    state.editingChild = true;
    resetAvatarSelection("child");
    if (Number(childId) !== Number(state.account.child?.id)) await loadAccount(childId);
    else renderAccount();
    state.lastTrigger = state.lastTrigger || trigger;
    focusChildEditor();
  }

  function startChildCreation() {
    if (!state.account.canAddChild) {
      setFormStatus(refs.sharedAccountFamilyStatus, "目前方案的孩子名額已滿。", "error");
      return;
    }
    state.creatingChild = true;
    state.editingChild = false;
    resetAvatarSelection("child");
    refs.sharedChildForm.reset();
    setFormStatus(refs.sharedChildFormStatus);
    setFormStatus(refs.sharedAccountFamilyStatus);
    renderAccount();
    focusChildEditor();
  }

  function adultBirthDateMaximum() {
    const today = new Date();
    return `${today.getFullYear() - 18}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  function openDialog(trigger) {
    state.lastTrigger = trigger || document.activeElement;
    const dialog = refs.sharedAccountDialog;
    if (dialog.open) return;
    window.clearTimeout(state.motion.closeTimer);
    window.cancelAnimationFrame(state.motion.openFrame);
    state.motion.closePromise = null;
    dialog.classList.remove("is-visible", "is-closing");
    dialog.showModal();
    refs.sharedCloseAccountDialog.focus({ preventScroll: true });
    dialog.getBoundingClientRect();
    state.motion.openFrame = window.requestAnimationFrame(() => {
      state.motion.openFrame = 0;
      if (dialog.open) dialog.classList.add("is-visible");
    });
    dialog.querySelector(".account-dialog-shell")?.scrollTo({ top: 0 });
    if (state.onboardingActive) void markOnboardingStarted();
  }

  function closeDialog({ immediate = false } = {}) {
    const dialog = refs.sharedAccountDialog;
    if (!dialog.open) return Promise.resolve();
    if (dialog.classList.contains("is-closing")) return state.motion.closePromise || Promise.resolve();
    window.cancelAnimationFrame(state.motion.openFrame);
    window.clearTimeout(state.motion.closeTimer);
    state.motion.closePromise = new Promise((resolve) => {
      const finish = () => {
        window.clearTimeout(state.motion.closeTimer);
        dialog.removeEventListener("transitionend", handleTransitionEnd);
        dialog.classList.remove("is-visible", "is-closing");
        if (dialog.open) dialog.close();
        state.motion.closePromise = null;
        resolve();
      };
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const handleTransitionEnd = (event) => {
        if (event.target === dialog && event.propertyName === (reducedMotion ? "opacity" : "transform")) finish();
      };
      if (immediate) return finish();
      dialog.classList.add("is-closing");
      dialog.classList.remove("is-visible");
      dialog.addEventListener("transitionend", handleTransitionEnd);
      state.motion.closeTimer = window.setTimeout(finish, (reducedMotion ? 160 : 360) + 80);
    });
    return state.motion.closePromise;
  }

  refs.sharedCloseAccountDialog.addEventListener("click", () => closeDialog());
  refs.sharedAccountDialog.addEventListener("click", (event) => {
    if (event.target === refs.sharedAccountDialog) closeDialog();
  });
  refs.sharedAccountDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  refs.sharedAccountDialog.addEventListener("close", () => {
    const trigger = state.lastTrigger;
    state.lastTrigger = null;
    if (trigger?.isConnected) trigger.focus();
  });
  refs.sharedEmailAuthForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await requestEmailAuthCode();
  });
  refs.sharedEmailCodeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await verifyEmailAuthCode();
  });
  refs.sharedAuthCode.addEventListener("input", () => {
    refs.sharedAuthCode.value = refs.sharedAuthCode.value.replace(/\D/g, "").slice(0, 6);
  });
  refs.sharedChangeAuthEmail.addEventListener("click", () => {
    state.authChallengeId = null;
    refs.sharedEmailCodeForm.reset();
    setFormStatus(refs.sharedAuthVerifyStatus);
    renderEmailAuthStep();
    refs.sharedAuthEmail.focus();
  });
  refs.sharedParentAvatarInput.addEventListener("change", () => selectAvatarFile("parent", refs.sharedParentAvatarInput.files?.[0]));
  refs.sharedChildAvatarInput.addEventListener("change", () => selectAvatarFile("child", refs.sharedChildAvatarInput.files?.[0]));
  refs.sharedParentProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    refs.sharedSaveParentProfile.disabled = true;
    setFormStatus(refs.sharedParentProfileStatus, "正在儲存個人設定…");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: refs.sharedParentName.value, nickname: refs.sharedParentNickname.value }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "目前無法儲存家長資料，請稍後再試。");
      if (state.parentAvatarFile) await uploadAvatar("parent", null, state.parentAvatarFile);
      resetAvatarSelection("parent");
      await loadAccount();
      setFormStatus(refs.sharedParentProfileStatus, "個人設定已更新。", "success");
    } catch (error) {
      setFormStatus(refs.sharedParentProfileStatus, error instanceof Error ? error.message : "目前無法儲存家長資料，請稍後再試。", "error");
    } finally {
      refs.sharedSaveParentProfile.disabled = false;
    }
  });
  refs.sharedRemoveParentAvatar.addEventListener("click", async () => {
    refs.sharedRemoveParentAvatar.disabled = true;
    setFormStatus(refs.sharedParentProfileStatus, "正在移除大頭貼…");
    try {
      await deleteAvatar();
      resetAvatarSelection("parent");
      await loadAccount();
      setFormStatus(refs.sharedParentProfileStatus, "大頭貼已移除。", "success");
    } catch (error) {
      setFormStatus(refs.sharedParentProfileStatus, error instanceof Error ? error.message : "大頭貼暫時無法移除", "error");
    } finally {
      refs.sharedRemoveParentAvatar.disabled = false;
    }
  });
  refs.sharedAccountSignOut.addEventListener("click", async () => {
    refs.sharedAccountSignOut.disabled = true;
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "暫時無法登出");
      resetEmailAuthForm();
      state.creatingChild = false;
      state.editingChild = false;
      await loadAccount(null);
      refs.sharedAuthEmail.focus();
    } catch (error) {
      refs.sharedAccountIdentity.textContent = error instanceof Error ? error.message : "暫時無法登出";
    } finally {
      refs.sharedAccountSignOut.disabled = false;
    }
  });
  refs.sharedAccountAddChild.addEventListener("click", startChildCreation);
  refs.sharedCancelChildEdit.addEventListener("click", async () => {
    if (state.onboardingActive) {
      await skipOnboarding();
      return;
    }
    state.creatingChild = false;
    state.editingChild = false;
    resetAvatarSelection("child");
    setFormStatus(refs.sharedChildFormStatus);
    renderAccount();
    refs.sharedAccountAddChild.focus();
  });
  refs.sharedRemoveChildAvatar.addEventListener("click", async () => {
    const childId = Number(state.account.child?.id);
    if (!childId) return;
    refs.sharedRemoveChildAvatar.disabled = true;
    setFormStatus(refs.sharedChildFormStatus, "正在移除大頭貼…");
    try {
      await deleteAvatar(childId);
      resetAvatarSelection("child");
      await loadAccount(childId);
      state.editingChild = true;
      renderAccount();
      setFormStatus(refs.sharedChildFormStatus, "大頭貼已移除。", "success");
    } catch (error) {
      setFormStatus(refs.sharedChildFormStatus, error instanceof Error ? error.message : "大頭貼暫時無法移除", "error");
    } finally {
      refs.sharedRemoveChildAvatar.disabled = false;
    }
  });
  refs.sharedChildForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    refs.sharedChildFormSubmit.disabled = true;
    setFormStatus(refs.sharedChildFormStatus, "正在儲存孩子資料…");
    try {
      const wasEditing = state.editingChild;
      const wasOnboarding = state.onboardingActive;
      const response = await fetch("/api/account/child", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: wasEditing ? state.account.child?.id : null,
          name: refs.sharedChildName.value,
          nickname: refs.sharedChildNickname.value,
          gradeGroup: refs.sharedChildGradeGroup.value,
          schoolId: refs.sharedChildSchool.value,
          allergenCodes: selectedChildAllergenCodes(),
          onboarding: wasOnboarding,
        }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(payload.error || "目前無法儲存孩子資料，請稍後再試。");
      if (payload.onboardingCompleted === true) trackOnboardingEvent("onboarding_completed");
      const childId = Number(payload.childId || state.account.child?.id);
      if (state.childAvatarFile && childId) await uploadAvatar("child", childId, state.childAvatarFile);
      resetAvatarSelection("child");
      state.creatingChild = false;
      state.editingChild = false;
      state.activeChildId = childId || state.activeChildId;
      await loadAccount(state.activeChildId);
      setFormStatus(
        refs.sharedAccountFamilyStatus,
        wasEditing
          ? "孩子設定已更新。"
          : wasOnboarding
            ? "第一位孩子資料已建立；現在可以開始記錄孩子的飲食。"
            : "已建立孩子資料。",
        "success",
      );
    } catch (error) {
      setFormStatus(refs.sharedChildFormStatus, error instanceof Error ? error.message : "目前無法儲存孩子資料，請稍後再試。", "error");
    } finally {
      refs.sharedChildFormSubmit.disabled = false;
    }
  });

  for (const trigger of accountPanelTriggers) {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openDialog(trigger);
    });
  }

  refs.sharedAuthBirthDate.max = adultBirthDateMaximum();
  renderHeaderAccount();
  Promise.allSettled([loadSchools(), loadAccount()]).then(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("account") === "1") {
      url.searchParams.delete("account");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      openDialog(accountPanelTriggers[0]);
    }
    if (state.onboardingActive) {
      if (!refs.sharedAccountDialog.open) openDialog(accountPanelTriggers[0]);
      focusChildEditor();
    }
  });
}
