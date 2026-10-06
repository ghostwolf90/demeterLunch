#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fatrace_openapi import (  # noqa: E402
    FatraceClient,
    FatraceDataUnavailable,
    FatraceError,
    TRACEABILITY_HEADERS,
    build_traceability_package,
    find_traceability_dataset,
    select_monthly_datasets,
    validate_csv_file,
)
from src.menu_data import (  # noqa: E402
    load_reviewed_weeks,
    traceability_paths,
    validate_traceability_package,
)


DEFAULT_COUNTY = "臺中市"
DEFAULT_GRADE = "國中小"
DEFAULT_SCHOOL = "臺中市西區忠信國小"
SECRET_ENV = "FATRACE_ACCESS_CODE"
DEFAULT_SECRET_FILE = PROJECT_ROOT / ".secrets" / "fatrace_access_code"


def previous_month(today: date | None = None) -> tuple[int, int]:
    current = today or date.today()
    if current.month == 1:
        return current.year - 1, 12
    return current.year, current.month - 1


def load_access_code(secret_file: Path) -> str:
    value = os.environ.get(SECRET_ENV, "").strip()
    if value:
        return value
    try:
        value = secret_file.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise FatraceError(
            f"找不到 access code；請設定 {SECRET_ENV}，或建立 {secret_file}"
        ) from exc
    if not value:
        raise FatraceError(f"access code 檔案是空的：{secret_file}")
    return value


def update_month(
    *,
    client: FatraceClient,
    year: int,
    month: int,
    county: str,
    grade: str,
    school_name: str,
    raw_root: Path,
    parsed_root: Path,
) -> dict[str, Any]:
    source_month = f"{year:04d}-{month:02d}"
    discovered = client.query_datasets(year, month, county)
    datasets = select_monthly_datasets(discovered, county=county, grade=grade)
    traceability_dataset = find_traceability_dataset(
        datasets, county=county, grade=grade
    )
    if not datasets:
        raise FatraceDataUnavailable(f"{source_month} 沒有可下載的資料集")

    raw_root.mkdir(parents=True, exist_ok=True)
    month_root = raw_root / source_month
    staged: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix=".staging-", dir=raw_root) as directory:
        staging_root = Path(directory)
        for dataset in datasets:
            link = client.get_download_link(dataset)
            downloaded = client.download_csv(link, staging_root)
            if dataset == traceability_dataset:
                validate_csv_file(downloaded.path, TRACEABILITY_HEADERS)
            staged.append(
                {
                    "dataset": dataset,
                    "link": link,
                    "downloaded": downloaded,
                }
            )

        staged_traceability = next(
            item["downloaded"].path
            for item in staged
            if item["dataset"] == traceability_dataset
        )
        traceability_filename = staged_traceability.name
        source_file_path = month_root / traceability_filename
        source_file = str(source_file_path.relative_to(PROJECT_ROOT))

        weeks = load_reviewed_weeks(parsed_root)
        available_dates = {
            day["date"] for week in weeks for day in week.get("days", [])
        }
        output_path = (
            parsed_root
            / "traceability"
            / f"traceability-{source_month}.json"
        )
        existing_payload = _read_json(output_path) if output_path.is_file() else None
        seen_source_ids, excluded_dates = _existing_traceability_identity(
            parsed_root, excluding=output_path
        )
        package = build_traceability_package(
            staged_traceability,
            source_month=source_month,
            source_file=source_file,
            school_name=school_name,
            county=county,
            available_dates=available_dates,
            excluded_dates=excluded_dates,
            existing_payload=existing_payload,
        )
        if package is not None:
            validate_traceability_package(
                package,
                output_path,
                available_dates,
                seen_source_ids=seen_source_ids,
                seen_dates=excluded_dates,
            )

        month_root.mkdir(parents=True, exist_ok=True)
        _check_archive_collisions(month_root, staged)
        new_files = 0
        for item in staged:
            downloaded = item["downloaded"]
            destination = month_root / downloaded.filename
            if destination.is_file():
                continue
            os.replace(downloaded.path, destination)
            new_files += 1

        manifest = {
            "schemaVersion": 1,
            "source": "校園食材登錄平臺 OpenAPI",
            "sourceMonth": source_month,
            "query": {
                "county": county,
                "grade": grade,
                "includesNationalDatasets": True,
            },
            "datasets": [
                {
                    "year": item["dataset"].year,
                    "month": item["dataset"].month,
                    "county": item["dataset"].county,
                    "grade": item["dataset"].grade,
                    "datasetName": item["dataset"].name,
                    "createdAt": item["dataset"].created_at,
                    "file": item["downloaded"].filename,
                    "bytes": item["downloaded"].byte_count,
                    "sha256": item["downloaded"].sha256,
                    "downloadUrl": item["link"],
                }
                for item in staged
            ],
        }
        manifest_changed = _write_json_atomic(month_root / "manifest.json", manifest)
        traceability_changed = False
        if package is not None:
            traceability_changed = _write_json_atomic(output_path, package)

    ingredient_count = (
        sum(
            len(dish["ingredients"])
            for day_item in package["days"]
            for dish in day_item["dishes"]
        )
        if package is not None
        else 0
    )
    return {
        "status": (
            "updated"
            if new_files or manifest_changed or traceability_changed
            else "unchanged"
        ),
        "sourceMonth": source_month,
        "datasets": len(datasets),
        "newFiles": new_files,
        "traceabilityChanged": traceability_changed,
        "days": len(package["days"]) if package is not None else 0,
        "ingredients": ingredient_count,
        "archive": str(month_root),
        "traceability": str(output_path) if package is not None else None,
    }


