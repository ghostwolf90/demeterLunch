from __future__ import annotations

import unittest

from scripts.build_active_school_registry import (
    build_refresh_groups,
    merge_registries,
    partition_city_districts,
    preserve_generated_at_if_unchanged,
)
from pathlib import Path
import json
import tempfile


def school(school_id, city, district, name):
    return {
        "city": city,
        "district": district,
        "level": "國小",
        "name": name,
        "fullName": city + district + name,
        "fatraceSchoolId": school_id,
    }


def registry(city, schools=None):
    return {"schemaVersion": 1, "summary": {"city": city}, "schools": schools or []}


class ActiveSchoolRegistryTests(unittest.TestCase):
    def test_merge_keeps_configured_six_city_order(self):
        merged = merge_registries([
            registry("彰化縣", [school(4, "彰化縣", "彰化市", "丁國小")]),
            registry("桃園市", [school(6, "桃園市", "桃園區", "己國小")]),
            registry("臺南市", [
                school(2, "臺南市", "東區", "乙國小")
            ]),
            registry("苗栗縣", [school(3, "苗栗縣", "苗栗市", "丙國小")]),
            registry("臺北市", [school(5, "臺北市", "中正區", "戊國小")]),
            registry("臺中市", [
                school(1, "臺中市", "西區", "甲國小")
            ]),
        ])
        self.assertEqual(
            [item["city"] for item in merged],
            ["臺北市", "桃園市", "苗栗縣", "臺中市", "彰化縣", "臺南市"],
        )

    def test_duplicate_school_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "School ID"):
            merge_registries([
                registry("臺中市", [
                    school(1, "臺中市", "西區", "甲國小")
                ]),
                registry("臺南市", [
                    school(1, "臺南市", "東區", "乙國小")
                ]),
                registry("苗栗縣"),
                registry("彰化縣"),
                registry("臺北市"),
                registry("桃園市"),
            ])

    def test_partition_keeps_districts_whole(self):
        schools = [
            school(index, "臺南市", district, f"學校{index}")
            for index, district in enumerate(
                ["東區"] * 3 + ["南區"] * 3 + ["北區"] * 2, start=10
            )
        ]
        groups = partition_city_districts(schools, target_group_size=4)
        self.assertEqual(sum(group["expectedSchoolCount"] for group in groups), 8)
        self.assertEqual(
            sorted(district for group in groups for district in group["districts"]),
            ["北區", "南區", "東區"],
        )

    def test_refresh_groups_scope_duplicate_district_names_by_city(self):
        schools = [
            school(1, "臺中市", "東區", "甲國小"),
            school(2, "臺南市", "東區", "乙國小"),
        ]
        groups = build_refresh_groups(
            schools,
            {"groups": [{"id": 1, "districts": ["東區"], "expectedSchoolCount": 1}]},
            target_group_size=80,
        )
        self.assertEqual([group["city"] for group in groups], ["臺中市", "臺南市"])
        self.assertEqual([group["expectedSchoolCount"] for group in groups], [1, 1])

    def test_refresh_groups_partition_new_counties_without_splitting_districts(self):
        schools = [
            school(1, "臺中市", "西區", "甲國小"),
            school(2, "苗栗縣", "苗栗市", "乙國小"),
            school(3, "彰化縣", "彰化市", "丙國小"),
        ]
        groups = build_refresh_groups(
            schools,
            {"groups": [{"id": 1, "districts": ["西區"], "expectedSchoolCount": 1}]},
            target_group_size=1,
        )
        self.assertEqual([group["city"] for group in groups], ["苗栗縣", "臺中市", "彰化縣"])
        self.assertEqual(sum(group["expectedSchoolCount"] for group in groups), 3)

    def test_refresh_groups_keep_taipei_and_taoyuan_before_central_taiwan(self):
        schools = [
            school(1, "臺中市", "西區", "甲國小"),
            school(2, "臺北市", "中正區", "乙國小"),
            school(3, "桃園市", "桃園區", "丙國小"),
        ]
        groups = build_refresh_groups(
            schools,
            {"groups": [{"id": 1, "districts": ["西區"], "expectedSchoolCount": 1}]},
            target_group_size=1,
        )
        self.assertEqual([group["city"] for group in groups], ["臺北市", "桃園市", "臺中市"])

    def test_unchanged_registry_preserves_generation_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "registry.json"
            path.write_text(
                json.dumps({"generatedAt": "first", "schools": [{"name": "甲國小"}]}),
                encoding="utf-8",
            )
            payload = preserve_generated_at_if_unchanged(
                path,
                {"generatedAt": "second", "schools": [{"name": "甲國小"}]},
            )
            self.assertEqual(payload["generatedAt"], "first")


if __name__ == "__main__":
    unittest.main()
