from __future__ import annotations

import sqlite3
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from src.dashboard import load_dashboard
from src.menu_data import build_database, classify_items, load_reviewed_weeks


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PARSED_ROOT = PROJECT_ROOT / "data" / "parsed"


class ReviewedMenuTests(unittest.TestCase):
    def test_reviewed_data_covers_five_weeks_and_23_days(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        self.assertEqual(len(weeks), 5)
        self.assertEqual(sum(len(week["days"]) for week in weeks), 23)

    def test_item_classification_detects_proteins_and_methods(self) -> None:
        tags = classify_items(["香酥雞排", "咖哩蝦仁白菜"])
        self.assertEqual(tags, ["chicken", "fried", "seafood"])

    def test_database_build_is_queryable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "lunch.db"
            stats = build_database(PARSED_ROOT, database)
            self.assertEqual(stats["days"], 23)
            with sqlite3.connect(database) as connection:
                row = connection.execute(
                    "SELECT main_dish, calories_kcal FROM daily_menus WHERE date = ?",
                    ("2026-10-01",),
                ).fetchone()
            self.assertEqual(row, ("可樂豬腳", 684.0))

    def test_dashboard_selects_day_and_creates_dinner_idea(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-10-01")
        self.assertEqual(dashboard["selected"]["meal"]["mainDish"], "可樂豬腳")
        self.assertEqual(len(dashboard["dinnerSuggestion"]["recommendations"]), 2)
        self.assertNotIn("清蒸魚", dashboard["dinnerSuggestion"]["recommendations"])
        self.assertTrue(dashboard["foodEducation"]["ingredient"])
        self.assertTrue(dashboard["foodEducation"]["prompt"])
        self.assertEqual(dashboard["homeRecipe"]["title"], "家庭版可樂豬腳")
        self.assertIn("非校方", dashboard["homeRecipe"]["note"])
        self.assertEqual(dashboard["totalDays"], 23)

    def test_every_day_has_food_education_and_home_recipe(self) -> None:
        database = PROJECT_ROOT / "data" / "lunch.db"
        with sqlite3.connect(database) as connection:
            dates = [row[0] for row in connection.execute("SELECT date FROM daily_menus")]

        food_topics = set()
        recipe_titles = set()
        for menu_date in dates:
            dashboard = load_dashboard(database, menu_date)
            food_topics.add(dashboard["foodEducation"]["ingredient"])
            recipe_titles.add(dashboard["homeRecipe"]["title"])
            self.assertTrue(dashboard["foodEducation"]["prompt"])
            self.assertGreaterEqual(len(dashboard["homeRecipe"]["steps"]), 4)

        self.assertGreaterEqual(len(food_topics), 10)
        self.assertGreaterEqual(len(recipe_titles), 8)

    def test_dinner_ideas_rotate_instead_of_repeating_one_default(self) -> None:
        database = PROJECT_ROOT / "data" / "lunch.db"
        with sqlite3.connect(database) as connection:
            dates = [row[0] for row in connection.execute("SELECT date FROM daily_menus")]
        first_choices = [
            load_dashboard(database, menu_date)["dinnerSuggestion"]["recommendations"][0]
            for menu_date in dates
        ]
        counts = Counter(first_choices)
        self.assertGreaterEqual(len(counts), 12)
        self.assertLessEqual(max(counts.values()), 3)
        self.assertNotIn("清蒸魚", counts)

    def test_dashboard_falls_back_to_nearest_previous_school_day(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-09-27")
        self.assertTrue(dashboard["isFallback"])
        self.assertEqual(dashboard["selected"]["date"], "2026-09-24")


if __name__ == "__main__":
    unittest.main()
