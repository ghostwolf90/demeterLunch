from __future__ import annotations

import unittest

from scripts.build_city_service_catalog import TAIWAN_CITY_ORDER
from scripts.fetch_national_fatrace_school_directory import (
    build_reference_payload,
    county_ids_by_city,
)


class NationalFatraceSchoolDirectoryTests(unittest.TestCase):
    def test_county_catalog_requires_every_taiwan_city(self) -> None:
        rows = [
            {"County": city.replace("臺", "台"), "CountyId": index}
            for index, city in enumerate(TAIWAN_CITY_ORDER, start=1)
        ]
        self.assertEqual(
            county_ids_by_city(rows)["臺中市"],
            TAIWAN_CITY_ORDER.index("臺中市") + 1,
        )
        with self.assertRaisesRegex(ValueError, "不完整"):
            county_ids_by_city(rows[:-1])

    def test_reference_is_complete_but_never_active(self) -> None:
        city_results = []
        for index, city in enumerate(TAIWAN_CITY_ORDER, start=1):
            result = {
                "fatraceSchoolId": index,
                "fatraceSchoolCode": f"{index:06d}",
                "fullName": f"{city}測試國小",
                "district": "測試區",
                "status": "verified",
                "moeSchoolCode": f"{index:06d}",
                "name": "測試國小",
            }
            city_results.append((
                city,
                index,
                {"summary": {"city": city, "schoolCount": 1}},
                {"results": [result]},
            ))
        payload = build_reference_payload(
            national_directory={"academicYear": 115},
            retrieved_at="2026-11-05T00:00:00+00:00",
            city_results=city_results,
        )
        self.assertEqual(payload["status"], "inactive_reference_only")
        self.assertEqual(payload["summary"]["cityCount"], 22)
        self.assertEqual(payload["summary"]["verifiedUnitCount"], 22)
        self.assertNotIn("enabled", payload["schoolUnits"][0])

    def test_name_alias_is_kept_for_review_instead_of_discarded(self) -> None:
        city_results = []
        for index, city in enumerate(TAIWAN_CITY_ORDER, start=1):
            row = {
                "fatraceSchoolId": index,
                "fatraceSchoolCode": f"{index:06d}",
                "status": "verified",
                "moeSchoolCode": f"{index:06d}",
            }
            if city == "臺北市":
                row.update(
                    status="excluded",
                    reason="中央平臺校名與教育部名錄不一致",
                    directoryNames=["市立測試實驗國小"],
                )
            city_results.append((
                city,
                index,
                {"summary": {"city": city}},
                {"results": [row]},
            ))
        payload = build_reference_payload(
            national_directory={"academicYear": 115},
            retrieved_at="2026-11-05T00:00:00+00:00",
            city_results=city_results,
        )
        self.assertEqual(payload["summary"]["reviewRequiredUnitCount"], 1)
        taipei = next(
            unit for unit in payload["schoolUnits"] if unit["city"] == "臺北市"
        )
        self.assertEqual(taipei["status"], "review_required")

    def test_duplicate_fatrace_id_is_rejected(self) -> None:
        city_results = []
        for city in TAIWAN_CITY_ORDER:
            city_results.append((
                city,
                1,
                {"summary": {"city": city}},
                {"results": [{
                    "fatraceSchoolId": 1,
                    "fatraceSchoolCode": "000001",
                    "status": "verified",
                    "moeSchoolCode": "000001",
                }]},
            ))
        with self.assertRaisesRegex(ValueError, "重複"):
            build_reference_payload(
                national_directory={"academicYear": 115},
                retrieved_at="2026-11-05T00:00:00+00:00",
                city_results=city_results,
            )


if __name__ == "__main__":
    unittest.main()
