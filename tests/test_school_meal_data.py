from __future__ import annotations

import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from src.dashboard import load_site_dashboard
from src.school_dashboard import load_school_meal_catalog, load_school_meal_dashboard
from src.school_meal_data import (
    SchoolMealValidationError,
    load_reviewed_school_meals,
    promote_candidate,
    save_reviewed_record,
    validate_reviewed_school_meal,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PARSED_ROOT = PROJECT_ROOT / "data" / "parsed"
DATABASE = PROJECT_ROOT / "data" / "lunch.db"
RAW_CANDIDATE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fatrace-daily"
    / "2026-10-08"
    / "193609"
    / "candidate.json"
)
ACTIVE_REGISTRY = (
    PROJECT_ROOT
    / "data"
    / "reference"
    / "taichung-active-elementary-schools.json"
)


class ReviewedSchoolMealTests(unittest.TestCase):
    def test_active_school_records_are_reviewed_and_source_exact(self) -> None:
        records = load_reviewed_school_meals(PARSED_ROOT)
        registry = json.loads(ACTIVE_REGISTRY.read_text(encoding="utf-8"))
        expected_ids = {
            row["fatraceSchoolId"] for row in registry["schools"]
        }
        records_by_date = {
            meal_date: [record for record in records if record["mealDate"] == meal_date]
            for meal_date in {record["mealDate"] for record in records}
        }

        self.assertEqual(len(records_by_date["2026-10-08"]), 243)
        self.assertEqual(
            {
                record["school"]["fatraceSchoolId"]
                for record in records_by_date["2026-10-08"]
            },
            expected_ids,
        )
        for meal_date, daily_records in records_by_date.items():
            actual_ids = {
                record["school"]["fatraceSchoolId"] for record in daily_records
            }
            self.assertTrue(actual_ids.issubset(expected_ids))
            report_path = (
                PROJECT_ROOT
                / "data"
                / "raw"
                / "fatrace-daily"
                / meal_date
                / "report.json"
            )
            if not report_path.is_file():
                continue
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if report.get("summary", {}).get("schools") != len(expected_ids):
                continue
            publishable_ids = {
                result["fatraceSchoolId"]
                for result in report["results"]
                if result["recordStatus"] in {"available", "no_meal"}
            }
            # A later failed fetch must not invalidate an earlier complete,
            # verified same-day candidate that the district publisher preserved.
            for record in daily_records:
                school_id = record["school"]["fatraceSchoolId"]
                if school_id in publishable_ids:
                    continue
                candidate_path = report_path.parent / str(school_id) / "candidate.json"
                if candidate_path.is_file():
                    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
                    verified = promote_candidate(
                        candidate,
                        reviewed_at=record["review"]["reviewedAt"],
                        reviewed_by="preserved-candidate-test",
                    )
                    self.assertEqual(verified["contentHash"], record["contentHash"])
                    self.assertEqual(verified["mealDate"], meal_date)
                    self.assertEqual(verified["school"]["fatraceSchoolId"], school_id)
                    publishable_ids.add(school_id)
            # A full-city fetch report can precede per-district review/publication.
            # Every reviewed school must be eligible, but other candidates may
            # legitimately still be waiting for review.
            self.assertTrue(actual_ids.issubset(publishable_ids))
        for record in records:
            school_id = record["school"]["fatraceSchoolId"]
            meal_date = record["mealDate"]
            self.assertEqual(record["review"]["status"], "reviewed")
            self.assertEqual(
                record["source"]["url"],
                "https://fatraceschool.k12ea.gov.tw/frontend/search.html"
                f"?school={school_id}&period={meal_date}",
            )

    def test_promote_candidate_is_idempotent_and_rejects_tampering(self) -> None:
        candidate = json.loads(RAW_CANDIDATE.read_text(encoding="utf-8"))
        reviewed = promote_candidate(
            candidate,
            reviewed_at="2026-10-08T23:00:00+08:00",
            reviewed_by="test",
        )
        self.assertEqual(candidate["review"]["status"], "pending")
        self.assertEqual(reviewed["review"]["status"], "reviewed")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, path = save_reviewed_record(root, reviewed)
            second, second_path = save_reviewed_record(root, reviewed)
            self.assertEqual(first, "created")
            self.assertEqual(second, "unchanged")
            self.assertEqual(path, second_path)

        tampered = copy.deepcopy(reviewed)
        tampered["services"][0]["meals"][0]["dishes"][0]["name"] = "被修改的菜名"
        with self.assertRaises(SchoolMealValidationError):
            validate_reviewed_school_meal(tampered, Path("tampered.json"))

    def test_sqlite_contains_normalized_school_meal_records(self) -> None:
        records = load_reviewed_school_meals(PARSED_ROOT)
        expected_counts = {
            "official_meal_days": len(records),
            "official_meals": sum(
                len(service["meals"])
                for record in records
                for service in record["services"]
            ),
            "official_dishes": sum(
                len(meal["dishes"])
                for record in records
                for service in record["services"]
                for meal in service["meals"]
            ),
            "official_ingredients": sum(
                len(dish["ingredients"])
                for record in records
                for service in record["services"]
                for meal in service["meals"]
                for dish in meal["dishes"]
            ),
            "official_ingredient_certifications": sum(
                len(ingredient["certifications"])
                for record in records
                for service in record["services"]
                for meal in service["meals"]
                for dish in meal["dishes"]
                for ingredient in dish["ingredients"]
            ),
        }
        with sqlite3.connect(DATABASE) as connection:
            counts = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in (
                    "schools",
                    "official_meal_days",
                    "official_meals",
                    "official_dishes",
                    "official_ingredients",
                    "official_ingredient_certifications",
                )
            }

        self.assertEqual(counts["schools"], 243)
        for table, expected in expected_counts.items():
            self.assertEqual(counts[table], expected)

    def test_official_dashboard_never_falls_back_to_an_earlier_day(self) -> None:
        available = load_school_meal_dashboard(DATABASE, 193608, "2026-10-08")
        missing = load_school_meal_dashboard(DATABASE, 193608, "2026-10-09")

        self.assertEqual(available["record"]["summary"]["dishCount"], 5)
        self.assertFalse(available["isMissing"])
        self.assertTrue(missing["isMissing"])
        self.assertIsNone(missing["record"])
        self.assertIn("period=2026-10-09", missing["sourceUrl"])

    def test_official_dashboard_preserves_requested_dish_group(self) -> None:
        dashboard = load_site_dashboard(
            DATABASE,
            "2026-10-08",
            "vegetarian",
            193644,
        )

        self.assertEqual(dashboard["viewMode"], "officialDaily")
        self.assertEqual(dashboard["mealType"], "vegetarian")
        self.assertEqual(dashboard["mealTypeLabel"], "素食")
        self.assertIn("菜名的「素」字", dashboard["dataNotice"])

    def test_catalog_and_site_dashboard_keep_zhongxin_complete_mode(self) -> None:
        catalog = load_school_meal_catalog(DATABASE)
        dashboard = load_site_dashboard(DATABASE, "2026-10-08", "meat", 193609)

        self.assertEqual(catalog["defaultSchoolId"], 193609)
        self.assertEqual(len(catalog["schools"]), 243)
        self.assertEqual(catalog["schools"][0]["district"], "西區")
        self.assertEqual(dashboard["viewMode"], "detailed")
        self.assertEqual(dashboard["school"]["name"], "忠信國小")
        self.assertEqual(dashboard["officialRecord"]["summary"]["dishCount"], 8)

    def test_catalog_adds_reviewed_nanxing_weekly_menu_without_replacing_official_record(self) -> None:
        catalog = load_school_meal_catalog(DATABASE)
        school = next(
            item for item in catalog["schools"] if item["fatraceSchoolId"] == 64754668
        )
        record = catalog["records"]["64754668"]["2026-10-16"]

        self.assertEqual(school["experience"], "complete")
        self.assertEqual(record["source"]["name"], "教育部校園食材登錄平臺公開查詢頁")
        self.assertEqual(record["schoolMenu"]["week"], 7)
        self.assertEqual(
            record["schoolMenu"]["nutritionSnapshots"][0]["nutrition"]["caloriesKcal"],
            654,
        )


if __name__ == "__main__":
    unittest.main()
