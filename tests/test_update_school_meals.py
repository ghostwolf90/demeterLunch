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

    def test_refresh_all_is_forwarded_to_the_collector(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, "2026-10-12")
            with patch.object(update_school_meals, "PROJECT_ROOT", root), patch.object(
                update_school_meals, "_run", return_value=0
            ) as run:
                status = update_school_meals.main(
                    ["--date", "2026-10-12", "--all-schools", "--refresh-all"]
                )

        self.assertEqual(status, 0)
        fetch = run.call_args_list[0].args[0]
        self.assertIn("--refresh-all", fetch)
        self.assertNotIn("--resume", fetch)

    def test_citywide_wrapper_preserves_local_only_without_publish(self) -> None:
        with patch.object(update_all_taichung_schools, "update_by_district", return_value=0) as update:
            status = update_all_taichung_schools.main(["--date", "2026-10-12", "--skip-ingredients"])
        self.assertEqual(status, 0)
        update.assert_called_once_with(["--date", "2026-10-12", "--skip-ingredients", "--no-publish"])

    def test_citywide_wrapper_uses_partial_publication_pipeline(self) -> None:
        with patch.object(update_all_taichung_schools, "update_by_district", return_value=1) as update:
            status = update_all_taichung_schools.main(["--date", "2026-10-13", "--publish", "--resume", "--verify-and-build"])
        self.assertEqual(status, 1)  # Remaining failed schools do not hide partial publication status.
        update.assert_called_once_with(["--date", "2026-10-13"])

    def test_citywide_wrapper_can_ignore_progress_and_refresh_every_school(self) -> None:
        with patch.object(update_all_taichung_schools, "update_by_district", return_value=0) as update:
            status = update_all_taichung_schools.main(["--date", "2026-10-13", "--refresh-all", "--publish"])
        self.assertEqual(status, 0)
        update.assert_called_once_with(["--date", "2026-10-13", "--refresh-all"])

    def test_citywide_wrapper_rejects_conflicting_modes(self) -> None:
        with patch.object(update_all_taichung_schools, "update_by_district") as update:
            self.assertEqual(update_all_taichung_schools.main(["--resume", "--refresh-all"]), 1)
            self.assertEqual(update_all_taichung_schools.main(["--publish", "--no-publish"]), 1)
        update.assert_not_called()


if __name__ == "__main__":
    unittest.main()
