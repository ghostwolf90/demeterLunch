import unittest

from src.feed_client import parse_atom_feed


ATOM_FIXTURE = """<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom'
      xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/'>
  <openSearch:totalResults>2</openSearch:totalResults>
  <link rel='next' href='https://www.blogger.com/feeds/test?start-index=2'/>
  <entry>
    <id>tag:blogger.com,1999:blog-1.post-123</id>
    <published>2026-09-03T01:03:02.308-07:00</published>
    <updated>2026-09-03T01:03:02.308-07:00</updated>
    <category term='115學年度上學期菜單及營養素分析'/>
    <title type='text'>115學年度第1學期第2週0907-0911菜單及營養素分析</title>
    <content type='html'>&lt;a href=&quot;https://blogger.googleusercontent.com/img/b/token/s2000/1.png&quot;&gt;&lt;img src=&quot;https://blogger.googleusercontent.com/img/b/token/w400-h283/1.png&quot; /&gt;&lt;/a&gt;</content>
    <link rel='alternate' href='https://zxes.blogspot.com/2026/09/post.html'/>
  </entry>
</feed>""".encode("utf-8")


class FeedParserTests(unittest.TestCase):
    def test_parses_atom_metadata_and_images(self) -> None:
        articles, next_url, total = parse_atom_feed(
            ATOM_FIXTURE, "https://zxes.blogspot.com/"
        )
        self.assertEqual(total, 2)
        self.assertEqual(next_url, "https://www.blogger.com/feeds/test?start-index=2")
        self.assertEqual(len(articles), 1)
        article = articles[0]
        self.assertEqual(article.id, "123")
        self.assertEqual(article.url, "https://zxes.blogspot.com/2026/09/post.html")
        self.assertEqual(len(article.images), 1)
        self.assertIn("/s0/", article.images[0].download_url)


if __name__ == "__main__":
    unittest.main()
