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
    def test_merge_keeps_configured_three_city_order(self):
        merged = merge_registries([
            registry("桃園市", [school(3, "桃園市", "桃園區", "丙國小")]),
            registry("臺北市", [school(2, "臺北市", "中正區", "乙國小")]),
            registry("臺中市", [
                school(1, "臺中市", "西區", "甲國小")
            ]),
        ])
        self.assertEqual(
            [item["city"] for item in merged],
            ["臺北市", "桃園市", "臺中市"],
        )

    def test_duplicate_school_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "School ID"):
            merge_registries([
                registry("臺中市", [
                    school(1, "臺中市", "西區", "甲國小")
                ]),
                registry("桃園市", [
                    school(1, "桃園市", "桃園區", "乙國小")
                ]),
                registry("臺北市"),
            ])

    def test_merge_follows_common_postal_district_order(self):
        merged = merge_registries([
            registry("臺北市"),
            registry("桃園市"),
            registry("臺中市", [
                school(1, "臺中市", "大甲區", "甲國小"),
                school(2, "臺中市", "北區", "乙國小"),
                school(3, "臺中市", "西區", "丙國小"),
                school(4, "臺中市", "大安區", "丁國小"),
            ]),
        ])
        self.assertEqual(
            [item["district"] for item in merged],
            ["西區", "北區", "大甲區", "大安區"],
        )

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
            school(1, "臺北市", "大安區", "甲國小"),
            school(2, "臺中市", "大安區", "乙國小"),
        ]
        groups = build_refresh_groups(
            schools,
            {"groups": [{"id": 1, "districts": ["大安區"], "expectedSchoolCount": 1}]},
            target_group_size=80,
        )
        self.assertEqual([group["city"] for group in groups], ["臺北市", "臺中市"])
        self.assertEqual([group["expectedSchoolCount"] for group in groups], [1, 1])

    def test_refresh_groups_partition_cities_without_splitting_districts(self):
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
