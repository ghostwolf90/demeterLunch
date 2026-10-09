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

        self.assertEqual(len(records), 243)
        self.assertEqual(
            {record["school"]["fatraceSchoolId"] for record in records},
            expected_ids,
        )
        for record in records:
            school_id = record["school"]["fatraceSchoolId"]
            self.assertEqual(record["mealDate"], "2026-10-08")
            self.assertEqual(record["review"]["status"], "reviewed")
            self.assertEqual(
                record["source"]["url"],
                "https://fatraceschool.k12ea.gov.tw/frontend/search.html"
                f"?school={school_id}&period=2026-10-08",
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
        self.assertEqual(counts["official_meal_days"], 243)
        self.assertEqual(counts["official_meals"], 306)
        self.assertEqual(counts["official_dishes"], 2033)
        self.assertEqual(counts["official_ingredients"], 5382)
        self.assertEqual(counts["official_ingredient_certifications"], 3936)

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


if __name__ == "__main__":
    unittest.main()
