from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from scripts import run_cloud_school_meals


class RunCloudSchoolMealsTests(unittest.TestCase):
    def _write_report(self, root: Path, statuses: list[str]) -> None:
        meal_date = "2026-10-15"
        report_path = root / "data/raw/fatrace-daily" / meal_date / "report.json"
        report_path.parent.mkdir(parents=True)
        results = [
            {
                "school": f"學校{index}",
                "fatraceSchoolId": 1000 + index,
                "recordStatus": status,
            }
            for index, status in enumerate(statuses)
        ]
        report_path.write_text(
            json.dumps(
                {
                    "mealDate": meal_date,
                    "summary": {"schools": len(results)},
                    "results": results,
                }
            ),
            encoding="utf-8",
        )

    def test_retry_selects_only_incomplete_schools(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, ["available", "failed", "not_published"])
            with patch.object(run_cloud_school_meals, "PROJECT_ROOT", root), patch.object(
                run_cloud_school_meals, "_run", return_value=2
            ) as run:
                status = run_cloud_school_meals.main(
                    ["--mode", "retry", "--date", "2026-10-15"]
                )

        self.assertEqual(status, 2)
        fetch = run.call_args_list[0].args[0]
        selected = [
            fetch[index + 1]
            for index, value in enumerate(fetch)
            if value == "--school"
        ]
        self.assertEqual(selected, ["1001", "1002"])

    def test_retry_stays_quiet_when_every_school_is_complete(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, ["available", "no_meal"])
            with patch.object(run_cloud_school_meals, "PROJECT_ROOT", root), patch.object(
                run_cloud_school_meals, "_run"
            ) as run:
                status = run_cloud_school_meals.main(
                    ["--mode", "retry", "--date", "2026-10-15"]
                )

        self.assertEqual(status, 0)
        run.assert_not_called()

    def test_main_publishes_completed_schools_and_leaves_incomplete_for_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(
                root,
                ["available", "no_meal", "failed", "not_published"],
            )
            with patch.object(run_cloud_school_meals, "PROJECT_ROOT", root), patch.object(
                run_cloud_school_meals,
                "_run",
                side_effect=[2, 0, 0, 0, 0, 0, 0],
            ) as run:
                status = run_cloud_school_meals.main(
                    ["--mode", "main", "--date", "2026-10-15", "--publish"]
                )

        self.assertEqual(status, 2)
        publish = run.call_args_list[-1].args[0]
        selected = [
            publish[index + 1]
            for index, value in enumerate(publish)
            if value == "--school-id"
        ]
        self.assertEqual(selected, ["1000", "1001"])
        self.assertNotIn("1002", selected)
        self.assertNotIn("1003", selected)

    def test_archives_each_fetch_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._write_report(root, ["available"])
            with patch.object(run_cloud_school_meals, "PROJECT_ROOT", root):
                archive = run_cloud_school_meals._archive_report(
                    date(2026, 10, 15), "main"
                )

            self.assertTrue(archive.is_file())
            self.assertEqual(json.loads(archive.read_text())["mealDate"], "2026-10-15")


if __name__ == "__main__":
    unittest.main()
