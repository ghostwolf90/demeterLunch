from __future__ import annotations

import unittest

from scripts.build_active_school_registry import (
    build_refresh_groups,
    merge_registries,
    partition_city_districts,
)


def school(school_id, city, district, name):
    return {
        "city": city,
        "district": district,
        "level": "國小",
        "name": name,
        "fullName": city + district + name,
        "fatraceSchoolId": school_id,
    }


class ActiveSchoolRegistryTests(unittest.TestCase):
    def test_merge_keeps_taichung_before_tainan(self):
        merged = merge_registries([
            {"schemaVersion": 1, "summary": {"city": "臺南市"}, "schools": [
                school(2, "臺南市", "東區", "乙國小")
            ]},
            {"schemaVersion": 1, "summary": {"city": "臺中市"}, "schools": [
                school(1, "臺中市", "西區", "甲國小")
            ]},
        ])
        self.assertEqual([item["city"] for item in merged], ["臺中市", "臺南市"])

    def test_duplicate_school_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "School ID"):
            merge_registries([
                {"schemaVersion": 1, "summary": {"city": "臺中市"}, "schools": [
                    school(1, "臺中市", "西區", "甲國小")
                ]},
                {"schemaVersion": 1, "summary": {"city": "臺南市"}, "schools": [
                    school(1, "臺南市", "東區", "乙國小")
                ]},
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


if __name__ == "__main__":
    unittest.main()
