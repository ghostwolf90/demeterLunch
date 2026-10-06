from __future__ import annotations

import sqlite3
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from src.dashboard import load_dashboard
from src.family_content import FOOD_CARDS, GUIDE_CARDS
from src.menu_data import (
    build_database,
    classify_items,
    load_reviewed_traceability,
    load_reviewed_weeks,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PARSED_ROOT = PROJECT_ROOT / "data" / "parsed"


class ReviewedMenuTests(unittest.TestCase):
    def test_nutritionist_guide_cards_are_concise_and_parent_friendly(self) -> None:
        self.assertGreaterEqual(len(GUIDE_CARDS), 30)
        for card in GUIDE_CARDS:
            self.assertIn(card["category"], {"吃得更懂", "午餐怎麼把關"})
            self.assertLessEqual(len(card["fact"]), 45)
            self.assertLessEqual(len(card["prompt"]), 25)
            self.assertIn("schoollunchdemo.k12ea.gov.tw", card["source"]["url"])
            self.assertNotIn("image", card)

    def test_health_tip_food_cards_are_concise_and_link_the_exact_article(self) -> None:
        health_cards = [
            card
            for card in FOOD_CARDS
            if "fatraceschool.k12ea.gov.tw" in card.get("source", {}).get("url", "")
        ]

        self.assertGreaterEqual(len(health_cards), 10)
        for card in health_cards:
            self.assertLessEqual(len(card["fact"]), 45)
            self.assertLessEqual(len(card["prompt"]), 25)
            self.assertIn("news-detail.html?newsId=", card["source"]["url"])
            self.assertNotIn("image", card)

    def test_october_fifth_uses_the_official_non_heading_cabbage_tip(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-10-05")
        card = dashboard["foodEducation"]

        self.assertEqual(card["ingredient"], "不結球白菜")
        self.assertEqual(card["title"], "葉子不會包成一顆球")
        self.assertEqual(card["category"], "吃得更懂")
        self.assertTrue(card["source"]["url"].endswith("newsId=6200"))

    def test_reviewed_data_covers_six_weeks_and_both_meal_types(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        self.assertEqual(len(weeks), 6)
        self.assertEqual(sum(len(week["days"]) for week in weeks), 27)
        self.assertEqual(
            sum(
                len(day["variants"])
                for week in weeks
                for day in week["days"]
            ),
            54,
        )

    def test_fruit_is_generic_and_served_once_on_tuesday_and_thursday(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        for week in weeks:
            for day in week["days"]:
                expected_servings = 1 if day["weekday"] in {"星期二", "星期四"} else 0
                for variant in day["variants"].values():
                    self.assertEqual(variant["nutrition"]["fruitServings"], expected_servings)
                    self.assertEqual(
                        variant["meal"]["fruit"],
                        "水果" if expected_servings else None,
                    )

    def test_item_classification_detects_proteins_and_methods(self) -> None:
        tags = classify_items(["香酥雞排", "咖哩蝦仁白菜"])
        self.assertEqual(tags, ["chicken", "fried", "seafood"])

    def test_database_build_is_queryable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "lunch.db"
            stats = build_database(PARSED_ROOT, database)
            self.assertEqual(stats["days"], 27)
            self.assertEqual(stats["variants"], 54)
            self.assertEqual(stats["recipeIngredients"], 900)
            self.assertEqual(stats["traceableIngredients"], 21)
            with sqlite3.connect(database) as connection:
                row = connection.execute(
                    """
                    SELECT main_dish, calories_kcal FROM daily_menus
                    WHERE date = ? AND meal_type = 'meat'
                    """,
                    ("2026-10-01",),
                ).fetchone()
                meal_type_count = connection.execute(
                    "SELECT COUNT(DISTINCT meal_type) FROM daily_menus"
                ).fetchone()[0]
                traceability_count = connection.execute(
                    "SELECT COUNT(*) FROM dish_ingredients"
                ).fetchone()[0]
                recipe_dish_count = connection.execute(
                    "SELECT COUNT(*) FROM recipe_dishes"
                ).fetchone()[0]
                recipe_ingredient_count = connection.execute(
                    "SELECT COUNT(*) FROM recipe_ingredients"
                ).fetchone()[0]
            self.assertEqual(row, ("可樂豬腳", 683.9))
            self.assertEqual(meal_type_count, 2)
            self.assertEqual(traceability_count, 21)
            self.assertEqual(recipe_dish_count, 312)
            self.assertEqual(recipe_ingredient_count, 900)

    def test_reviewed_traceability_links_dishes_suppliers_and_certifications(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        available_dates = {
            day["date"] for week in weeks for day in week["days"]
        }
        packages = load_reviewed_traceability(PARSED_ROOT, available_dates)
        self.assertEqual(len(packages), 2)
        dishes = packages[0]["days"][0]["dishes"]
        mushrooms = next(dish for dish in dishes if dish["name"] == "砂鍋魚")
        enoki = next(
            item for item in mushrooms["ingredients"] if item["name"] == "金針菇"
        )
        self.assertEqual(enoki["supplierBusinessId"], "tax-25095192")
        self.assertEqual(enoki["certificationId"], "organic-1-007-118010")

    def test_october_fifth_traceability_uses_reviewed_same_day_records(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db",
            "2026-10-05",
            "meat",
        )
        traceability = dashboard["traceability"]

        self.assertEqual(traceability["status"], "verified")
        self.assertEqual(traceability["dataDate"], "2026-10-05")
        self.assertEqual(traceability["ingredientCount"], 7)
        cabbage_dish = next(
            dish for dish in traceability["dishes"] if dish["name"] == "快炒時蔬"
        )
        cabbage = cabbage_dish["ingredients"][0]
        self.assertEqual(cabbage["name"], "蚵仔白菜")
        self.assertEqual(cabbage["certification"]["number"], "01138353264238")
        self.assertEqual(cabbage["certification"]["operator"]["name"], "林珍綠")
        self.assertEqual(cabbage["certification"]["validUntil"], "2029-04-27")

    def test_october_fifth_vegetarian_traceability_does_not_match_pork_blood(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db",
            "2026-10-05",
            "vegetarian",
        )
        traceability = dashboard["traceability"]

        self.assertEqual(traceability["status"], "verified")
        bean_curd = next(
            dish for dish in traceability["dishes"] if dish["name"] == "春水堂豆干"
        )
        ingredient_names = {item["name"] for item in bean_curd["ingredients"]}
        self.assertEqual(ingredient_names, {"豆干", "杏鮑菇"})
        self.assertNotIn("豬血糕", ingredient_names)

    def test_dashboard_selects_day_and_creates_dinner_idea(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-10-01")
        self.assertEqual(dashboard["selected"]["meal"]["mainDish"], "可樂豬腳")
        self.assertEqual(len(dashboard["dinnerSuggestion"]["recommendations"]), 2)
        self.assertNotIn("清蒸魚", dashboard["dinnerSuggestion"]["recommendations"])
        self.assertTrue(dashboard["foodEducation"]["ingredient"])
        self.assertTrue(dashboard["foodEducation"]["prompt"])
        self.assertEqual(dashboard["homeRecipe"]["title"], "家庭版可樂豬腳")
        self.assertIn("非校方", dashboard["homeRecipe"]["note"])
        self.assertEqual(dashboard["traceability"]["status"], "matched_reference")
        self.assertIsNone(dashboard["traceability"]["dataDate"])
        self.assertGreater(len(dashboard["traceability"]["dishes"]), 0)
        self.assertIn("僅供來源參考", dashboard["traceability"]["notice"])
        self.assertEqual(dashboard["totalDays"], 27)

    def test_dashboard_switches_to_vegetarian_menu_and_detail_image(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db",
            "2026-10-02",
            "vegetarian",
        )
        selected = dashboard["selected"]
        self.assertEqual(dashboard["mealTypeLabel"], "素食")
        self.assertEqual(selected["meal"]["mainDish"], "香酥印干拼盤")
        self.assertEqual(selected["nutrition"]["caloriesKcal"], 653.84)
        self.assertTrue(selected["source"]["detailImage"].endswith("menu-03.jpg"))
        self.assertEqual(len(selected["recipeDetails"]), 6)
        organic_dish = next(
            dish for dish in selected["recipeDetails"] if dish["name"] == "有機青菜"
        )
        organic_ingredient = organic_dish["ingredients"][0]
        self.assertEqual(organic_ingredient["name"], "有機味美菜")
        self.assertEqual(organic_ingredient["quantityText"], "80 公克")
        self.assertEqual(organic_ingredient["traceabilityStatus"], "menu_claim")
        self.assertIn("organic_text", organic_ingredient["claims"])
        animal_keywords = ("雞", "豬", "魚", "蝦", "蛤蜊", "海鮮")
        self.assertFalse(
            any(
                keyword in suggestion
                for suggestion in dashboard["dinnerSuggestion"]["recommendations"]
                for keyword in animal_keywords
            )
        )

    def test_vegetarian_traceability_excludes_unmatched_meat_dishes(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db",
            "2026-08-31",
            "vegetarian",
        )
        traceability = dashboard["traceability"]
        self.assertEqual(traceability["status"], "verified")
        self.assertEqual(traceability["ingredientCount"], 10)
        dish_names = [dish["name"] for dish in traceability["dishes"]]
        self.assertEqual(
            dish_names,
            ["小米飯", "麻婆豆腐", "油菜", "砂鍋高麗", "蘿蔔阿給湯"],
        )
        self.assertNotIn("台式大雞腿", dish_names)
        self.assertNotIn("砂鍋魚", dish_names)
        meat_ingredients = {
            "豬絞肉", "豬上肩肉", "骨腿", "鯊魚"
        }
        self.assertTrue(
            meat_ingredients.isdisjoint(
                ingredient["name"]
                for dish in traceability["dishes"]
                for ingredient in dish["ingredients"]
            )
        )

    def test_dashboard_exposes_verified_enoki_traceability(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-08-31")
        traceability = dashboard["traceability"]
        self.assertEqual(traceability["status"], "verified")
        self.assertEqual(traceability["ingredientCount"], 14)
        self.assertEqual(traceability["certifiedIngredientCount"], 12)
        fish_dish = next(
            dish for dish in traceability["dishes"] if dish["name"] == "砂鍋魚"
        )
        enoki = next(
            item for item in fish_dish["ingredients"] if item["name"] == "金針菇"
        )
        self.assertEqual(enoki["supplier"]["name"], "昱品美食股份有限公司")
        self.assertEqual(
            enoki["certification"]["operator"]["name"], "戴養菌園農場"
        )

    def test_week_marks_only_exact_date_traceability_as_verified(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-09-01")
        statuses = {
            day["date"]: (
                day["traceabilityStatus"], day["traceableIngredientCount"]
            )
            for day in dashboard["week"]
        }
        self.assertEqual(statuses["2026-08-31"], ("verified", 14))
        self.assertEqual(statuses["2026-09-01"], ("matched_reference", 1))

    def test_dashboard_uses_only_historical_ingredients_matched_to_menu(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-09-29")
        traceability = dashboard["traceability"]
        self.assertEqual(traceability["status"], "matched_reference")
        self.assertEqual(traceability["referenceDates"], ["2026-08-31"])
        self.assertEqual(traceability["ingredientCount"], 5)
        self.assertEqual(len(traceability["dishes"]), 3)
        dish = next(
            dish
            for dish in traceability["dishes"]
            if dish["name"] == "金菇味噌排骨湯"
        )
        self.assertEqual(dish["name"], "金菇味噌排骨湯")
        ingredient = next(
            ingredient
            for ingredient in dish["ingredients"]
            if ingredient["name"] == "金針菇"
        )
        self.assertEqual(ingredient["name"], "金針菇")
        self.assertEqual(ingredient["referenceDishName"], "砂鍋魚")
        self.assertIn("金針菇", ingredient["matchReason"])
        self.assertEqual(
            ingredient["certification"]["operator"]["name"], "戴養菌園農場"
        )
        week_statuses = {
            day["date"]: day["traceabilityStatus"] for day in dashboard["week"]
        }
        self.assertEqual(week_statuses["2026-09-29"], "matched_reference")
        self.assertEqual(week_statuses["2026-10-02"], "matched_reference")

    def test_every_menu_variant_has_reviewed_dishes_and_quantities(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        for week in weeks:
            for day in week["days"]:
                for meal_type, variant in day["variants"].items():
                    with self.subTest(date=day["date"], meal_type=meal_type):
                        self.assertGreater(len(variant["dishes"]), 0)
                        for dish in variant["dishes"]:
                            self.assertGreater(len(dish["ingredients"]), 0)
                            for ingredient in dish["ingredients"]:
                                self.assertTrue(ingredient["quantityText"])

    def test_source_anomaly_in_vegetarian_sheet_is_preserved(self) -> None:
        weeks = load_reviewed_weeks(PARSED_ROOT)
        day = next(
            day
            for week in weeks
            for day in week["days"]
            if day["date"] == "2026-10-05"
        )
        spring_water_tofu = next(
            dish
            for dish in day["variants"]["vegetarian"]["dishes"]
            if dish["name"] == "春水堂豆干"
        )
        self.assertIn(
            "柴魚",
            [ingredient["name"] for ingredient in spring_water_tofu["ingredients"]],
        )

    def test_every_day_has_food_education_and_home_recipe(self) -> None:
        database = PROJECT_ROOT / "data" / "lunch.db"
        with sqlite3.connect(database) as connection:
            dates = [
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT date FROM daily_menus ORDER BY date"
                )
            ]

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
            dates = [
                row[0]
                for row in connection.execute(
                    "SELECT DISTINCT date FROM daily_menus ORDER BY date"
                )
            ]
        first_choices = [
            load_dashboard(database, menu_date)["dinnerSuggestion"]["recommendations"][0]
            for menu_date in dates
        ]
        counts = Counter(first_choices)
        self.assertGreaterEqual(len(counts), 12)
        self.assertLessEqual(max(counts.values()), 4)
        self.assertNotIn("清蒸魚", counts)

    def test_dashboard_falls_back_to_nearest_previous_school_day(self) -> None:
        dashboard = load_dashboard(PROJECT_ROOT / "data" / "lunch.db", "2026-09-27")
        self.assertTrue(dashboard["isFallback"])
        self.assertEqual(dashboard["selected"]["date"], "2026-09-24")


if __name__ == "__main__":
    unittest.main()
