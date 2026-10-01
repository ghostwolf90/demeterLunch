import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from src.models import Article, ParsedTitle
from src.storage import ArticleStorage


class StorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.storage = ArticleStorage(Path(self.temp_dir.name) / "raw")
        self.article = Article(
            id="123",
            title="115學年度第1學期第2週0907-0911菜單及營養素分析",
            url="https://example.test/post",
            published_at="2026-09-03T01:03:02-07:00",
            updated_at="2026-09-03T01:03:02-07:00",
            parsed_title=ParsedTitle(
                school_year=115,
                semester=1,
                week=2,
                week_end=None,
                start_date=date(2026, 9, 7),
                end_date=date(2026, 9, 11),
            ),
        )

    def test_path_uses_school_year_and_week(self) -> None:
        path = self.storage.article_path(self.article)
        self.assertTrue(str(path).endswith("2026/semester-1/week-02"))

    def test_commit_and_current_detection(self) -> None:
        target = self.storage.article_path(self.article)
        staging = self.storage.create_staging_dir(target)
        (staging / "menu-01.png").write_bytes(b"image")
        metadata = self.article.metadata([{"file": "menu-01.png"}])
        self.storage.write_metadata(staging, metadata)
        self.storage.commit(staging, target)

        self.assertTrue(self.storage.is_current(self.article, target))
        saved = json.loads((target / "metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["id"], "123")

    def test_missing_image_forces_refresh(self) -> None:
        target = self.storage.article_path(self.article)
        target.mkdir(parents=True)
        (target / "metadata.json").write_text(
            json.dumps(self.article.metadata([{"file": "missing.png"}])),
            encoding="utf-8",
        )
        self.assertFalse(self.storage.is_current(self.article, target))


if __name__ == "__main__":
    unittest.main()

