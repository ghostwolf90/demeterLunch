import unittest
import json
from pathlib import Path

from scripts.build_city_service_catalog import (
    TAIWAN_CITY_ORDER,
    TAIWAN_DISTRICT_ORDER,
    district_order_key,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class DistrictOrderingTests(unittest.TestCase):
    def test_reference_covers_all_taiwan_cities_and_districts(self) -> None:
        self.assertEqual(len(TAIWAN_CITY_ORDER), 22)
        self.assertEqual(set(TAIWAN_CITY_ORDER), set(TAIWAN_DISTRICT_ORDER))
        self.assertEqual(sum(map(len, TAIWAN_DISTRICT_ORDER.values())), 368)
        self.assertEqual(
            TAIWAN_CITY_ORDER[:9],
            (
                "基隆市",
                "臺北市",
                "新北市",
                "桃園市",
                "新竹市",
                "新竹縣",
                "宜蘭縣",
                "苗栗縣",
                "臺中市",
            ),
        )

    def test_district_key_prioritizes_short_names_then_geographic_order(self) -> None:
        self.assertLess(
            district_order_key("臺中市", "北區"),
            district_order_key("臺中市", "大甲區"),
        )
        self.assertLess(
            district_order_key("臺中市", "大甲區"),
            district_order_key("臺中市", "大安區"),
        )

    def test_active_registry_follows_city_and_district_name_length_order(self) -> None:
        registry = json.loads(
            (PROJECT_ROOT / "data/reference/active-elementary-schools.json").read_text(
                encoding="utf-8"
            )
        )
        active_cities = {school["city"] for school in registry["schools"]}
        expected_cities = [city for city in TAIWAN_CITY_ORDER if city in active_cities]
        self.assertEqual(registry["cityOrder"], expected_cities)
        self.assertEqual(
            list(dict.fromkeys(school["city"] for school in registry["schools"])),
            expected_cities,
        )
        for city in expected_cities:
            districts = list(
                dict.fromkeys(
                    school["district"]
                    for school in registry["schools"]
                    if school["city"] == city
                )
            )
            expected_districts = sorted(
                set(districts),
                key=lambda district: district_order_key(city, district),
            )
            self.assertEqual(districts, expected_districts, city)

    def test_school_selectors_preserve_registry_order(self) -> None:
        app_js = (PROJECT_ROOT / "web" / "app.js").read_text(encoding="utf-8")
        account_panel_js = (PROJECT_ROOT / "web" / "account-panel.js").read_text(encoding="utf-8")

        self.assertNotIn("districtNamePriority", app_js)
        self.assertNotIn("districtGroupsTwoCharactersFirst", app_js)
        self.assertIn("for (const [label, schools] of groups)", app_js)
        self.assertNotIn("districtNamePriority", account_panel_js)
        self.assertIn("for (const [label, schools] of groups)", account_panel_js)

    def test_public_school_directory_preserves_registry_order(self) -> None:
        route = (PROJECT_ROOT / "app" / "schools" / "route.ts").read_text(encoding="utf-8")

        self.assertNotIn("districtNamePriority", route)
        self.assertIn(
            "[...Map.groupBy(citySchools, (school) => school.district).entries()].map(",
            route,
        )


if __name__ == "__main__":
    unittest.main()
