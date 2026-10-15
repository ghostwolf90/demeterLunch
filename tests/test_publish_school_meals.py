from __future__ import annotations

import json
import ssl
import tempfile
import unittest
from datetime import date
from pathlib import Path

from scripts.publish_school_meals import (
    ManualPublishError,
    _verified_ssl_context,
    build_publish_bundle,
)
from src.fatrace_daily import candidate_fingerprint


class PublishSchoolMealsTests(unittest.TestCase):
    def _fixture(
        self, root: Path, *, failed: int = 0, include_second_school: bool = True
    ) -> None:
        report = root / "data/raw/fatrace-daily/2026-10-13/report.json"
        report.parent.mkdir(parents=True)
        report.write_text(
            json.dumps(
                {
                    "mealDate": "2026-10-13",
                    "summary": {
                        "schools": 2 if include_second_school else 1,
                        "available": 1,
                        "noMeal": 0,
                        "notPublished": (1 - failed) if include_second_school else 0,
                        "failed": failed,
                    },
                    "results": [
                        {
                            "school": "忠信國小",
                            "fatraceSchoolId": 193609,
                            "recordStatus": "available",
                        },
                    ]
                    + (
                        [
                            {
                                "school": "平等國小",
                                "fatraceSchoolId": 64764,
                                "recordStatus": (
                                    "failed" if failed else "not_published"
                                ),
                            }
                        ]
                        if include_second_school
                        else []
                    ),
                }
            ),
            encoding="utf-8",
        )
        reviewed = root / "data/parsed/schools/fatrace/193609/2026-10-13.json"
        reviewed.parent.mkdir(parents=True)
        record = {
            "schemaVersion": 1,
            "recordType": "official-daily-meal-record",
            "school": {
                "city": "臺中市",
                "district": "西區",
                "level": "國小",
                "name": "忠信國小",
                "fullName": "臺中市西區忠信國民小學",
                "fatraceSchoolId": 193609,
            },
            "mealDate": "2026-10-13",
            "status": "available",
            "noMealReasons": [],
            "services": [
                {
                    "serviceId": 1,
                    "label": "午餐",
                    "meals": [
                        {
                            "batchDataId": "batch-1",
                            "menuDate": "2026-10-13",
                            "menuType": "午餐",
                            "kitchenId": "kitchen-1",
                            "kitchenName": "測試廚房",
                            "uploadedAt": "2026-10-13T08:00:00+08:00",
                            "nutrition": {},
                            "dishes": [
                                {
                                    "dishId": 9007199254740993,
                                    "batchDataId": "batch-1",
                                    "dishBatchDataId": "dish-batch-1",
                                    "name": "測試菜色",
                                    "category": "主菜",
                                    "ingredients": [],
                                }
                            ],
                        }
                    ],
                }
            ],
            "fetchedAt": "2026-10-13T09:00:00+08:00",
            "source": {
                "name": "校園食材登錄平臺",
                "url": "https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=193609&period=2026-10-13",
            },
            "review": {
                "status": "reviewed",
                "reviewedAt": "2026-10-13T10:00:00+08:00",
                "reviewedBy": "test",
                "method": "test",
            },
        }
        record["contentHash"] = candidate_fingerprint(record)
        reviewed.write_text(json.dumps(record), encoding="utf-8")

    def test_builds_multi_school_reviewed_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._fixture(root)

            bundle = build_publish_bundle(root, date(2026, 10, 13))

        self.assertEqual(bundle["mealDate"], "2026-10-13")
        self.assertEqual(bundle["reportSummary"]["notPublished"], 1)
        self.assertEqual(len(bundle["results"]), 2)
        self.assertEqual(len(bundle["records"]), 1)
        self.assertIn("9007199254740993", bundle["records"][0]["recordJson"])
        self.assertEqual(len(bundle["records"][0]["recordSha256"]), 64)
        self.assertNotIn("token", json.dumps(bundle).lower())

    def test_builds_single_school_reviewed_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._fixture(root, include_second_school=False)

            bundle = build_publish_bundle(root, date(2026, 10, 13))

        self.assertEqual(bundle["reportSummary"]["schools"], 1)
        self.assertEqual(len(bundle["results"]), 1)
        self.assertEqual(len(bundle["records"]), 1)

    def test_rejects_report_with_failures(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._fixture(root, failed=1)

            with self.assertRaisesRegex(ManualPublishError, "仍有抓取失敗"):
                build_publish_bundle(root, date(2026, 10, 13))

    def test_can_publish_a_successful_subset_from_report_with_failures(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._fixture(root, failed=1)

            bundle = build_publish_bundle(
                root,
                date(2026, 10, 13),
                school_ids={193609},
            )

        self.assertEqual(bundle["reportSummary"]["schools"], 1)
        self.assertEqual(bundle["reportSummary"]["failed"], 0)
        self.assertEqual(len(bundle["records"]), 1)

    def test_rejects_missing_subset_school(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self._fixture(root)

            with self.assertRaisesRegex(ManualPublishError, "找不到學校代碼"):
                build_publish_bundle(
                    root,
                    date(2026, 10, 13),
                    school_ids={999999},
                )

    def test_https_context_keeps_certificate_verification_enabled(self) -> None:
        context = _verified_ssl_context()

        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)


if __name__ == "__main__":
    unittest.main()
