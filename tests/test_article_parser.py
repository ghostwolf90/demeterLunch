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

    def test_supported_title_date_variants(self) -> None:
        cases = (
            (
                "115學年度第1學期第2週0907-0911菜單及營養素分析",
                {
                    "school_year": 115,
                    "semester": 1,
                    "week": 2,
                    "start_date": "2026-09-07",
                    "end_date": "2026-09-11",
                },
            ),
            (
                "115學年度第1學期第5週0929-1002菜單及營養素分析",
                {"start_date": "2026-09-29", "end_date": "2026-10-02"},
            ),
            (
                "115學年度第1學期第18週1229-0102菜單及營養素分析",
                {"start_date": "2026-12-29", "end_date": "2027-01-02"},
            ),
            (
                "114學年度第二學期第3週0224-0227菜單及營養素分析",
                {"start_date": "2026-02-24", "end_date": "2026-02-27"},
            ),
            (
                "114學年度第1學期第20-21週0112-16菜單及營養素分析",
                {
                    "week": 20,
                    "week_end": 21,
                    "start_date": "2026-01-12",
                    "end_date": "2026-01-16",
                },
            ),
        )

        for title, expected in cases:
            with self.subTest(title=title):
                parsed = parse_title(title)
                for field, value in expected.items():
                    actual = getattr(parsed, field)
                    if field.endswith("_date"):
                        actual = actual.isoformat()
                    self.assertEqual(actual, value)

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
