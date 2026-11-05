from __future__ import annotations

import unittest

from scripts.build_city_service_catalog import (
    TAIWAN_CITY_ORDER,
    build_catalog_payload,
)


class CityServiceCatalogTests(unittest.TestCase):
    def test_all_cities_remain_visible_without_entering_collection(self) -> None:
        national = {
            "academicYear": 115,
            "retrievedAt": "2026-10-23T00:00:00+00:00",
            "schools": [
                {"city": city, "level": "國小", "moeSchoolCode": f"{index:06d}"}
                for index, city in enumerate(TAIWAN_CITY_ORDER, start=1)
            ],
        }
        active = {
            "generatedAt": "2026-11-05T00:00:00+00:00",
            "cityOrder": ["臺北市", "桃園市", "苗栗縣", "臺中市", "彰化縣", "臺南市"],
            "schools": [
                {"city": city, "fatraceSchoolId": index}
                for index, city in enumerate(
                    ["臺北市", "桃園市", "苗栗縣", "臺中市", "彰化縣", "臺南市"], start=1
                )
            ],
        }
        payload = build_catalog_payload(national, active)
        self.assertEqual(len(payload["cities"]), 22)
        self.assertEqual(
            [city["name"] for city in payload["cities"]],
            list(TAIWAN_CITY_ORDER),
        )
        enabled = {
            city["name"] for city in payload["cities"] if city["collectionEnabled"]
        }
        self.assertEqual(enabled, set(active["cityOrder"]))
        taipei = next(city for city in payload["cities"] if city["name"] == "臺北市")
        self.assertEqual(taipei["schoolCount"], 1)
        self.assertEqual(taipei["mealUnitCount"], 1)

    def test_rejects_collection_city_order_that_is_not_geographic(self) -> None:
        national = {
            "schools": [
                {"city": city, "level": "國小"}
                for city in TAIWAN_CITY_ORDER
            ],
        }
        with self.assertRaisesRegex(ValueError, "地理順序"):
            build_catalog_payload(
                national,
                {
                    "cityOrder": ["臺中市", "臺北市"],
                    "schools": [{"city": "臺中市"}, {"city": "臺北市"}],
                },
            )

    def test_rejects_incomplete_national_city_list(self) -> None:
        with self.assertRaisesRegex(ValueError, "不完整"):
            build_catalog_payload(
                {"schools": [{"city": "臺中市", "level": "國小"}]},
                {"cityOrder": ["臺中市"], "schools": [{"city": "臺中市"}]},
            )


if __name__ == "__main__":
    unittest.main()
