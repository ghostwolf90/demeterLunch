from __future__ import annotations

import unittest
from datetime import date

from src.models import Article, ImageSource, ParsedTitle
from src.update_monitor import article_marker, build_monitor_state, classify_change


def make_article(*, article_id: str = "123", updated_at: str = "2026-10-01T10:00:00Z") -> Article:
    return Article(
        id=article_id,
        title="115學年度第1學期第6週1005-1009菜單及營養素分析",
        url="https://example.test/menu",
        published_at="2026-10-01T09:00:00Z",
        updated_at=updated_at,
        images=[ImageSource("https://example.test/a.png", "https://example.test/a.png")],
        parsed_title=ParsedTitle(115, 1, 6, None, date(2026, 10, 5), date(2026, 10, 9)),
    )


class UpdateMonitorTests(unittest.TestCase):
    def test_first_check_initializes_without_reporting_a_new_menu(self) -> None:
        marker = article_marker(make_article())
        self.assertEqual(classify_change(None, marker), "initialized")
        self.assertFalse(build_monitor_state(marker, "initialized")["changed"])

    def test_new_article_and_updated_article_are_distinguished(self) -> None:
        original = article_marker(make_article())
        previous = {"article": original}
        self.assertEqual(
            classify_change(previous, article_marker(make_article(article_id="456"))),
            "new",
        )
        self.assertEqual(
            classify_change(
                previous,
                article_marker(make_article(updated_at="2026-10-01T11:00:00Z")),
            ),
            "updated",
        )
        self.assertEqual(classify_change(previous, original), "unchanged")


if __name__ == "__main__":
    unittest.main()
