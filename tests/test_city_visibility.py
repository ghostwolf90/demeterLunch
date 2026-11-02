import json
import tempfile
import unittest
from pathlib import Path

from src.city_visibility import (
    enabled_city_names,
    load_city_visibility,
    set_city_visibility,
    visible_schools,
)


class CityVisibilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.registry_path = self.root / "schools.json"
        self.config_path = self.root / "visibility.json"
        self.schools = [
            {"city": "甲市", "name": "甲一"},
            {"city": "甲市", "name": "甲二"},
            {"city": "乙縣", "name": "乙一"},
        ]
        self.registry_path.write_text(
            json.dumps({"schools": self.schools}, ensure_ascii=False),
            encoding="utf-8",
        )
        self.config_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "cities": [{"name": "甲市", "enabled": True}],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_missing_city_is_disabled_until_explicitly_enabled(self) -> None:
        settings = load_city_visibility(self.config_path, self.registry_path)
        self.assertEqual(
            settings,
            [
                {"name": "甲市", "enabled": True, "schoolCount": 2},
                {"name": "乙縣", "enabled": False, "schoolCount": 1},
            ],
        )
        self.assertEqual(enabled_city_names(self.config_path, self.registry_path), {"甲市"})
        self.assertEqual(
            [school["name"] for school in visible_schools(
                self.schools, self.config_path, self.registry_path
            )],
            ["甲一", "甲二"],
        )

    def test_switch_update_is_persisted_and_returns_school_counts(self) -> None:
        settings = set_city_visibility(
            "乙縣", True, self.config_path, self.registry_path
        )
        self.assertTrue(next(item for item in settings if item["name"] == "乙縣")["enabled"])
        saved = json.loads(self.config_path.read_text(encoding="utf-8"))
        self.assertEqual(
            saved["cities"],
            [
                {"name": "甲市", "enabled": True},
                {"name": "乙縣", "enabled": True},
            ],
        )

    def test_unknown_city_and_non_boolean_value_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "學校名冊沒有"):
            set_city_visibility("不存在", True, self.config_path, self.registry_path)
        with self.assertRaisesRegex(ValueError, "布林值"):
            set_city_visibility("甲市", 1, self.config_path, self.registry_path)


if __name__ == "__main__":
    unittest.main()
