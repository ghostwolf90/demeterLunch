#!/usr/bin/env python3
from __future__ import annotations

from datetime import date, datetime
import sys
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.update_school_meals import main as update_school_meals  # noqa: E402
from scripts.publish_school_meals import main as publish_school_meals  # noqa: E402


TAIPEI = ZoneInfo("Asia/Taipei")


def _requested_date(arguments: list[str]) -> date:
    for index, argument in enumerate(arguments):
        if argument == "--date" and index + 1 < len(arguments):
            return date.fromisoformat(arguments[index + 1])
        if argument.startswith("--date="):
            return date.fromisoformat(argument.split("=", 1)[1])
    return datetime.now(TAIPEI).date()


def main(argv: list[str] | None = None) -> int:
    forwarded = list(sys.argv[1:] if argv is None else argv)
    publish = "--publish" in forwarded
    forwarded = [argument for argument in forwarded if argument != "--publish"]
    if "--refresh-all" not in forwarded and "--resume" not in forwarded:
        forwarded.insert(0, "--resume")
    meal_date = _requested_date(forwarded)
    status = update_school_meals(
        ["--all-schools", "--verify-and-build", *forwarded]
    )
    if status != 0 or not publish:
        return status
    return publish_school_meals(["--date", meal_date.isoformat()])


if __name__ == "__main__":
    raise SystemExit(main())
