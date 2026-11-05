#!/usr/bin/env python3
"""Archive and verify every elementary-school unit exposed by Fatrace."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import sys
from typing import Any
from urllib.parse import urlencode


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.build_city_service_catalog import TAIWAN_CITY_ORDER  # noqa: E402
from scripts.fetch_city_school_registries import (  # noqa: E402
    CONFIG_URL,
    COUNTY_URL,
    FATRACE_ROOT,
    MAX_API_BYTES,
    MAX_CONFIG_BYTES,
    USER_AGENT,
    archive_download,
    build_city_registry,
    normalize_city_name,
    parse_api_rows,
    parse_school_list_api_key,
    read_json,
    write_json_if_changed,
)
from src.http_client import HttpClient  # noqa: E402


def county_ids_by_city(county_rows: list[dict[str, Any]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in county_rows:
        city = normalize_city_name(row.get("County"))
        county_id = int(row.get("CountyId") or 0)
        if city not in TAIWAN_CITY_ORDER:
            continue
        if county_id <= 0 or city in result:
            raise ValueError(f"中央平臺縣市識別重複或無效：{city or repr(row)}")
        result[city] = county_id
    if set(result) != set(TAIWAN_CITY_ORDER):
        missing = sorted(set(TAIWAN_CITY_ORDER) - set(result))
        raise ValueError(f"中央平臺縣市清單不完整：{missing}")
    return result


def build_reference_payload(
    *,
    national_directory: dict[str, Any],
    retrieved_at: str,
    city_results: list[tuple[str, int, dict[str, Any], dict[str, Any]]],
) -> dict[str, Any]:
    by_city: dict[str, dict[str, int]] = {}
    units: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for city, county_id, registry, report in city_results:
        if city in by_city:
            raise ValueError(f"縣市結果重複：{city}")
        results = report.get("results")
        if not isinstance(results, list):
            raise ValueError(f"{city}核對報告缺少 results")
        counts = Counter()
        for row in results:
            if not isinstance(row, dict):
                raise ValueError(f"{city}核對報告包含無效項目")
            school_id = int(row.get("fatraceSchoolId") or 0)
            if school_id <= 0 or school_id in seen_ids:
                raise ValueError(f"Fatrace School ID 重複或無效：{school_id}")
            seen_ids.add(school_id)
            source_status = str(row.get("status") or "")
            if source_status == "verified":
                status = "verified"
            elif source_status == "excluded" and row.get("directoryNames"):
                status = "review_required"
            elif source_status == "excluded":
                status = "unmatched"
            else:
                raise ValueError(f"{city}核對結果狀態無效：{source_status or '空白'}")
            counts[status] += 1
            units.append({"city": city, "countyId": county_id, **row, "status": status})
        summary = registry.get("summary")
        if not isinstance(summary, dict):
            raise ValueError(f"{city}啟用候選名冊缺少 summary")
        by_city[city] = {
            "candidateUnitCount": len(results),
            "verifiedUnitCount": counts["verified"],
            "reviewRequiredUnitCount": counts["review_required"],
            "unmatchedUnitCount": counts["unmatched"],
        }

    if [city for city, *_ in city_results] != list(TAIWAN_CITY_ORDER):
        raise ValueError("全臺核對結果未依 22 縣市完整順序產生")
    status_counts = Counter(str(unit["status"]) for unit in units)
    return {
        "schemaVersion": 1,
        "academicYear": national_directory.get("academicYear"),
        "retrievedAt": retrieved_at,
        "status": "inactive_reference_only",
        "source": {
            "name": "教育部校園食材登錄平臺公開學校清單 API",
            "countyUrl": COUNTY_URL,
            "schoolType": 2,
        },
        "note": (
            "本檔只建立全臺國小與 Fatrace School ID 對照，不會加入午餐抓取、"
            "公開學校選單或提醒；只有 active-elementary-schools.json 會進入收集流程。"
        ),
        "summary": {
            "cityCount": len(by_city),
            "candidateUnitCount": len(units),
            "verifiedUnitCount": status_counts["verified"],
            "reviewRequiredUnitCount": status_counts["review_required"],
            "unmatchedUnitCount": status_counts["unmatched"],
            "verifiedMoeSchoolCodeCount": len({
                str(unit.get("moeSchoolCode"))
                for unit in units
                if unit["status"] == "verified" and unit.get("moeSchoolCode")
            }),
            "byCity": by_city,
        },
        "schoolUnits": units,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--national-directory",
        type=Path,
        default=PROJECT_ROOT / "data/reference/national-school-directory.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data/reference/national-fatrace-elementary-schools.json",
    )
    parser.add_argument(
        "--archive-dir",
        type=Path,
        default=PROJECT_ROOT / "data/reference/fatrace-school-registry-raw",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=0.5)
    parser.add_argument("--retries", type=int, default=1)
    args = parser.parse_args(argv)
    if args.timeout <= 0 or args.interval < 0 or args.retries < 0:
        parser.error("逾時必須大於零，請求間隔及重試次數不得小於零")

    national_directory = read_json(args.national_directory)
    retrieved_at = datetime.now(timezone.utc).isoformat()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = HttpClient(
        timeout=args.timeout,
        min_interval=args.interval,
        retries=args.retries,
        user_agent=USER_AGENT,
    )
    config_raw = client.get(
        CONFIG_URL,
        max_bytes=MAX_CONFIG_BYTES,
        accept="application/javascript,text/javascript",
    ).data
    school_list_key = parse_school_list_api_key(config_raw)
    county_raw = client.get(
        COUNTY_URL,
        max_bytes=MAX_API_BYTES,
        accept="application/json",
    ).data
    county_rows = parse_api_rows(county_raw, "縣市清單")
    county_ids = county_ids_by_city(county_rows)

    city_results: list[tuple[str, int, dict[str, Any], dict[str, Any]]] = []
    downloads: list[tuple[str, bytes]] = [("config", config_raw), ("counties", county_raw)]
    for city in TAIWAN_CITY_ORDER:
        county_id = county_ids[city]
        area_url = f"{FATRACE_ROOT}/area/?{urlencode({'CountyId': county_id})}"
        school_url = (
            f"{FATRACE_ROOT}/school/?"
            + urlencode({"CountyId": county_id, "SchoolType": 2})
        )
        area_raw = client.get(
            area_url,
            max_bytes=MAX_API_BYTES,
            accept="application/json",
        ).data
        school_raw = client.get(
            school_url,
            max_bytes=MAX_API_BYTES,
            accept="application/json",
            extra_headers={"X-School-List-Key": school_list_key},
        ).data
        registry, report = build_city_registry(
            city=city,
            county_id=county_id,
            county_rows=county_rows,
            area_rows=parse_api_rows(area_raw, f"{city}行政區"),
            school_rows=parse_api_rows(school_raw, f"{city}國小清單"),
            national_directory=national_directory,
            retrieved_at=retrieved_at,
        )
        city_results.append((city, county_id, registry, report))
        slug = str(county_id)
        downloads.extend([
            (f"county-{slug}-areas", area_raw),
            (f"county-{slug}-elementary-schools", school_raw),
        ])
        logging.info(
            "%s：候選 %s、核對通過 %s、排除 %s",
            city,
            report["candidateSchoolCount"],
            report["statusCounts"].get("verified", 0),
            report["statusCounts"].get("excluded", 0),
        )

    payload = build_reference_payload(
        national_directory=national_directory,
        retrieved_at=retrieved_at,
        city_results=city_results,
    )
    for label, raw in downloads:
        digest = hashlib.sha256(raw).hexdigest()
        suffix = ".js" if label == "config" else ".json"
        archive_download(args.archive_dir / f"{label}-{digest}{suffix}", raw)
    status = write_json_if_changed(args.output, payload)
    print(json.dumps({"status": status, **payload["summary"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
