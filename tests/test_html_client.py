import unittest

from src.article_parser import extract_images
from src.html_client import _ArticlePageParser, _ListingParser


class HtmlFallbackParserTests(unittest.TestCase):
    def test_listing_finds_posts_and_older_page(self) -> None:
        parser = _ListingParser("https://zxes.blogspot.com/")
        parser.feed(
            """
            <h3 class="post-title entry-title">
              <a href="/2026/09/menu.html">115學年度第1學期第2週0907-0911菜單及營養素分析</a>
            </h3>
            <a id="Blog1_blog-pager-older-link" href="/search?updated-max=old">較舊的文章</a>
            """
        )
        parser.close()
        self.assertEqual(
            parser.posts,
            [
                (
                    "115學年度第1學期第2週0907-0911菜單及營養素分析",
                    "https://zxes.blogspot.com/2026/09/menu.html",
                )
            ],
        )
        self.assertEqual(
            parser.older_url,
            "https://zxes.blogspot.com/search?updated-max=old",
        )

    def test_article_page_extracts_metadata_and_body(self) -> None:
        parser = _ArticlePageParser("https://zxes.blogspot.com/2026/09/menu.html")
        parser.feed(
            """
            <link rel="canonical" href="https://zxes.blogspot.com/2026/09/menu.html">
            <meta itemprop="datePublished" content="2026-09-03T01:03:02-07:00">
            <h3 class="post-title entry-title">菜單標題</h3>
            <div class="post-body" id="post-body-123">
              <p><a href="https://blogger.googleusercontent.com/img/b/token/s2000/1.png">
                <img src="https://blogger.googleusercontent.com/img/b/token/w400-h283/1.png">
              </a></p>
            </div>
            <span class="post-labels"><a href="/search/label/menu">菜單及營養素分析</a></span>
            """
        )
        parser.close()
        images = extract_images("".join(parser.body_html), parser.canonical_url or "")
        self.assertEqual(parser.post_id, "123")
        self.assertEqual(parser.title, "菜單標題")
        self.assertEqual(parser.published_at, "2026-09-03T01:03:02-07:00")
        self.assertEqual(parser.labels, ["菜單及營養素分析"])
        self.assertEqual(len(images), 1)
        self.assertIn("/s0/", images[0].download_url)


if __name__ == "__main__":
    unittest.main()
