from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

from scripts.update_traceability import previous_month
from src.fatrace_openapi import (
    Dataset,
    FatraceClient,
    FatraceError,
    TRACEABILITY_HEADERS,
    build_traceability_package,
    normalize_download_url,
    select_monthly_datasets,
    validate_csv_file,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SAMPLE_CSV = (
    PROJECT_ROOT
    / "校園登入食材平台_營養午餐"
    / "202608_臺中市國中小午餐菜色及食材資料集20261002101610.csv"
)


class _Response(BytesIO):
    status = 200

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


class FatraceOpenApiTests(unittest.TestCase):
    def test_previous_month_crosses_year_boundary(self) -> None:
        self.assertEqual(previous_month(date(2026, 1, 8)), (2025, 12))
        self.assertEqual(previous_month(date(2026, 10, 6)), (2026, 9))

    def test_query_datasets_posts_expected_month_without_leaking_secret(self) -> None:
        response = {
            "message": "openapi查詢成功",
            "datasetList": [
                {
                    "year": "2026",
                    "month": "09",
                    "county": "臺中市",
                    "grade": "國中小",
                    "datasetname": "午餐菜色及食材資料集",
                    "createdate": "2026/10/06",
                }
            ],
        }
        opener = Mock(return_value=_Response(json.dumps(response).encode("utf-8")))
        client = FatraceClient(
            "test-secret",
            opener=opener,
            request_interval=0,
            sleeper=lambda _seconds: None,
        )

        datasets = client.query_datasets(2026, 9, "臺中市")

        self.assertEqual(datasets[0].name, "午餐菜色及食材資料集")
        request = opener.call_args.args[0]
        self.assertEqual(request.full_url.rsplit("/", 2)[-2], "opendatadataset")
        body = json.loads(request.data.decode("utf-8"))
        self.assertEqual(body["year"], "2026")
        self.assertEqual(body["month"], "09")
        self.assertEqual(body["accesscode"], "test-secret")

    def test_query_preserves_blank_fields_for_ingredient_name_dataset(self) -> None:
        response = {
            "datasetList": [
                {
                    "year": "",
                    "month": "",
                    "county": "",
                    "grade": "",
                    "datasetname": "食材中文名稱資料集",
                    "createdate": "2022/11/18",
                }
            ]
        }
        opener = Mock(return_value=_Response(json.dumps(response).encode("utf-8")))
        client = FatraceClient(
            "test-secret",
            opener=opener,
            request_interval=0,
            sleeper=lambda _seconds: None,
        )

        dataset = client.query_datasets(2026, 9, "臺中市")[0]

        self.assertEqual(dataset.year, "")
        self.assertEqual(dataset.month, "")
        self.assertEqual(dataset.county, "")
        self.assertEqual(dataset.grade, "")

    def test_selects_county_and_national_datasets_only(self) -> None:
        datasets = [
            Dataset("2026", "09", "臺中市", "國中小", "午餐菜色及食材資料集", ""),
            Dataset("2026", "09", "全國", "", "食材中文名稱資料集", ""),
            Dataset("2026", "09", "臺南市", "國中小", "午餐菜色及食材資料集", ""),
        ]
        selected = select_monthly_datasets(
            datasets, county="臺中市", grade="國中小"
        )
        self.assertEqual(
            {(item.county, item.grade, item.name) for item in selected},
            {
                ("臺中市", "國中小", "午餐菜色及食材資料集"),
                ("全國", "", "食材中文名稱資料集"),
            },
        )

    def test_rejects_download_links_outside_the_official_directory(self) -> None:
        with self.assertRaises(FatraceError):
            normalize_download_url("https://example.com/private.csv")
        with self.assertRaises(FatraceError):
            normalize_download_url(
                "https://fatraceschool.k12ea.gov.tw/unrelated/private.csv"
            )

    def test_sample_csv_has_required_traceability_headers(self) -> None:
        headers = validate_csv_file(SAMPLE_CSV, TRACEABILITY_HEADERS)
        self.assertIn("菜色名稱", headers)
        self.assertIn("食材供應商統編", headers)

    def test_builds_reviewed_traceability_from_the_official_sample(self) -> None:
        package = build_traceability_package(
            SAMPLE_CSV,
            source_month="2026-08",
            source_file=f"校園登入食材平台_營養午餐/{SAMPLE_CSV.name}",
            school_name="臺中市西區忠信國小",
            county="臺中市",
            available_dates={"2026-08-31"},
        )

        self.assertIsNotNone(package)
        assert package is not None
        self.assertEqual(package["review"]["status"], "reviewed")
        self.assertEqual([day["date"] for day in package["days"]], ["2026-08-31"])
        ingredients = [
            ingredient
            for day in package["days"]
            for dish in day["dishes"]
            for ingredient in dish["ingredients"]
        ]
        self.assertEqual(len(ingredients), 14)
        self.assertTrue(all(item["supplierBusinessId"] for item in ingredients))
        self.assertNotIn("test-secret", json.dumps(package, ensure_ascii=False))

    def test_existing_same_day_record_is_not_replaced(self) -> None:
        package = build_traceability_package(
            SAMPLE_CSV,
            source_month="2026-08",
            source_file=SAMPLE_CSV.name,
            school_name="臺中市西區忠信國小",
            county="臺中市",
            available_dates={"2026-08-31"},
            excluded_dates={"2026-08-31"},
        )
        self.assertIsNone(package)

    def test_csv_validation_rejects_missing_headers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.csv"
            path.write_text("a,b\n1,2\n", encoding="utf-8")
            with self.assertRaises(FatraceError):
                validate_csv_file(path, TRACEABILITY_HEADERS)


if __name__ == "__main__":
    unittest.main()
