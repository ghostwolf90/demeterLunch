from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, datetime
from email.message import Message
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

from src.fatrace_daily import (
    DailyMealStorage,
    FatraceDailyClient,
    FatraceDailyError,
    School,
    load_school_registry,
)
from src.http_client import HttpResponse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REGISTRY = (
    PROJECT_ROOT
    / "data"
    / "reference"
    / "taichung-west-elementary-schools.json"
)


class _FakeHttpClient:
    def __init__(self, responder):
        self.responder = responder
        self.urls: list[str] = []

    def get(self, url: str, **_kwargs) -> HttpResponse:
        self.urls.append(url)
        payload = self.responder(url)
        headers = Message()
        headers["Content-Type"] = "application/json; charset=utf-8"
        return HttpResponse(
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            url=url,
            status=200,
            headers=headers,
        )


def _ok(data):
    return {"result": 1, "message": "ok", "data": data}


class FatraceDailyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.school = School(
            city="臺中市",
            district="西區",
            level="國小",
            name="忠信國小",
            full_name="臺中市西區忠信國小",
            fatrace_school_id=193609,
        )
        self.meal_date = date(2026, 10, 8)
        self.fetched_at = datetime(
            2026, 10, 8, 14, 0, tzinfo=ZoneInfo("Asia/Taipei")
        )

    def test_registry_contains_the_six_west_district_schools(self) -> None:
        schools = load_school_registry(REGISTRY)
        self.assertEqual(len(schools), 6)
        self.assertEqual(
            {school.name: school.fatrace_school_id for school in schools},
            {
                "忠信國小": 193609,
                "忠孝國小": 193608,
                "大勇國小": 193644,
                "中正國小": 193612,
                "大同國小": 193610,
                "忠明國小": 193611,
            },
        )

    def test_collects_and_normalizes_available_meal(self) -> None:
        def responder(url: str):
            parts = urlsplit(url)
            query = parse_qs(parts.query)
            if parts.path == "/school/193609":
                return _ok(
                    {"SchoolId": 193609, "SchoolName": "臺中市西區忠信國小"}
                )
            if parts.path == "/offering/service":
                return _ok(
                    [
                        {"label": "午餐", "ServiceId": 1},
                        {"label": "午餐菜單設計人員", "ServiceId": 7},
                    ]
                )
            if parts.path == "/offered/kitchen":
                return _ok([{"KitchenId": 99, "KitchenName": "測試廚房"}])
            if parts.path == "/offered/meal":
                self.assertEqual(query["MenuType"], ["1"])
                self.assertEqual(query["KitchenId"], ["99"])
                return _ok(
                    [
                        {
                            "BatchDataId": 88,
                            "MenuDate": "2026/10/08",
                            "MenuType": "1",
                            "MenuTypeName": "午餐",
                            "KitchenId": 99,
                            "KitchenName": "測試廚房",
                            "Calorie": "650",
                        }
                    ]
                )
            if parts.path == "/nomenudatelist":
                return _ok([])
            if parts.path == "/dish":
                return _ok(
                    [
                        {
                            "DishId": 123,
                            "BatchDataId": 88,
                            "DishName": "小米飯",
                            "DishType": "主食",
                        },
                        {
                            "DishId": 38705,
                            "BatchDataId": 88,
                            "DishName": "調味料",
                        },
                    ]
                )
            if parts.path == "/ingredient":
                self.assertEqual(query["DishId"], ["123"])
                return _ok(
                    [
                        {
                            "IngredientName": "白米",
                            "Manufacturer": "製造者",
                            "SupplierName": "供應商",
                            "IngredientSourceNameList": "臺灣",
                            "Certification": [
                                {
                                    "SourceCertification": "產銷履歷",
                                    "CertificationId": "TAP-1",
                                }
                            ],
                        }
                    ]
                )
            self.fail(f"unexpected URL: {url}")

        fake = _FakeHttpClient(responder)
        raw, candidate = FatraceDailyClient(fake).collect(
            self.school, self.meal_date, fetched_at=self.fetched_at
        )

        self.assertEqual(candidate["status"], "available")
        self.assertEqual(candidate["review"]["status"], "pending")
        dish = candidate["services"][0]["meals"][0]["dishes"][0]
        self.assertEqual(len(candidate["services"][0]["meals"][0]["dishes"]), 1)
        self.assertEqual(dish["name"], "小米飯")
        self.assertEqual(dish["ingredients"][0]["name"], "白米")
        self.assertEqual(
            dish["ingredients"][0]["certifications"][0]["name"], "產銷履歷"
        )
        self.assertIn("contentHash", candidate)
        self.assertEqual(raw["recordType"], "official-daily-meal-raw")
        self.assertFalse(any("MenuType=7" in url for url in fake.urls))

    def test_official_no_menu_record_is_distinct_from_not_published(self) -> None:
        def responder(url: str):
            path = urlsplit(url).path
            if path == "/school/193609":
                return _ok(
                    {"SchoolId": 193609, "SchoolName": "臺中市西區忠信國小"}
                )
            if path == "/offering/service":
                return _ok([{"label": "午餐", "ServiceId": 1}])
            if path == "/offered/kitchen":
                return _ok([{"KitchenId": 99, "KitchenName": "測試廚房"}])
            if path == "/offered/meal":
                return _ok([])
            if path == "/nomenudatelist":
                return _ok(
                    [
                        {
                            "startdate": "2026-10-08",
                            "enddate": "2026-10-08",
                            "menutypeName": "午餐",
                            "nomenutypeName": "國定假日",
                            "note": "國慶日連假",
                        }
                    ]
                )
            self.fail(f"unexpected URL: {url}")

        _, candidate = FatraceDailyClient(_FakeHttpClient(responder)).collect(
            self.school, self.meal_date, fetched_at=self.fetched_at
        )
        self.assertEqual(candidate["status"], "no_meal")
        self.assertEqual(candidate["noMealReasons"][0]["reason"], "國定假日")

    def test_empty_meal_without_official_reason_is_not_published(self) -> None:
        def responder(url: str):
            path = urlsplit(url).path
            if path == "/school/193609":
                return _ok(
                    {"SchoolId": 193609, "SchoolName": "臺中市西區忠信國小"}
                )
            if path == "/offering/service":
                return _ok([{"label": "午餐", "ServiceId": 1}])
            if path == "/offered/kitchen":
                return _ok([{"KitchenId": 99, "KitchenName": "測試廚房"}])
            if path in {"/offered/meal", "/nomenudatelist"}:
                return _ok([])
            self.fail(f"unexpected URL: {url}")

        _, candidate = FatraceDailyClient(_FakeHttpClient(responder)).collect(
            self.school, self.meal_date, fetched_at=self.fetched_at
        )
        self.assertEqual(candidate["status"], "not_published")

    def test_rejects_school_id_name_mismatch(self) -> None:
        fake = _FakeHttpClient(
            lambda _url: _ok(
                {"SchoolId": 193609, "SchoolName": "另一所同名學校"}
            )
        )
        with self.assertRaises(FatraceDailyError):
            FatraceDailyClient(fake).collect(self.school, self.meal_date)

    def test_storage_is_idempotent_and_preserves_available_record(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            storage = DailyMealStorage(Path(directory))
            raw = {"schemaVersion": 1}
            available = self._candidate("available", "hash-available")
            created = storage.save(
                self.school, self.meal_date, raw, available
            )
            unchanged = storage.save(
                self.school, self.meal_date, raw, available
            )
            missing = self._candidate("not_published", "hash-empty")
            preserved = storage.save(
                self.school, self.meal_date, raw, missing
            )

            self.assertEqual(created.status, "created")
            self.assertEqual(unchanged.status, "unchanged")
            self.assertEqual(preserved.status, "preserved")
            saved = json.loads(
                (created.path / "candidate.json").read_text(encoding="utf-8")
            )
            self.assertEqual(saved["status"], "available")

    def _candidate(self, status: str, content_hash: str) -> dict:
        return {
            "schemaVersion": 1,
            "status": status,
            "contentHash": content_hash,
        }


if __name__ == "__main__":
    unittest.main()
