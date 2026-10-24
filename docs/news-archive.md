# Lunch news archive

`data/news/news.json` is the complete published list, newest publication date first. The homepage shows its first two entries. `/news` shows all retained entries, grouped by month in Asia/Taipei, with month and category filters. The old `/news.html` address remains usable.

The top navigation links to the homepage's `#news` section. The preview's “查看午餐消息” link opens `/news`. Cross-page section restoration includes `news`, so asynchronous dashboard loading does not leave visitors at the wrong section.

`scripts/check_news_updates.py` discovers recent stories from feeds, then merges them with the current published list and `data/news/reviewed.json`. The 30-day lookback and maximum-item limit apply to discovery, not retention. Stories that leave a feed or age past that window remain published. Entries are deduplicated by canonical URL and normalized title, and matching entries retain a stable ID. Explicitly blocked URLs remain excluded. A failed collection preserves the published JSON byte for byte; successful complete payloads are written atomically. A successful check updates `generatedAt` even when the article fingerprint is unchanged, so “last checked” is distinct from article publication dates.

The October 24, 2026 migration recovered ten distinct permitted entries from twelve prior source snapshots, including the September 18 article. Two additional announcements were checked against original pages: the Taichung school announcement dated October 20 at 08:00, and the organizer's article with `article:published_time=2026-10-19T15:27:24+08:00`. Only titles, original dates, source attribution, links, and short relevance notes are retained. Neither search crawl dates nor the check date are used as article publication dates.

Regression coverage lives in `tests/test_news_archive.py` and `tests-worker/news-archive.test.mjs`. It checks historical retention, repeated updates, corrections, failures, month/category filtering, Taipei month boundaries, and navigation destinations. Browser automation remains prohibited; visual layout checks require manual verification.
