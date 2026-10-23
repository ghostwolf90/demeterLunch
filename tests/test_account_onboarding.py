import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AccountOnboardingTests(unittest.TestCase):
    def read(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_legacy_accounts_default_to_completed_and_new_accounts_start_pending(self) -> None:
        schema = self.read("db/schema.ts")
        migration = self.read("drizzle/0011_late_forge.sql")
        verification = self.read("app/api/auth/verify-code/route.ts")

        self.assertIn('onboardingStatus: text("onboarding_status").notNull().default("completed")', schema)
        self.assertIn('onboardingStartedAt: text("onboarding_started_at")', schema)
        self.assertIn("DEFAULT 'completed' NOT NULL", migration)
        self.assertIn('const isNewAccount = !existing', verification)
        self.assertIn('isNewAccount ? "pending" : "completed"', verification)
        self.assertIn('{ ok: true, isNewAccount }', verification)
        conflict_update = verification.split("ON CONFLICT(auth_user_id) DO UPDATE SET", 1)[1]
        self.assertNotIn("onboarding_status =", conflict_update)

    def test_account_response_only_requires_onboarding_for_pending_accounts_without_children(self) -> None:
        route = self.read("app/api/account/route.ts")

        self.assertIn("normalizeOnboardingStatus(accountPreferences?.onboarding_status)", route)
        self.assertIn('required: onboardingStatus === "pending" && children.length === 0', route)
        self.assertIn('value === "pending" || value === "skipped" || value === "completed"', route)

    def test_start_and_skip_transitions_are_owner_scoped_and_idempotent(self) -> None:
        route = self.read("app/api/account/onboarding/route.ts")

        self.assertIn("getAccountUser(request)", route)
        self.assertIn("isSameOriginMutation(request)", route)
        self.assertIn("WHERE auth_user_id = ?", route)
        self.assertIn("AND onboarding_started_at IS NULL", route)
        self.assertIn("AND onboarding_status = 'pending'", route)
        self.assertIn("shouldTrack: result.meta.changes === 1", route)

    def test_first_child_creation_reuses_the_existing_api_and_is_retry_safe(self) -> None:
        route = self.read("app/api/account/child/route.ts")
        app = self.read("web/app.js")
        shared = self.read("web/account-panel.js")

        self.assertIn("const onboarding = record.onboarding === true", route)
        self.assertIn("AND NOT EXISTS (SELECT 1 FROM child_profiles WHERE auth_user_id = ?)", route)
        self.assertIn("const [result, onboardingResult] = await db.batch", route)
        self.assertIn("onboarding_status = 'completed'", route)
        self.assertIn("reused: true", route)
        self.assertIn('fetch("/api/account/child"', app)
        self.assertIn("onboarding: wasOnboarding", app)
        self.assertIn('fetch("/api/account/child"', shared)
        self.assertIn("onboarding: wasOnboarding", shared)

    def test_existing_child_form_carries_the_requested_copy_and_skip_action(self) -> None:
        app = self.read("web/app.js")
        shared = self.read("web/account-panel.js")
        styles = self.read("web/styles.css")

        for source in (app, shared):
            self.assertIn("為孩子建立第一份飲食紀錄", source)
            self.assertIn("先填孩子的基本資料與就讀學校，之後記午餐時，就能帶入孩子學校的菜色。", source)
            self.assertIn("建立孩子資料", source)
            self.assertIn("稍後再設定", source)
            self.assertIn('fetch("/api/account/onboarding"', source)
            self.assertIn(".focus({ preventScroll: true })", source)
            self.assertIn('.scrollTo({ top: 0, behavior: "auto" })', source)
        self.assertIn(".is-onboarding .account-child-editor", styles)
        self.assertNotIn('localStorage.setItem("onboarding', app)
        self.assertNotIn('localStorage.setItem("onboarding', shared)

    def test_ga_events_only_follow_server_confirmed_transitions_and_have_no_profile_data(self) -> None:
        for path in ("web/app.js", "web/account-panel.js"):
            source = self.read(path)
            self.assertIn('window.gtag("event", name)', source)
            self.assertIn('payload.shouldTrack === true) trackOnboardingEvent("onboarding_started")', source)
            self.assertIn('payload.shouldTrack === true) trackOnboardingEvent("onboarding_skipped")', source)
            self.assertIn('payload.onboardingCompleted === true) trackOnboardingEvent("onboarding_completed")', source)
            analytics_call = source.split('window.gtag("event", name)', 1)[0].splitlines()[-1]
            self.assertNotIn("childName", analytics_call)
            self.assertNotIn("nickname", analytics_call)
            self.assertNotIn("allergen", analytics_call)


if __name__ == "__main__":
    unittest.main()