def _existing_traceability_identity(
    parsed_root: Path, *, excluding: Path
) -> tuple[set[str], set[str]]:
    source_ids: set[str] = set()
    dates: set[str] = set()
    excluded_resolved = excluding.resolve()
    for path in traceability_paths(parsed_root):
        if path.resolve() == excluded_resolved:
            continue
        payload = _read_json(path)
        source_id = payload.get("source", {}).get("id")
        if source_id:
            source_ids.add(source_id)
        for day_item in payload.get("days", []):
            if day_item.get("date"):
                dates.add(day_item["date"])
    return source_ids, dates


def _check_archive_collisions(month_root: Path, staged: list[dict[str, Any]]) -> None:
    for item in staged:
        downloaded = item["downloaded"]
        destination = month_root / downloaded.filename
        if destination.is_file() and _sha256(destination) != downloaded.sha256:
            raise FatraceError(
                f"既有 CSV 與新下載內容不同，為避免覆蓋已停止：{destination}"
            )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FatraceError(f"無法讀取 {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise FatraceError(f"{path} 的 JSON 根節點不是物件")
    return payload


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> bool:
    content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if path.is_file() and path.read_text(encoding="utf-8") == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, path)
    finally:
        Path(temporary_name).unlink(missing_ok=True)
    return True


def main() -> int:
    default_year, default_month = previous_month()
    parser = argparse.ArgumentParser(
        description=(
            "Download the previous month's campus ingredient OpenAPI CSV files "
            "and update reviewed traceability JSON."
        )
    )
    parser.add_argument("--year", type=int, default=default_year)
    parser.add_argument("--month", type=int, default=default_month)
    parser.add_argument("--county", default=DEFAULT_COUNTY)
    parser.add_argument("--grade", default=DEFAULT_GRADE)
    parser.add_argument("--school", default=DEFAULT_SCHOOL)
    parser.add_argument(
        "--secret-file", type=Path, default=DEFAULT_SECRET_FILE
    )
    parser.add_argument(
        "--raw-root",
        type=Path,
        default=PROJECT_ROOT / "data" / "raw" / "fatrace-openapi",
    )
    parser.add_argument(
        "--parsed-root", type=Path, default=PROJECT_ROOT / "data" / "parsed"
    )
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--request-interval", type=float, default=1.0)
    parser.add_argument(
        "--verify-and-build",
        action="store_true",
        help=(
            "When traceability changes, rebuild SQLite, run the full tests, "
            "check web/app.js, and rebuild dist/."
        ),
    )
    args = parser.parse_args()
    if not 1 <= args.month <= 12:
        parser.error("--month 必須介於 1 到 12")

    try:
        access_code = load_access_code(args.secret_file)
        result = update_month(
            client=FatraceClient(
                access_code,
                timeout=args.timeout,
                attempts=args.attempts,
                request_interval=args.request_interval,
            ),
            year=args.year,
            month=args.month,
            county=args.county,
            grade=args.grade,
            school_name=args.school,
            raw_root=args.raw_root,
            parsed_root=args.parsed_root,
        )
    except FatraceDataUnavailable as exc:
        print(f"pending: {exc}", file=sys.stderr)
        return 2
    except FatraceError as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1

    if args.verify_and_build and result["traceabilityChanged"]:
        commands = (
            [sys.executable, "scripts/build_database.py"],
            [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"],
            ["node", "--check", "web/app.js"],
            [sys.executable, "scripts/build_static_site.py"],
        )
        try:
            for command in commands:
                subprocess.run(command, cwd=PROJECT_ROOT, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            print(f"failed: 更新已下載，但驗證或建置失敗：{exc}", file=sys.stderr)
            return 1
        result["verifiedAndBuilt"] = True

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
