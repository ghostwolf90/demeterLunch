from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from scripts import fetch_school_meals


class _FakeDailyClient:
    statuses: dict[int, str] = {}
    probed: list[int] = []
    collected: list[int] = []

    def __init__(self, _http, *, include_ingredients: bool = True) -> None:
        self.include_ingredients = include_ingredients

    @staticmethod
    def _payload(school, meal_date, fetched_at: datetime, status: str):
        timestamp = fetched_at.isoformat()
        raw = {
            "schemaVersion": 1,
            "school": school.as_dict(),
            "mealDate": meal_date.isoformat(),
            "fetchedAt": timestamp,
        }
        candidate = {
            "schemaVersion": 1,
            "recordType": "official-daily-meal-record",
            "school": school.as_dict(),
            "mealDate": meal_date.isoformat(),
            "status": status,
            "fetchedAt": timestamp,
            "noMealReasons": [],
            "services": [],
            "review": {"status": "pending"},
            "contentHash": f"{school.fatrace_school_id}-{status}",
        }
        return raw, candidate

    def probe(self, school, meal_date, *, fetched_at):
        self.probed.append(school.fatrace_school_id)
        return self._payload(
            school,
            meal_date,
            fetched_at,
            self.statuses[school.fatrace_school_id],
        )

    def collect(self, school, meal_date, *, fetched_at):
        self.collected.append(school.fatrace_school_id)
        return self._payload(school, meal_date, fetched_at, "available")


class FetchSchoolMealsResumeTests(unittest.TestCase):
    def setUp(self) -> None:
        _FakeDailyClient.statuses = {}
        _FakeDailyClient.probed = []
        _FakeDailyClient.collected = []

    def _write_registry(self, root: Path) -> Path:
        path = root / "registry.json"
        path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "schools": [
                        {
                            "city": "臺中市",
                            "district": "甲區",
                            "level": "國小",
                            "name": f"測試國小{school_id}",
                            "fullName": f"臺中市甲區測試國小{school_id}",
                            "fatraceSchoolId": school_id,
                        }
                        for school_id in (1, 2, 3)
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return path

    def _write_available_candidate(
        self,
        output: Path,
        meal_date: str,
        school_id: int,
    ) -> None:
        target = output / meal_date / str(school_id)
        target.mkdir(parents=True)
        target.joinpath("candidate.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "school": {"fatraceSchoolId": school_id},
                    "mealDate": meal_date,
                    "status": "available",
                    "fetchedAt": f"{meal_date}T09:00:00+08:00",
                    "contentHash": f"{school_id}-available",
                }
            ),
            encoding="utf-8",
        )

    def test_resume_reuses_completed_and_checks_unfinished_first(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = self._write_registry(root)
            output = root / "raw"
            meal_date = "2026-10-20"
            self._write_available_candidate(output, meal_date, 1)
            report_path = output / meal_date / "report.json"
            report_path.write_text(
                json.dumps(
                    {
                        "mealDate": meal_date,
                        "includeIngredients": False,
                        "results": [
                            {
                                "school": "測試國小1",
                                "fatraceSchoolId": 1,
                                "recordStatus": "available",
                                "saveStatus": "created",
                                "checkedAt": f"{meal_date}T09:00:00+08:00",
                                "attempts": 1,
                            },
                            {
                                "school": "測試國小2",
                                "fatraceSchoolId": 2,
                                "recordStatus": "not_published",
                                "saveStatus": "created",
                                "checkedAt": f"{meal_date}T09:01:00+08:00",
                                "attempts": 1,
                            },
                            {
                                "school": "測試國小3",
                                "fatraceSchoolId": 3,
                                "recordStatus": "not_checked",
                                "saveStatus": "not_written",
                                "checkedAt": None,
                                "attempts": 0,
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            _FakeDailyClient.statuses = {
                2: "not_published",
                3: "available",
            }
            with patch.object(
                fetch_school_meals,
                "FatraceDailyClient",
                _FakeDailyClient,
            ), patch.object(fetch_school_meals, "HttpClient", return_value=object()):
                status = fetch_school_meals.main(
                    [
                        "--date",
                        meal_date,
                        "--registry",
                        str(registry),
                        "--output-dir",
                        str(output),
                        "--skip-ingredients",
                        "--resume",
                        "--interval",
                        "0",
                    ]
                )

            report = json.loads(report_path.read_text(encoding="utf-8"))

        self.assertEqual(status, 0)
        self.assertEqual(_FakeDailyClient.probed, [2, 3])
        self.assertEqual(_FakeDailyClient.collected, [3])
        self.assertEqual(report["schemaVersion"], 2)
        self.assertEqual(report["summary"]["reusedCompleted"], 1)
        self.assertEqual(report["summary"]["checkedThisRun"], 2)
        self.assertEqual(report["summary"]["available"], 2)
        self.assertEqual(report["summary"]["notPublished"], 1)
        self.assertEqual(report["summary"]["pending"], 1)
        self.assertEqual(
            report["notPublishedSchools"][0]["fatraceSchoolId"],
            2,
        )
        self.assertIsNotNone(report["notPublishedSchools"][0]["checkedAt"])

    def test_refresh_all_ignores_completed_progress(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = self._write_registry(root)
            output = root / "raw"
            meal_date = "2026-10-20"
            results = []
            for school_id in (1, 2, 3):
                self._write_available_candidate(output, meal_date, school_id)
                results.append(
                    {
                        "school": f"測試國小{school_id}",
                        "fatraceSchoolId": school_id,
                        "recordStatus": "available",
                        "saveStatus": "created",
                        "checkedAt": f"{meal_date}T09:00:00+08:00",
                        "attempts": 1,
                    }
                )
            report_path = output / meal_date / "report.json"
            report_path.write_text(
                json.dumps(
                    {
                        "mealDate": meal_date,
                        "includeIngredients": False,
                        "results": results,
                    }
                ),
                encoding="utf-8",
            )
            _FakeDailyClient.statuses = {
                1: "no_meal",
                2: "no_meal",
                3: "no_meal",
            }
            with patch.object(
                fetch_school_meals,
                "FatraceDailyClient",
                _FakeDailyClient,
            ), patch.object(fetch_school_meals, "HttpClient", return_value=object()):
                status = fetch_school_meals.main(
                    [
                        "--date",
                        meal_date,
                        "--registry",
                        str(registry),
                        "--output-dir",
                        str(output),
                        "--skip-ingredients",
                        "--refresh-all",
                        "--interval",
                        "0",
                    ]
                )

            report = json.loads(report_path.read_text(encoding="utf-8"))

        self.assertEqual(status, 0)
        self.assertEqual(_FakeDailyClient.probed, [1, 2, 3])
        self.assertEqual(_FakeDailyClient.collected, [])
        self.assertEqual(report["runMode"], "refresh_all")
        self.assertEqual(report["summary"]["checkedThisRun"], 3)
        self.assertEqual(report["summary"]["reusedCompleted"], 0)


if __name__ == "__main__":
    unittest.main()
