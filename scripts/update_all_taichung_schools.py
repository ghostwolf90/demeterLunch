#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.run_cloud_school_meals import main as run_cloud_school_meals  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    forwarded = list(sys.argv[1:] if argv is None else argv)
    publish = "--publish" in forwarded
    refresh_all = "--refresh-all" in forwarded
    forwarded = [
        argument
        for argument in forwarded
        if argument not in {"--publish", "--refresh-all", "--retry-failed"}
    ]
    arguments = [
        "--mode",
        "main" if refresh_all else "retry",
        *forwarded,
    ]
    if publish:
        arguments.append("--publish")
    return run_cloud_school_meals(arguments)


if __name__ == "__main__":
    raise SystemExit(main())
