from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from scripts.prepare_site_publish import (
    SitePublishPreparationError,
    overlay_daily_data,
)


class PrepareSitePublishTests(unittest.TestCase):
    def _hosting(self, root: Path, project_id: str) -> None:
        path = root / ".openai" / "hosting.json"
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps({"project_id": project_id}), encoding="utf-8")

    def test_overlays_only_requested_reviewed_date(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            checkout = root / "checkout"
            (checkout / ".git").mkdir(parents=True)
            self._hosting(source, "site-1")
            self._hosting(checkout, "site-1")
            report = source / "data/raw/fatrace-daily/2026-10-12/report.json"
            report.parent.mkdir(parents=True)
            report.write_text(
                json.dumps(
                    {
                        "mealDate": "2026-10-12",
                        "summary": {
                            "available": 1,
                            "noMeal": 0,
                            "notPublished": 1,
                            "failed": 0,
                        },
                    }
                ),
                encoding="utf-8",
            )
            reviewed = source / "data/parsed/schools/fatrace/193609/2026-10-12.json"
            reviewed.parent.mkdir(parents=True)
            reviewed.write_text('{"status":"available"}', encoding="utf-8")
            older = source / "data/parsed/schools/fatrace/193609/2026-10-08.json"
            older.write_text('{"status":"available"}', encoding="utf-8")

            copied = overlay_daily_data(source, checkout, date(2026, 10, 12))

            self.assertEqual(copied, 1)
            self.assertTrue(
                (checkout / "data/parsed/schools/fatrace/193609/2026-10-12.json").is_file()
            )
            self.assertFalse(
                (checkout / "data/parsed/schools/fatrace/193609/2026-10-08.json").exists()
            )

    def test_rejects_mismatched_site_project(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            checkout = root / "checkout"
            (checkout / ".git").mkdir(parents=True)
            self._hosting(source, "site-1")
            self._hosting(checkout, "site-2")

            with self.assertRaises(SitePublishPreparationError):
                overlay_daily_data(source, checkout, date(2026, 10, 12))


if __name__ == "__main__":
    unittest.main()
