# Project guidance

- The project now includes the explicitly requested stage-three local product: reviewed structured menu data, SQLite, insights, and a family dinner suggestion UI.
- Preserve the reviewed JSON as the source of truth for structured data; rebuild SQLite with `scripts/build_database.py` after changes.
- Prefer the Atom feed; HTML crawling is a fallback only.
- Preserve idempotency and do not replace valid stored data until a complete refreshed article has been downloaded.
- Keep the default collection cutoff at 2026-09-01, including a menu week that overlaps that date.
- Be respectful of the source site: always use timeouts, a descriptive User-Agent, bounded retries, and a request interval.
- Run `python3 -m unittest discover -s tests -v` after changes.
- Keep the local website dependency-free and bind its server to 127.0.0.1 by default.
