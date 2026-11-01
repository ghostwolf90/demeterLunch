#!/usr/bin/env python3
"""多縣市相容入口；固定依名冊順序先臺中、再臺南。"""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.update_school_meals_by_district import main as update_by_district  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    if "--help" in arguments or "-h" in arguments:
        print("""用法：python3 scripts/update_all_school_meals.py [參數]

依啟用名冊順序先處理臺中市，再處理臺南市；預設只更新本機。
  --publish                 每區成功資料先發布；省略時不發布
  --no-publish              只更新本機
  --date YYYY-MM-DD         供餐日期，預設臺北時區今天
  --city 縣市               只處理指定縣市，可重複使用並依指定順序執行
  --district 行政區         只處理指定區；多縣市時必須搭配單一 --city
  --registry 路徑           指定合併學校名冊
  --skip-ingredients        只收集菜色
  --refresh-all             重查所選學校；內容相同不重傳
  --resume                  相容參數，預設即接續進度
  --verify-and-build        相容參數，預設即重建本機資料
  --timeout 秒數            預設 20
  --interval 秒數           預設 1.2
  --retries 次數            預設 2""")
        return 0
    if "--resume" in arguments and "--refresh-all" in arguments:
        print("--resume 與 --refresh-all 不能同時使用。", file=sys.stderr)
        return 1
    if "--publish" in arguments and "--no-publish" in arguments:
        print("--publish 與 --no-publish 不能同時使用。", file=sys.stderr)
        return 1
    publish = "--publish" in arguments
    forwarded = [
        argument for argument in arguments
        if argument not in {"--publish", "--resume", "--verify-and-build"}
    ]
    if not publish and "--no-publish" not in forwarded:
        forwarded.append("--no-publish")
    return update_by_district(forwarded)


if __name__ == "__main__":
    raise SystemExit(main())
