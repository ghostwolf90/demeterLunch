import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class DistrictOrderingTests(unittest.TestCase):
    def test_school_selectors_prioritize_two_character_districts(self) -> None:
        app_js = (PROJECT_ROOT / "web" / "app.js").read_text(encoding="utf-8")
        account_panel_js = (PROJECT_ROOT / "web" / "account-panel.js").read_text(encoding="utf-8")

        self.assertIn("function districtNamePriority(district)", app_js)
        self.assertIn("districtGroupsTwoCharactersFirst([...groups.entries()])", app_js)
        self.assertIn(
            "districtNamePriority(first.district) - districtNamePriority(second.district)",
            app_js,
        )
        self.assertIn("function districtNamePriority(district)", account_panel_js)
        self.assertIn("const orderedGroups = [...groups.entries()].sort", account_panel_js)

    def test_public_school_directory_uses_the_same_priority(self) -> None:
        route = (PROJECT_ROOT / "app" / "schools" / "route.ts").read_text(encoding="utf-8")

        self.assertIn("function districtNamePriority(district: string)", route)
        self.assertIn(
            "districtNamePriority(firstDistrict) - districtNamePriority(secondDistrict)",
            route,
        )

    def test_priority_rule_keeps_existing_order_within_each_bucket(self) -> None:
        districts = ["西屯區", "西區", "東區", "北屯區", "南區"]
        ordered = sorted(
            enumerate(districts),
            key=lambda item: (0 if len(item[1]) == 2 else 1, item[0]),
        )

        self.assertEqual([district for _, district in ordered], ["西區", "東區", "南區", "西屯區", "北屯區"])


if __name__ == "__main__":
    unittest.main()
