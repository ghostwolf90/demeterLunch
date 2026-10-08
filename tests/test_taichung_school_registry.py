from __future__ import annotations

import json
import unittest
from pathlib import Path

from src.fatrace_daily import load_school_registry


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FULL_REGISTRY = (
    PROJECT_ROOT / "data" / "reference" / "taichung-elementary-schools.json"
)
WEST_REGISTRY = (
    PROJECT_ROOT
    / "data"
    / "reference"
    / "taichung-west-elementary-schools.json"
)
ACTIVE_REGISTRY = (
    PROJECT_ROOT
    / "data"
    / "reference"
    / "taichung-active-elementary-schools.json"
)


class TaichungSchoolRegistryTests(unittest.TestCase):
    def test_full_registry_has_expected_citywide_coverage(self) -> None:
        payload = json.loads(FULL_REGISTRY.read_text(encoding="utf-8"))
        schools = load_school_registry(FULL_REGISTRY)

        self.assertEqual(payload["summary"]["city"], "臺中市")
        self.assertEqual(payload["summary"]["districtCount"], 29)
        self.assertEqual(payload["summary"]["schoolCount"], 242)
        self.assertEqual(len(schools), 242)
        self.assertEqual(len({school.district for school in schools}), 29)
        self.assertEqual(len({school.fatrace_school_id for school in schools}), 242)
        self.assertEqual(len({school.full_name for school in schools}), 242)

    def test_school_193615_is_south_district_sinyi_elementary(self) -> None:
        schools = load_school_registry(FULL_REGISTRY)
        school = next(
            school for school in schools if school.fatrace_school_id == 193615
        )

        self.assertEqual(school.district, "南區")
        self.assertEqual(school.name, "信義國小")
        self.assertEqual(school.full_name, "臺中市南區信義國小")

    def test_existing_west_district_registry_matches_full_registry(self) -> None:
        all_schools = load_school_registry(FULL_REGISTRY)
        west_schools = load_school_registry(WEST_REGISTRY)

        citywide_west = {
            (school.fatrace_school_id, school.full_name)
            for school in all_schools
            if school.district == "西區"
        }
        existing_west = {
            (school.fatrace_school_id, school.full_name) for school in west_schools
        }
        self.assertEqual(citywide_west, existing_west)

    def test_active_registry_contains_three_published_districts(self) -> None:
        schools = load_school_registry(ACTIVE_REGISTRY)

        self.assertEqual(len(schools), 27)
        self.assertEqual(
            {school.district for school in schools},
            {"東區", "西區", "西屯區"},
        )
        self.assertEqual(
            sum(school.district == "西區" for school in schools),
            6,
        )
        self.assertEqual(
            sum(school.district == "西屯區" for school in schools),
            15,
        )
        self.assertEqual(
            sum(school.district == "東區" for school in schools),
            6,
        )
        self.assertIn(
            (64742519, "私立麗喆國(中)小"),
            {(school.fatrace_school_id, school.name) for school in schools},
        )


if __name__ == "__main__":
    unittest.main()
