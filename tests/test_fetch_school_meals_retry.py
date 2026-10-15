from __future__ import annotations

import unittest

from scripts.fetch_school_meals import _merge_retry_report


class FetchSchoolMealsRetryTests(unittest.TestCase):
    def test_retry_replaces_failed_school_and_preserves_full_report(self) -> None:
        previous = {
            "mealDate": "2026-10-15",
            "checkedAt": "2026-10-15T08:00:00+08:00",
            "completedAt": "2026-10-15T10:00:00+08:00",
            "durationSeconds": 120.0,
            "summary": {
                "schools": 2,
                "available": 1,
                "noMeal": 0,
                "notPublished": 0,
                "failed": 1,
            },
            "results": [
                {
                    "school": "成功國小",
                    "fatraceSchoolId": 1001,
                    "recordStatus": "available",
                },
                {
                    "school": "補抓國小",
                    "fatraceSchoolId": 1002,
                    "recordStatus": "failed",
                },
            ],
        }
        retry = {
            "checkedAt": "2026-10-15T10:10:00+08:00",
            "completedAt": "2026-10-15T10:10:20+08:00",
            "durationSeconds": 20.0,
            "results": [
                {
                    "school": "補抓國小",
                    "fatraceSchoolId": 1002,
                    "recordStatus": "available",
                }
            ],
        }

        merged = _merge_retry_report(previous, retry)

        self.assertEqual(merged["summary"]["schools"], 2)
        self.assertEqual(merged["summary"]["available"], 2)
        self.assertEqual(merged["summary"]["failed"], 0)
        self.assertEqual(
            [result["fatraceSchoolId"] for result in merged["results"]],
            [1001, 1002],
        )
        self.assertEqual(merged["lastRetry"]["schools"], 1)
        self.assertEqual(merged["durationSeconds"], 140.0)

    def test_retry_must_cover_exactly_the_failed_schools(self) -> None:
        previous = {
            "results": [
                {"fatraceSchoolId": 1001, "recordStatus": "failed"},
                {"fatraceSchoolId": 1002, "recordStatus": "failed"},
            ]
        }
        retry = {
            "results": [
                {"fatraceSchoolId": 1001, "recordStatus": "available"}
            ]
        }

        with self.assertRaisesRegex(ValueError, "補抓結果與原報告"):
            _merge_retry_report(previous, retry)


if __name__ == "__main__":
    unittest.main()
