import unittest

from src.article_parser import (
    TitleParseError,
    extract_images,
    is_lunch_article,
    normalize_blogger_image_url,
    parse_title,
)


class TitleParserTests(unittest.TestCase):
    def test_menu_label_does_not_override_non_menu_title(self) -> None:
        self.assertFalse(
            is_lunch_article(
                "113學年度第二學期第20週午餐滿意度調查結果",
                ["113學年度下學期菜單及營養素分析"],
            )
        )

    def test_standard_title(self) -> None:
        parsed = parse_title("115學年度第1學期第2週0907-0911菜單及營養素分析")
        self.assertEqual(parsed.school_year, 115)
        self.assertEqual(parsed.semester, 1)
        self.assertEqual(parsed.week, 2)
        self.assertEqual(parsed.start_date.isoformat(), "2026-09-07")
        self.assertEqual(parsed.end_date.isoformat(), "2026-09-11")

    def test_cross_month(self) -> None:
        parsed = parse_title("115學年度第1學期第5週0929-1002菜單及營養素分析")
        self.assertEqual(parsed.start_date.isoformat(), "2026-09-29")
        self.assertEqual(parsed.end_date.isoformat(), "2026-10-02")

    def test_cross_year(self) -> None:
        parsed = parse_title("115學年度第1學期第18週1229-0102菜單及營養素分析")
        self.assertEqual(parsed.start_date.isoformat(), "2026-12-29")
        self.assertEqual(parsed.end_date.isoformat(), "2027-01-02")

    def test_second_semester_uses_next_calendar_year(self) -> None:
        parsed = parse_title("114學年度第二學期第3週0224-0227菜單及營養素分析")
        self.assertEqual(parsed.start_date.isoformat(), "2026-02-24")
        self.assertEqual(parsed.end_date.isoformat(), "2026-02-27")

    def test_short_end_date_and_week_range(self) -> None:
        parsed = parse_title("114學年度第1學期第20-21週0112-16菜單及營養素分析")
        self.assertEqual(parsed.week, 20)
        self.assertEqual(parsed.week_end, 21)
        self.assertEqual(parsed.start_date.isoformat(), "2026-01-12")
        self.assertEqual(parsed.end_date.isoformat(), "2026-01-16")

    def test_invalid_title(self) -> None:
        with self.assertRaises(TitleParseError):
            parse_title("本週菜單")


class ImageParserTests(unittest.TestCase):
    def test_normalizes_blogger_size_segment(self) -> None:
        url = "https://blogger.googleusercontent.com/img/b/token/s3508/menu.jpg"
        self.assertEqual(
            normalize_blogger_image_url(url),
            "https://blogger.googleusercontent.com/img/b/token/s0/menu.jpg",
        )

    def test_extracts_anchor_original_and_deduplicates(self) -> None:
        content = """
        <a href="https://blogger.googleusercontent.com/img/b/token/s3508/menu.jpg">
          <img data-original-width="2480" data-original-height="3508"
               src="https://blogger.googleusercontent.com/img/b/token/w283-h400/menu.jpg">
        </a>
        <a href="https://blogger.googleusercontent.com/img/b/token/s3508/menu.jpg"></a>
        """
        images = extract_images(content, "https://zxes.blogspot.com/post.html")
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0].download_url.rsplit("/", 2)[-2], "s0")
        self.assertEqual(images[0].declared_width, 2480)
        self.assertEqual(images[0].declared_height, 3508)


if __name__ == "__main__":
    unittest.main()
