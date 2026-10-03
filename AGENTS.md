# Project guidance

- The project now includes the explicitly requested stage-three local product: reviewed structured menu data, SQLite, insights, and a family dinner suggestion UI.
- Preserve the reviewed JSON as the source of truth for structured data; rebuild SQLite with `scripts/build_database.py` after changes.
- Prefer the Atom feed; HTML crawling is a fallback only.
- Preserve idempotency and do not replace valid stored data until a complete refreshed article has been downloaded.
- Keep the default collection cutoff at 2026-09-01, including a menu week that overlaps that date.
- Be respectful of the source site: always use timeouts, a descriptive User-Agent, bounded retries, and a request interval.
- Run `python3 -m unittest discover -s tests -v` after changes.
- Keep the local website dependency-free and bind its server to 127.0.0.1 by default.
- Treat `web/` as the editable website source. After frontend or public-data changes, run `node --check web/app.js` and rebuild the deployable `dist/` snapshot with `python3 scripts/build_static_site.py`.
- Keep the dish-detail dialog motion consistent with Apple-style sheets: stage the first rendered frame to prevent flashing, use a no-overshoot response around 0.3–0.4 seconds, animate the panel and backdrop together, and use symmetric enter/exit paths (right edge on desktop, bottom edge on mobile).
- Preserve dialog accessibility when changing its motion: Escape, backdrop click, and the close button must animate out before closing; focus must return to the triggering dish; `prefers-reduced-motion` must use a short cross-fade without spatial movement.
- Publish updates to the existing public Site “好好吃飯｜忠信國小午餐助手” (`appgprj_6abdf96b7f608191942ee50447a69129`, slug `zhongxin-lunch-2026`); do not create a replacement Site or change its audience or schedules unless explicitly requested.
- Before publishing, open the latest Site source and use it as the deployment base because its automations may have newer news or monitor state. Overlay the intended code changes, run all checks, rebuild `dist/`, and preserve unrelated remote data.
