import json
import tempfile
import unittest
from pathlib import Path

from scripts.serve import load_menus


class WebDataTests(unittest.TestCase):
    def test_load_menus_sorts_latest_first_and_builds_local_urls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for week, end_date in [(1, "2026-09-04"), (2, "2026-09-11")]:
                target = root / "2026" / "semester-1" / f"week-{week:02d}"
                target.mkdir(parents=True)
                (target / "menu-01.png").write_bytes(b"image")
                (target / "metadata.json").write_text(
                    json.dumps(
                        {
                            "id": str(week),
                            "week": week,
                            "startDate": "2026-09-01",
                            "endDate": end_date,
                            "images": [
                                {"file": "menu-01.png", "bytes": 5, "width": 1, "height": 1}
                            ],
                        }
                    ),
                    encoding="utf-8",
                )

            payload = load_menus(root)
            menus = payload["menus"]
            self.assertEqual([menu["week"] for menu in menus], [2, 1])
            self.assertEqual(payload["stats"]["menuCount"], 2)
            self.assertEqual(payload["stats"]["imageCount"], 2)
            self.assertEqual(
                menus[0]["images"][0]["url"],
                "/data/2026/semester-1/week-02/menu-01.png",
            )


if __name__ == "__main__":
    unittest.main()
