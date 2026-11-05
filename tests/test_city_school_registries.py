from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from scripts.fetch_city_school_registries import (
    CITY_CONFIG,
    build_city_registry,
    parse_api_rows,
    parse_school_list_api_key,
    school_name_matches,
    write_json_if_changed,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class CitySchoolRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.counties = [{"CountyId": 26, "County": "苗栗縣"}]
        self.areas = [
            {"CountyId": 26, "County": "苗栗縣", "AreaId": 101, "Area": "苗栗市"}
        ]
        self.national = {
            "schools": [
                {
                    "city": "苗栗縣",
                    "level": "國小",
                    "moeSchoolCode": "054601",
                    "name": "縣立建功國小",
                    "attachedDepartment": False,
                },
                {
                    "city": "苗栗縣",
                    "level": "國小",
                    "moeSchoolCode": "054602",
                    "name": "縣立大同國小",
                    "attachedDepartment": False,
                },
            ]
        }

    def test_parses_public_frontend_key_and_api_envelope(self) -> None:
        key = "a" * 64
        self.assertEqual(
            parse_school_list_api_key(
                f"return {{'schoolListApiKey': '{key}'}};".encode()
            ),
            key,
        )
        self.assertEqual(
            parse_api_rows(b'{"result":1,"data":[{"CountyId":26}]}', "測試"),
            [{"CountyId": 26}],
        )
        with self.assertRaises(ValueError):
            parse_api_rows(b'{"result":0,"data":[]}', "測試")

    def test_rollout_config_includes_taipei_and_taoyuan(self) -> None:
        self.assertEqual(CITY_CONFIG["臺北市"]["countyId"], 17)
        self.assertEqual(CITY_CONFIG["桃園市"]["countyId"], 25)
        self.assertEqual(
            CITY_CONFIG["臺北市"]["output"],
            "taipei-active-elementary-schools.json",
        )
        self.assertEqual(
            CITY_CONFIG["桃園市"]["output"],
            "taoyuan-active-elementary-schools.json",
        )

    def test_taipei_and_taoyuan_reviewed_registries_are_complete(self) -> None:
        expectations = {
            "taipei": {
                "city": "臺北市",
                "candidate": 151,
                "verified": 147,
                "excluded": {"311601", "331601", "411601", "381601"},
                "reviewed_aliases": {"353603", "353608", "330601", "380601"},
            },
            "taoyuan": {
                "city": "桃園市",
                "candidate": 189,
                "verified": 188,
                "excluded": {"411890"},
                "reviewed_aliases": {"034630"},
            },
        }
        for slug, expected in expectations.items():
            registry = json.loads(
                (PROJECT_ROOT / "data/reference" / f"{slug}-active-elementary-schools.json")
                .read_text(encoding="utf-8")
            )
            report = json.loads(
                (PROJECT_ROOT / "data/reference" / f"{slug}-school-registry-report.json")
                .read_text(encoding="utf-8")
            )
            self.assertEqual(registry["review"]["status"], "reviewed")
            self.assertEqual(registry["summary"]["city"], expected["city"])
            self.assertEqual(registry["summary"]["candidateSchoolCount"], expected["candidate"])
            self.assertEqual(registry["summary"]["schoolCount"], expected["verified"])
            self.assertEqual(
                report["statusCounts"],
                {"excluded": len(expected["excluded"]), "verified": expected["verified"]},
            )
            self.assertEqual(
                {
                    row["fatraceSchoolCode"]
                    for row in report["results"]
                    if row["status"] == "excluded"
                },
                expected["excluded"],
            )
            self.assertEqual(
                {
                    row["fatraceSchoolCode"]
                    for row in report["results"]
                    if row.get("nameMatchMethod") == "reviewed_alias"
                },
                expected["reviewed_aliases"],
            )

    def test_builds_reviewed_registry_and_keeps_branch_school(self) -> None:
        schools = [
            {
                "SchoolId": 1,
                "SchoolCode": "054601",
                "SchoolName": "苗栗縣苗栗市建功國小",
                "CountyId": 26,
                "AreaId": 101,
                "SchoolType": 2,
            },
            {
                "SchoolId": 2,
                "SchoolCode": "054602-01",
                "SchoolName": "苗栗縣苗栗市大同國小山區分校",
                "CountyId": 26,
                "AreaId": 101,
                "SchoolType": 2,
            },
        ]
        registry, report = build_city_registry(
            city="苗栗縣",
            county_id=26,
            county_rows=self.counties,
            area_rows=self.areas,
            school_rows=schools,
            national_directory=self.national,
            retrieved_at="2026-11-04T00:00:00+00:00",
        )

        self.assertEqual(registry["summary"]["schoolCount"], 2)
        branch = next(
            school for school in registry["schools"] if school["fatraceSchoolId"] == 2
        )
        self.assertEqual(branch["name"], "大同國小山區分校")
        self.assertEqual(branch["moeSchoolCode"], "054602")
        self.assertEqual(branch["fatraceSchoolCode"], "054602-01")
        self.assertEqual(report["statusCounts"], {"verified": 2})

    def test_excludes_records_that_fail_independent_directory_check(self) -> None:
        schools = [
            {
                "SchoolId": 1,
                "SchoolCode": "054601",
                "SchoolName": "苗栗縣苗栗市完全不同國小",
                "CountyId": 26,
                "AreaId": 101,
                "SchoolType": 2,
            },
            {
                "SchoolId": 2,
                "SchoolCode": "054602",
                "SchoolName": "苗栗縣苗栗市大同國小",
                "CountyId": 26,
                "AreaId": 101,
                "SchoolType": 2,
            },
        ]
        registry, report = build_city_registry(
            city="苗栗縣",
            county_id=26,
            county_rows=self.counties,
            area_rows=self.areas,
            school_rows=schools,
            national_directory=self.national,
            retrieved_at="2026-11-04T00:00:00+00:00",
        )

        self.assertEqual([school["name"] for school in registry["schools"]], ["大同國小"])
        self.assertEqual(report["statusCounts"], {"excluded": 1, "verified": 1})

    def test_rejects_wrong_county_or_school_type_in_source_list(self) -> None:
        invalid = {
            "SchoolId": 1,
            "SchoolCode": "054601",
            "SchoolName": "苗栗縣苗栗市建功國小",
            "CountyId": 28,
            "AreaId": 101,
            "SchoolType": 2,
        }
        with self.assertRaisesRegex(ValueError, "無效識別"):
            build_city_registry(
                city="苗栗縣",
                county_id=26,
                county_rows=self.counties,
                area_rows=self.areas,
                school_rows=[invalid],
                national_directory=self.national,
                retrieved_at="2026-11-04T00:00:00+00:00",
            )

    def test_name_matching_normalizes_official_long_forms(self) -> None:
        rows = [{"name": "縣立建功國民小學"}]
        self.assertTrue(school_name_matches(rows, "建功國小", "054601"))

    def test_name_matching_accepts_only_reviewed_exact_code_aliases(self) -> None:
        self.assertTrue(
            school_name_matches(
                [{"name": "市立菓林國小"}],
                "果林國小",
                "034630",
            )
        )
        self.assertFalse(
            school_name_matches(
                [{"name": "市立菓林國小"}],
                "果林國小",
                "999999",
            )
        )

    def test_unchanged_payload_does_not_replace_timestamp(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            first = {"retrievedAt": "first", "schools": [{"name": "甲國小"}]}
            second = {"retrievedAt": "second", "schools": [{"name": "甲國小"}]}
            self.assertEqual(write_json_if_changed(path, first), "updated")
            self.assertEqual(write_json_if_changed(path, second), "unchanged")
            self.assertEqual(json.loads(path.read_text())["retrievedAt"], "first")


if __name__ == "__main__":
    unittest.main()
