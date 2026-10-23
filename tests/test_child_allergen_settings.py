import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ChildAllergenSettingsTests(unittest.TestCase):
    def read(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_child_preferences_are_stored_in_d1_with_a_generated_migration(self) -> None:
        schema = self.read("db/schema.ts")
        migration = self.read("drizzle/0009_icy_fenris.sql")

        self.assertIn('allergenCodes: text("allergen_codes").notNull().default("[]")', schema)
        self.assertIn("ALTER TABLE `child_profiles` ADD `allergen_codes`", migration)
        self.assertIn("DEFAULT '[]' NOT NULL", migration)

    def test_child_api_validates_and_returns_each_childs_preferences(self) -> None:
        helper = self.read("lib/allergens.ts")
        mutation = self.read("app/api/account/child/route.ts")
        account = self.read("app/api/account/route.ts")

        self.assertIn('"crustaceans"', helper)
        self.assertIn('"sulfites"', helper)
        self.assertIn("normalizeAllergenCodes(record.allergenCodes)", mutation)
        self.assertIn("JSON.stringify(allergenCodes)", mutation)
        self.assertIn("allergen_codes = ?", mutation)
        self.assertIn("parseStoredAllergenCodes(child.allergen_codes)", account)

    def test_child_form_can_create_and_edit_attention_foods(self) -> None:
        index = self.read("web/index.html")
        app = self.read("web/app.js")

        self.assertIn("需要留意的食物", index)
        self.assertEqual(index.count('name="childAllergen"'), 11)
        self.assertIn("選填，可隨時修改", index)
        self.assertIn("setChildAllergenSelection(account.child.allergenCodes)", app)
        self.assertIn("allergenCodes: selectedChildAllergenCodes()", app)

    def test_alerts_wait_for_same_day_data_and_only_use_the_childs_school(self) -> None:
        index = self.read("web/index.html")
        app = self.read("web/app.js")

        self.assertIn("只在取得當日資料後顯示提醒，不會前一晚預測", index)
        self.assertIn("未顯示提醒不代表餐點不含該食物", index)
        self.assertIn("if (!state.account.child || !isViewingChildSchool()) return []", app)
        self.assertIn("renderAllergenNotice(", app)
        self.assertIn("officialIngredientEvidence", app)
        self.assertIn("personalizeAllergens: !dashboard.isFallback && !dashboard.isSample", app)
        self.assertIn("請再向校方確認實際食材與製程", app)


if __name__ == "__main__":
    unittest.main()
