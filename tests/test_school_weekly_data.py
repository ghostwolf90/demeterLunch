from __future__ import annotations

import unittest
from pathlib import Path

from src.school_weekly_data import (
    load_reviewed_school_weekly_menus,
    weekly_menu_image_paths,
    weekly_menu_overlays,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PARSED_ROOT = PROJECT_ROOT / "data" / "parsed"


class ReviewedSchoolWeeklyMenuTests(unittest.TestCase):
    def test_nanxing_week_seven_is_reviewed_and_complete(self) -> None:
        packages = load_reviewed_school_weekly_menus(PARSED_ROOT)
        nanxing = next(
            package
            for package in packages
            if package["school"]["fatraceSchoolId"] == 64754668
        )

        self.assertEqual(nanxing["week"], 7)
        self.assertEqual(len(nanxing["days"]), 5)
        self.assertEqual(nanxing["days"][-1]["dishes"][1]["name"], "宮保雞丁")
        self.assertEqual(
            [
                snapshot["nutrition"]["caloriesKcal"]
                for snapshot in nanxing["days"][-1]["nutritionSnapshots"]
            ],
            [654, 710],
        )
        self.assertIsNone(
            nanxing["days"][-1]["nutritionSnapshots"][0]["nutrition"]["milkServings"]
        )

    def test_overlays_keep_source_images_and_school_scope(self) -> None:
        overlays, school_ids = weekly_menu_overlays(PARSED_ROOT)
        overlay = overlays[(64754668, "2026-10-16")]

        self.assertIn(64754668, school_ids)
        self.assertEqual(overlay["dishes"][0]["servingText"], "250–300 公克")
        self.assertTrue(overlay["source"]["images"]["overview"].startswith("/data/"))
        self.assertEqual(len(weekly_menu_image_paths(PARSED_ROOT)), 2)


if __name__ == "__main__":
    unittest.main()
