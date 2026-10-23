from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class PerformancePathTests(unittest.TestCase):
    def test_dashboard_asset_and_database_reads_run_in_parallel(self) -> None:
        route = (PROJECT_ROOT / "app/api/dashboard/route.ts").read_text(encoding="utf-8")

        self.assertIn(
            "const [publishedRecords, databaseRecords] = await Promise.all([",
            route,
        )
        self.assertIn("loadPublishedRecords(request, schoolId)", route)
        self.assertIn("loadDatabaseRecords(schoolId)", route)

    def test_account_profile_and_children_reads_run_in_parallel(self) -> None:
        route = (PROJECT_ROOT / "app/api/account/route.ts").read_text(encoding="utf-8")

        self.assertIn(
            "const [accountPreferences, childrenResult] = await Promise.all([",
            route,
        )
        self.assertIn('WHERE auth_user_id = ?', route)
        self.assertIn("return privateJson({", route)

    def test_school_switch_only_allows_the_latest_request_to_render(self) -> None:
        app = (PROJECT_ROOT / "web/app.js").read_text(encoding="utf-8")

        self.assertIn("dashboardRequestId: 0", app)
        self.assertIn("dashboardAbortController: null", app)
        self.assertIn("state.dashboardAbortController?.abort();", app)
        self.assertIn("signal: controller.signal", app)
        self.assertIn("if (!isCurrentRequest()) return;", app)
        self.assertIn('return error?.name === "AbortError";', app)
        self.assertNotIn("if (state.loading) return;", app)


if __name__ == "__main__":
    unittest.main()
