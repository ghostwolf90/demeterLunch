import unittest
import json
from pathlib import Path

from scripts.build_city_service_catalog import (
    TAIWAN_CITY_ORDER,
    TAIWAN_DISTRICT_ORDER,
    TAIWAN_DISTRICT_POSTAL_CODES,
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

    def test_district_key_follows_common_postal_order(self) -> None:
        self.assertEqual(
            TAIWAN_DISTRICT_ORDER["臺中市"][:8],
            (
                "中區",
                "東區",
                "南區",
                "西區",
                "北區",
                "北屯區",
                "西屯區",
                "南屯區",
            ),
        )
        self.assertLess(
            district_order_key("臺中市", "南屯區"),
            district_order_key("臺中市", "太平區"),
        )

    def test_every_city_is_in_non_decreasing_postal_code_order(self) -> None:
        for city, districts in TAIWAN_DISTRICT_ORDER.items():
            postal_codes = [
                TAIWAN_DISTRICT_POSTAL_CODES[city][district]
                for district in districts
            ]
            self.assertEqual(postal_codes, sorted(postal_codes), city)

    def test_other_cities_follow_familiar_postal_sequences(self) -> None:
        expected_prefixes = {
            "臺北市": ("中正區", "大同區", "中山區", "松山區"),
            "新北市": ("萬里區", "金山區", "板橋區", "汐止區"),
            "桃園市": ("中壢區", "平鎮區", "龍潭區", "楊梅區"),
            "苗栗縣": ("竹南鎮", "頭份市", "三灣鄉", "南庄鄉"),
            "彰化縣": ("彰化市", "芬園鄉", "花壇鄉", "秀水鄉"),
            "臺南市": ("中西區", "東區", "南區", "北區"),
            "高雄市": ("新興區", "前金區", "苓雅區", "鹽埕區"),
        }
        for city, prefix in expected_prefixes.items():
            self.assertEqual(TAIWAN_DISTRICT_ORDER[city][: len(prefix)], prefix)

    def test_active_registry_follows_city_and_postal_district_order(self) -> None:
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
