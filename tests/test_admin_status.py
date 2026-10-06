import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from src.admin_status import load_admin_status


class AdminStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.automation_root = self.root / "automations"
        self._write_complete_fixture()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_complete_fixture(self) -> None:
        month_root = self.root / "data" / "raw" / "fatrace-openapi" / "2026-09"
        month_root.mkdir(parents=True)
        (month_root / "trace.csv").write_bytes(b"csv")
        (month_root / "manifest.json").write_text(
            json.dumps(
                {
                    "sourceMonth": "2026-09",
                    "datasets": [
                        {
                            "datasetName": "午餐菜色及食材資料集",
                            "county": "臺中市",
                            "grade": "國中小",
                            "createdAt": "2026/10/06",
                            "file": "trace.csv",
                            "bytes": 3,
                            "sha256": "example",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

        parsed_root = self.root / "data" / "parsed" / "traceability"
        parsed_root.mkdir(parents=True)
        (parsed_root / "traceability-2026-09.json").write_text(
            json.dumps(
                {
                    "source": {
                        "sourceMonth": "2026-09",
                        "exportedAt": "2026-10-06T11:12:17+08:00",
                    },
                    "days": [
                        {
                            "date": "2026-09-01",
                            "dishes": [
                                {"ingredients": [{"name": "米"}, {"name": "菜"}]}
                            ],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

        database = self.root / "data" / "lunch.db"
        with sqlite3.connect(database) as connection:
            connection.execute("CREATE TABLE dish_ingredients (menu_date TEXT)")
            connection.executemany(
                "INSERT INTO dish_ingredients VALUES (?)",
                [("2026-09-01",), ("2026-09-01",)],
            )
            connection.execute("CREATE TABLE traceability_sources (id TEXT)")
            connection.execute("INSERT INTO traceability_sources VALUES ('source')")

        static_root = self.root / "dist" / "data"
        static_root.mkdir(parents=True)
        (static_root / "site-data.json").write_text(
            json.dumps(
                {
                    "generatedAt": "2026-10-06T03:22:20+00:00",
                    "variants": {"meat": {"days": [{"date": "2026-09-01"}]}},
                }
            ),
            encoding="utf-8",
        )

        monitor_root = self.root / "data" / "monitor"
        monitor_root.mkdir(parents=True)
        (monitor_root / "site-deployment.json").write_text(
            json.dumps(
                {
                    "status": "succeeded",
                    "sourceMonth": "2026-09",
                    "versionNumber": 29,
                    "deployedAt": "2026-10-06T12:00:00+08:00",
                    "url": "https://example.com",
                }
            ),
            encoding="utf-8",
        )

        secret_root = self.root / ".secrets"
        secret_root.mkdir()
        secret = secret_root / "fatrace_access_code"
        secret.write_text("secret", encoding="utf-8")
        os.chmod(secret, 0o600)

        schedule_root = self.automation_root / "monthly"
        schedule_root.mkdir(parents=True)
        (schedule_root / "automation.toml").write_text(
            '\n'.join(
                [
                    'name = "每月校園食材資料更新"',
                    'status = "ACTIVE"',
                    'rrule = "RRULE:FREQ=MONTHLY;BYMONTHDAY=6;BYHOUR=18;BYMINUTE=0"',
                    "updated_at = 1791256925580",
                ]
            ),
            encoding="utf-8",
        )

    def test_reports_a_complete_month_as_healthy(self) -> None:
        status = load_admin_status(
            self.root, automation_root=self.automation_root
        )

        self.assertEqual(status["status"], "healthy")
        self.assertEqual(status["warnings"], [])
        self.assertEqual(status["schedule"]["summary"], "每月 6 日 18:00")
        self.assertEqual(status["latestImport"]["datasetCount"], 1)
        self.assertEqual(status["traceability"]["ingredients"], 2)
        self.assertEqual(status["database"]["traceabilityIngredients"], 2)
        self.assertEqual(status["staticSite"]["menuDays"], 1)
        self.assertEqual(status["siteDeployment"]["versionNumber"], 29)
        self.assertNotIn("value", status["accessCode"])

    def test_missing_csv_is_reported_without_reading_the_secret(self) -> None:
        target = (
            self.root
            / "data"
            / "raw"
            / "fatrace-openapi"
            / "2026-09"
            / "trace.csv"
        )
        target.unlink()

        status = load_admin_status(
            self.root, automation_root=self.automation_root
        )

        self.assertEqual(status["status"], "attention")
        self.assertEqual(status["latestImport"]["missingFiles"], ["trace.csv"])
        self.assertTrue(
            any("下載檔案遺失" in warning for warning in status["warnings"])
        )


if __name__ == "__main__":
    unittest.main()
