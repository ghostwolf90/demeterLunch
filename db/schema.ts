import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const officialMealRecords = sqliteTable(
  "official_meal_records",
  {
    schoolId: integer("school_id").notNull(),
    mealDate: text("meal_date").notNull(),
    status: text("status").notNull(),
    contentHash: text("content_hash").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    reviewedAt: text("reviewed_at").notNull(),
    sourceUrl: text("source_url").notNull(),
    r2Key: text("r2_key").notNull(),
    recordJson: text("record_json").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.schoolId, table.mealDate] }),
    index("official_meal_records_date_idx").on(table.mealDate),
  ],
);

export const refreshJobs = sqliteTable(
  "refresh_jobs",
  {
    jobKey: text("job_key").primaryKey(),
    kind: text("kind").notNull(),
    mealDate: text("meal_date").notNull(),
    groupId: integer("group_id"),
    cursor: integer("cursor").notNull().default(0),
    total: integer("total").notNull(),
    status: text("status").notNull(),
    schoolIdsJson: text("school_ids_json"),
    availableCount: integer("available_count").notNull().default(0),
    noMealCount: integer("no_meal_count").notNull().default(0),
    notPublishedCount: integer("not_published_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (table) => [index("refresh_jobs_date_idx").on(table.mealDate)],
);

export const refreshAttempts = sqliteTable(
  "refresh_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobKey: text("job_key").notNull(),
    mealDate: text("meal_date").notNull(),
    schoolId: integer("school_id").notNull(),
    status: text("status").notNull(),
    saveStatus: text("save_status").notNull(),
    error: text("error"),
    checkedAt: text("checked_at").notNull(),
  },
  (table) => [
    index("refresh_attempts_job_idx").on(table.jobKey, table.id),
    index("refresh_attempts_retry_idx").on(table.mealDate, table.schoolId, table.id),
  ],
);

export const refreshLocks = sqliteTable("refresh_locks", {
  lockName: text("lock_name").primaryKey(),
  ownerToken: text("owner_token"),
  leaseUntil: text("lease_until"),
  updatedAt: text("updated_at").notNull(),
});

export const telegramNotifications = sqliteTable(
  "telegram_notifications",
  {
    eventKey: text("event_key").primaryKey(),
    jobKey: text("job_key"),
    mealDate: text("meal_date").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    message: text("message").notNull(),
    attempts: integer("attempts").notNull().default(0),
    telegramMessageId: integer("telegram_message_id"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    sentAt: text("sent_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("telegram_notifications_date_idx").on(table.mealDate, table.eventType),
    index("telegram_notifications_job_idx").on(table.jobKey),
  ],
);

export const parentAccounts = sqliteTable("parent_accounts", {
  authUserId: text("auth_user_id").primaryKey(),
  email: text("email"),
  emailNormalized: text("email_normalized"),
  displayName: text("display_name"),
  plan: text("plan").notNull().default("free"),
  adultVerifiedAt: text("adult_verified_at"),
  caregiverConfirmedAt: text("caregiver_confirmed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("parent_accounts_email_normalized_idx").on(table.emailNormalized),
]);

export const emailAuthChallenges = sqliteTable(
  "email_auth_challenges",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeDigest: text("code_digest").notNull(),
    requestKey: text("request_key"),
    attempts: integer("attempts").notNull().default(0),
    eligibilityConfirmedAt: text("eligibility_confirmed_at").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (table) => [
    index("email_auth_challenges_email_idx").on(table.email, table.createdAt),
    index("email_auth_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const accountSessions = sqliteTable(
  "account_sessions",
  {
    tokenDigest: text("token_digest").primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => parentAccounts.authUserId, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("account_sessions_owner_idx").on(table.authUserId, table.expiresAt),
    index("account_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const childProfiles = sqliteTable(
  "child_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => parentAccounts.authUserId, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    gradeGroup: text("grade_group").notNull(),
    schoolId: integer("school_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("child_profiles_owner_idx").on(table.authUserId)],
);

export const foodEncounters = sqliteTable(
  "food_encounters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => parentAccounts.authUserId, { onDelete: "cascade" }),
    mealDate: text("meal_date").notNull(),
    schoolId: integer("school_id"),
    mealType: text("meal_type").notNull().default("meat"),
    mealContext: text("meal_context").notNull().default("unknown"),
    dishName: text("dish_name"),
    foodName: text("food_name").notNull(),
    experience: text("experience").notNull(),
    reactions: text("reactions"),
    childQuote: text("child_quote"),
    firstEncounter: integer("first_encounter", { mode: "boolean" }),
    preparation: text("preparation"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("food_encounters_owner_idx").on(table.authUserId, table.createdAt),
    index("food_encounters_child_idx").on(table.childId, table.createdAt),
  ],
);
