import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HAN = re.compile(r"[\u3400-\u9fff]")


class InterfaceCopy(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skipped = []
        self.copy = set()

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skipped.append(tag)
        for name, value in attrs:
            if name in ("aria-label", "title", "placeholder", "alt") and value and HAN.search(value):
                self.copy.add(value.strip())

    def handle_endtag(self, tag):
        if self.skipped and self.skipped[-1] == tag:
            self.skipped.pop()

    def handle_data(self, data):
        if not self.skipped and HAN.search(data):
            self.copy.add(data.strip())


class LocalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = (ROOT / "web/locales/en.js").read_text()
        cls.english, _ = json.JSONDecoder().raw_decode(source.split("window.LunchEnglish = ", 1)[1])

    def test_all_static_pages_load_language_before_content_and_have_english_copy(self):
        for page in (ROOT / "web").rglob("*.html"):
            with self.subTest(page=page.relative_to(ROOT)):
                source = page.read_text()
                self.assertLess(source.index('/locales/en.js?'), source.index('/i18n.js?'))
                self.assertLess(source.index('/i18n.js?'), source.index('<body'))
                parser = InterfaceCopy()
                parser.feed(source)
                self.assertEqual(parser.copy - self.english.keys(), set())

    def test_family_education_and_recipes_have_english_copy(self):
        from src.family_content import FOOD_CARDS, RECIPES, VEGETARIAN_RECIPES
        from src.dashboard import DINNER_POOLS, DINNER_REASONS, VEGETARIAN_DINNER_POOL

        values = []
        for card in FOOD_CARDS:
            values.extend(card.get(key, "") for key in ("category", "ingredient", "title", "fact", "prompt"))
        for recipe in (*RECIPES, *VEGETARIAN_RECIPES):
            values.extend(recipe[key] for key in ("title", "time", "servings"))
            values.extend(recipe["ingredients"])
            values.extend(recipe["steps"])
        for pool in (*DINNER_POOLS.values(), VEGETARIAN_DINNER_POOL):
            values.extend(value for pair in pool for value in pair)
        values.extend(DINNER_REASONS.values())
        self.assertEqual({value for value in values if HAN.search(value) and value not in self.english}, set())

    def test_english_copy_contains_no_untranslated_chinese(self):
        self.assertEqual([key for key, value in self.english.items() if HAN.search(value)], [])


if __name__ == "__main__":
    unittest.main()
