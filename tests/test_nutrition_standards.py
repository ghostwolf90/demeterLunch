from __future__ import annotations

import unittest
from pathlib import Path

from src.dashboard import load_dashboard
from src.nutrition_standards import (
    DEFAULT_RULES_PATH,
    build_week_assessment,
    load_nutrition_rules,
    public_rule_metadata,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class NutritionStandardTests(unittest.TestCase):
    def test_reviewed_rules_match_the_elementary_pdf_tables(self) -> None:
        rules = load_nutrition_rules(DEFAULT_RULES_PATH)

        self.assertEqual(rules["source"]["revisionDate"], "2020-12-28")
        self.assertEqual(rules["source"]["review"]["status"], "reviewed")
        self.assertEqual(rules["weeklyAverageTolerancePercent"], 8)
        lower = rules["profiles"]["elementary_lower"]
        upper = rules["profiles"]["elementary_upper"]
        self.assertEqual(lower["nutrition"]["caloriesKcal"], {"minimum": 620, "maximum": 720})
        self.assertEqual(upper["nutrition"]["caloriesKcal"], {"minimum": 720, "maximum": 830})
        self.assertEqual(
            lower["foodContent"]["target"]["wholeGrains"]["minimum"],
            3.5,
        )
        self.assertEqual(
            upper["foodContent"]["transitional"]["proteinFoods"]["target"],
            2.5,
        )

    def test_week_assessment_uses_target_and_transitional_rules_separately(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db", "2026-10-05", "meat"
        )
        target = dashboard["nutritionAssessments"]["elementary_lower"]["target"]
        transitional = dashboard["nutritionAssessments"]["elementary_lower"]["transitional"]
        target_metrics = {item["key"]: item for item in target["metrics"]}
        transitional_metrics = {
            item["key"]: item for item in transitional["metrics"]
        }

        self.assertEqual(target_metrics["calories"]["status"], "within")
        self.assertEqual(target_metrics["wholeGrains"]["status"], "above")
        self.assertEqual(target_metrics["fruit"]["status"], "below")
        self.assertEqual(target_metrics["dairy"]["status"], "unavailable")
        self.assertEqual(transitional_metrics["wholeGrains"]["status"], "within")
        self.assertEqual(transitional_metrics["fruit"]["valueLabel"], "2 份／週")
        self.assertEqual(transitional_metrics["fruit"]["status"], "within")

    def test_upper_grade_profile_changes_the_same_week_result(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db", "2026-10-05", "meat"
        )
        lower = dashboard["nutritionAssessments"]["elementary_lower"]["target"]
        upper = dashboard["nutritionAssessments"]["elementary_upper"]["target"]
        lower_metrics = {item["key"]: item for item in lower["metrics"]}
        upper_metrics = {item["key"]: item for item in upper["metrics"]}

        self.assertEqual(lower_metrics["vegetables"]["status"], "within")
        self.assertEqual(upper_metrics["vegetables"]["status"], "below")
        self.assertEqual(lower_metrics["calories"]["status"], "within")
        self.assertEqual(upper_metrics["calories"]["status"], "below")

    def test_unavailable_nutrients_are_not_estimated(self) -> None:
        dashboard = load_dashboard(
            PROJECT_ROOT / "data" / "lunch.db", "2026-09-01", "vegetarian"
        )
        assessment = dashboard["nutritionAssessments"]["elementary_lower"]["target"]
        keys = {item["key"] for item in assessment["metrics"]}

        self.assertNotIn("sodiumMg", keys)
        self.assertNotIn("calciumMg", keys)
        self.assertIn("不推估", assessment["coverageNote"])
        dairy = next(item for item in assessment["metrics"] if item["key"] == "dairy")
        self.assertIsNone(dairy["value"])
        self.assertEqual(dairy["status"], "unavailable")

    def test_public_metadata_omits_internal_rule_detail_but_keeps_provenance(self) -> None:
        metadata = public_rule_metadata(load_nutrition_rules())

        self.assertEqual(metadata["source"]["publisher"], "教育部國民及學前教育署")
        self.assertEqual(metadata["source"]["reviewedPages"], [1, 2, 4])
        self.assertEqual(
            [item["id"] for item in metadata["gradeGroups"]],
            ["elementary_lower", "elementary_upper"],
        )

    def test_empty_week_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "空白供餐週"):
            build_week_assessment([], "elementary_lower", "target")


if __name__ == "__main__":
    unittest.main()
