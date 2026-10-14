from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import update_all_taichung_schools, update_school_meals


class UpdateSchoolMealsTests(unittest.TestCase):
    def _write_report(self, root: Path, meal_date: str) -> None:
        report = root / "data" / "raw" / "fatrace-daily" / meal_date / "report.json"
        report.parent.mkdir(parents=True)
        report.write_text(
            json.dumps(
                {
                    "summary": {
                        "schools": 243,
                        "available": 1,
                        "noMeal": 0,
                        "notPublished": 242,
                        "failed": 0,
                    }
                }
            ),
            encoding="utf-8",
        )

    def test_all_schools_omits_district_and_school_filters(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, "2026-10-12")
            with patch.object(update_school_meals, "PROJECT_ROOT", root), patch.object(
                update_school_meals, "_run", return_value=0
            ) as run:
                status = update_school_meals.main(
                    ["--date", "2026-10-12", "--all-schools", "--verify-and-build"]
                )

        self.assertEqual(status, 0)
        fetch = run.call_args_list[0].args[0]
        self.assertIn("scripts/fetch_school_meals.py", fetch)
        self.assertNotIn("--district", fetch)
        self.assertNotIn("--school", fetch)
        self.assertEqual(len(run.call_args_list), 6)

    def test_named_school_does_not_keep_implicit_west_district_filter(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, "2026-10-12")
            with patch.object(update_school_meals, "PROJECT_ROOT", root), patch.object(
                update_school_meals, "_run", return_value=0
            ) as run:
                status = update_school_meals.main(
                    ["--date", "2026-10-12", "--school", "信義國小"]
                )

        self.assertEqual(status, 0)
        fetch = run.call_args_list[0].args[0]
        self.assertEqual(fetch[fetch.index("--school") + 1], "信義國小")
        self.assertNotIn("--district", fetch)

    def test_citywide_wrapper_enables_full_build_by_default(self) -> None:
        with patch.object(
            update_all_taichung_schools,
            "update_school_meals",
            return_value=0,
        ) as update:
            status = update_all_taichung_schools.main(
                ["--date", "2026-10-12", "--skip-ingredients"]
            )

        self.assertEqual(status, 0)
        self.assertEqual(
            update.call_args.args[0],
            [
                "--all-schools",
                "--verify-and-build",
                "--date",
                "2026-10-12",
                "--skip-ingredients",
            ],
        )

    def test_citywide_wrapper_can_publish_after_success(self) -> None:
        with patch.object(
            update_all_taichung_schools,
            "update_school_meals",
            return_value=0,
        ), patch.object(
            update_all_taichung_schools,
            "publish_school_meals",
            return_value=0,
        ) as publish:
            status = update_all_taichung_schools.main(
                ["--date", "2026-10-13", "--publish"]
            )

        self.assertEqual(status, 0)
        publish.assert_called_once_with(["--date", "2026-10-13"])


if __name__ == "__main__":
    unittest.main()
