import {
  accountDatabase,
  getAccountUser,
  privateJson,
} from "@/lib/account-auth";
import {
  accountPlanDetails,
  BILLING_ENABLED,
  SUBSCRIPTION_PLANS_VISIBLE,
} from "@/lib/account-plan";
import {
  accountSubscriptionDetails,
  preferredProfileName,
} from "@/lib/account-profile";
import { lineConfiguration } from "@/lib/line-auth";
import { parseStoredAllergenCodes } from "@/lib/allergens";

type ChildRow = {
  id: number;
  name: string | null;
  nickname: string;
  avatar_key: string | null;
  grade_group: string;
  school_id: number | null;
  allergen_codes: string;
  created_at: string;
  updated_at: string;
};

type AccountPreferenceRow = {
  default_school_id: number | null;
  plan: string;
  display_name: string | null;
  nickname: string | null;
  avatar_key: string | null;
  subscription_status: string;
  subscription_period_end: string | null;
  subscription_cancel_at_period_end: number;
  onboarding_status: string;
  onboarding_started_at: string | null;
  updated_at: string;
};

type EncounterRow = {
  id: number;
  meal_date: string;
  school_id: number | null;
  meal_type: string;
  meal_context: string;
  dish_name: string | null;
  food_name: string;
  experience: string;
  reactions: string | null;
  child_quote: string | null;
  first_encounter: number | null;
  preparation: string | null;
  note: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAccountUser(request);
  if (!user) {
    return privateJson({
      authenticated: false,
      lineLoginEnabled: Boolean(lineConfiguration(request)),
      user: null,
      children: [],
      child: null,
      defaultSchoolId: null,
      encounters: [],
    });
  }

  try {
    const db = accountDatabase();
    const requestedChildId = childIdFromUrl(request.url);
    const [accountPreferences, childrenResult] = await Promise.all([
      db
        .prepare(
          `SELECT default_school_id, plan, display_name, nickname, avatar_key,
                  subscription_status, subscription_period_end,
                  subscription_cancel_at_period_end, onboarding_status,
                  onboarding_started_at, updated_at
           FROM parent_accounts
           WHERE auth_user_id = ?
           LIMIT 1`,
        )
        .bind(user.id)
        .first<AccountPreferenceRow>(),
      db
        .prepare(
          `SELECT id, name, nickname, avatar_key, grade_group, school_id,
                  allergen_codes, created_at, updated_at
           FROM child_profiles
           WHERE auth_user_id = ?
           ORDER BY id`,
        )
        .bind(user.id)
        .all<ChildRow>(),
    ]);
    const children = childrenResult.results;
    const child = children.find((item) => item.id === requestedChildId) ?? children[0] ?? null;
    const plan = accountPlanDetails(accountPreferences?.plan);
    const parentName = accountPreferences?.display_name?.trim() || user.displayName;
    const parentNickname = accountPreferences?.nickname?.trim() || null;
    const subscription = accountSubscriptionDetails(
      accountPreferences?.plan,
      accountPreferences?.subscription_status,
      accountPreferences?.subscription_period_end,
      accountPreferences?.subscription_cancel_at_period_end === 1,
    );
    const onboardingStatus = normalizeOnboardingStatus(accountPreferences?.onboarding_status);
    const [encounters, encounterCount] = child
      ? await Promise.all([
          db
            .prepare(
              `SELECT id, meal_date, school_id, meal_type, meal_context, dish_name, food_name, experience,
                      reactions, child_quote, first_encounter, preparation, note, created_at
               FROM food_encounters
               WHERE auth_user_id = ? AND child_id = ?
               ORDER BY meal_date DESC, created_at DESC, id DESC
               LIMIT 5`,
            )
            .bind(user.id, child.id)
            .all<EncounterRow>(),
          db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM food_encounters
               WHERE auth_user_id = ? AND child_id = ?`,
            )
            .bind(user.id, child.id)
            .first<{ count: number }>(),
        ])
      : [{ results: [] as EncounterRow[] }, { count: 0 }];

    const lineIdentity = await db.prepare("SELECT subject FROM account_identities WHERE provider = 'line' AND auth_user_id = ?").bind(user.id).first();
    return privateJson({
      lineLoginEnabled: Boolean(lineConfiguration(request)),
      lineLinked: Boolean(lineIdentity),
      authenticated: true,
      user: {
        ...user,
        name: parentName,
        nickname: parentNickname,
        displayName: preferredProfileName(parentName, parentNickname, "家長"),
        avatarUrl: accountPreferences?.avatar_key
          ? avatarUrl("parent", accountPreferences.updated_at)
          : null,
      },
      plan: plan.id,
      planDetails: plan,
      subscription,
      billingEnabled: BILLING_ENABLED,
      subscriptionPlansVisible: SUBSCRIPTION_PLANS_VISIBLE,
      onboarding: {
        status: onboardingStatus,
        required: onboardingStatus === "pending" && children.length === 0,
      },
      childLimit: plan.childLimit,
      canAddChild: children.length < plan.childLimit,
      supportEmail: "support@haohaofood.cc",
      defaultSchoolId: accountPreferences?.default_school_id ?? null,
      children: children.map(publicChild),
      child: child ? publicChild(child) : null,
      encounters: encounters.results.map((item) => ({
        id: item.id,
        mealDate: item.meal_date,
        schoolId: item.school_id,
        mealType: item.meal_type === "vegetarian" ? "vegetarian" : "meat",
        mealContext: item.meal_context === "school_lunch" || item.meal_context === "other"
          ? item.meal_context
          : "unknown",
        dishName: item.dish_name,
        foodName: item.food_name,
        experience: item.experience,
        reactions: parseReactions(item.reactions),
        childQuote: item.child_quote,
        firstEncounter: item.first_encounter === null ? null : item.first_encounter === 1,
        preparation: item.preparation,
        note: item.note,
        createdAt: item.created_at,
      })),
      encounterCount: encounterCount?.count ?? 0,
    });
  } catch (error) {
    console.error("Unable to load private account data", error);
    return privateJson(
      {
        error: "目前還無法顯示家庭帳號資料，請稍後再試。",
        code: "ACCOUNT_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}

function normalizeOnboardingStatus(value: string | null | undefined) {
  return value === "pending" || value === "skipped" || value === "completed"
    ? value
    : "completed";
}

function childIdFromUrl(value: string): number | null {
  const childId = Number(new URL(value).searchParams.get("childId"));
  return Number.isInteger(childId) && childId > 0 ? childId : null;
}

function publicChild(child: ChildRow) {
  const legacyProfile = !child.name?.trim();
  const name = child.name?.trim() || child.nickname.trim() || "孩子";
  const nickname = legacyProfile ? null : child.nickname.trim() || null;
  return {
    id: child.id,
    name,
    nickname,
    displayName: preferredProfileName(name, nickname, "孩子"),
    avatarUrl: child.avatar_key ? avatarUrl("child", child.updated_at, child.id) : null,
    gradeGroup: child.grade_group,
    schoolId: child.school_id,
    allergenCodes: parseStoredAllergenCodes(child.allergen_codes),
    createdAt: child.created_at,
    updatedAt: child.updated_at,
  };
}

function avatarUrl(scope: "parent" | "child", updatedAt: string, childId?: number) {
  const query = new URLSearchParams({ scope, v: updatedAt });
  if (childId) query.set("childId", String(childId));
  return `/api/account/avatar?${query}`;
}

function parseReactions(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
