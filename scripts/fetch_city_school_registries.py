#!/usr/bin/env python3
"""Fetch and review elementary-school registries for rollout cities."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import re
import sys
from typing import Any
from urllib.parse import urlencode


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.http_client import HttpClient  # noqa: E402


FATRACE_ROOT = "https://fatraceschool.k12ea.gov.tw"
CONFIG_URL = f"{FATRACE_ROOT}/frontend/js/app/config.js"
COUNTY_URL = f"{FATRACE_ROOT}/county/"
USER_AGENT = (
    "DemeterLunchCollector/0.4 "
    "(+https://haohaofood.cc/; official school registry bootstrap)"
)
MAX_CONFIG_BYTES = 256 * 1024
MAX_API_BYTES = 4 * 1024 * 1024
SCHOOL_LIST_KEY_PATTERN = re.compile(
    r"['\"]?schoolListApiKey['\"]?\s*:\s*['\"]([0-9a-fA-F]{64})['\"]"
)
CITY_CONFIG: dict[str, dict[str, Any]] = {
    "臺北市": {
        "countyId": 17,
        "slug": "taipei",
        "output": "taipei-active-elementary-schools.json",
        "report": "taipei-school-registry-report.json",
    },
    "桃園市": {
        "countyId": 25,
        "slug": "taoyuan",
        "output": "taoyuan-active-elementary-schools.json",
        "report": "taoyuan-school-registry-report.json",
    },
    "苗栗縣": {
        "countyId": 26,
        "slug": "miaoli",
        "output": "miaoli-active-elementary-schools.json",
        "report": "miaoli-school-registry-report.json",
    },
    "彰化縣": {
        "countyId": 28,
        "slug": "changhua",
        "output": "changhua-active-elementary-schools.json",
        "report": "changhua-school-registry-report.json",
    },
}

# These exact-code aliases are reviewed name variants between the current
# Fatrace registry and the Ministry of Education 115 academic-year directory.
# Keep this list narrow and auditable; do not turn it into fuzzy city-wide matching.
REVIEWED_NAME_ALIASES_BY_CODE: dict[str, frozenset[str]] = {
    "353603": frozenset({"忠義國小", "忠義實驗國小"}),
    "353608": frozenset({"臺北市立大學附設國小", "臺北市立大學附小"}),
    "330601": frozenset({"國立臺北教育大學附設實驗國小", "國立臺北教大實小"}),
    "380601": frozenset({"國立政治大學附設實驗國小", "國立政大實小"}),
    "034630": frozenset({"果林國小", "菓林國小"}),
}


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON 必須是物件：{path}")
    return payload


def parse_api_rows(raw: bytes, label: str) -> list[dict[str, Any]]:
    payload = json.loads(raw.decode("utf-8-sig"))
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(payload, dict) or payload.get("result") != 1 or not isinstance(rows, list):
        raise ValueError(f"中央平臺{label}回應無效")
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError(f"中央平臺{label}包含非物件資料")
    return rows


def parse_school_list_api_key(raw: bytes) -> str:
    match = SCHOOL_LIST_KEY_PATTERN.search(raw.decode("utf-8"))
    if not match:
        raise ValueError("中央平臺公開前端未提供學校清單金鑰")
    return match.group(1)


def normalize_name(value: object) -> str:
    text = str(value or "").strip().replace("台", "臺")
    text = re.sub(r"^(?:國立|縣立|市立|私立|財團法人)", "", text)
    text = text.replace("國民中小學", "國中小").replace("國民小學", "國小")
    text = text.replace("實驗小學", "實小").replace("實驗國小", "實小")
    text = text.replace("小學", "國小")
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]", "", text)


def normalize_city_name(value: object) -> str:
    return str(value or "").strip().replace("台", "臺")


def short_school_name(full_name: str, city: str, district: str) -> str:
    name = full_name.strip()
    if name.startswith(city):
        name = name[len(city):]
    if name.startswith(district):
        name = name[len(district):]
    if not name:
        raise ValueError(f"中央平臺校名無法去除縣市與行政區：{full_name}")
    return name


def school_name_matches(
    directory_rows: list[dict[str, Any]], short_name: str, school_code: str
) -> bool:
    return school_name_match_method(directory_rows, short_name, school_code) is not None


def school_name_match_method(
    directory_rows: list[dict[str, Any]], short_name: str, school_code: str
) -> str | None:
    actual = normalize_name(short_name)
    for row in directory_rows:
        expected = normalize_name(row.get("name"))
        if actual == expected:
            return "normalized"
        if "-" in school_code and actual.startswith(expected) and len(expected) >= 3:
            return "branch"
        if min(len(actual), len(expected)) >= 4 and (
            actual in expected or expected in actual
        ):
            return "contained"
    base_code = school_code.split("-", 1)[0]
    reviewed_aliases = {
        normalize_name(name) for name in REVIEWED_NAME_ALIASES_BY_CODE.get(base_code, ())
    }
    if actual in reviewed_aliases and any(
        normalize_name(row.get("name")) in reviewed_aliases for row in directory_rows
    ):
        return "reviewed_alias"
    return None


def _national_elementary_by_code(
    national_directory: dict[str, Any], city: str
) -> dict[str, list[dict[str, Any]]]:
    rows = national_directory.get("schools")
    if not isinstance(rows, list):
        raise ValueError("教育部名錄缺少 schools")
    result: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        if (
            isinstance(row, dict)
            and row.get("city") == city
            and row.get("level") == "國小"
        ):
            code = str(row.get("moeSchoolCode") or "").strip()
            if code:
                result.setdefault(code, []).append(row)
    if not result:
        raise ValueError(f"教育部名錄找不到{city}國小")
    return result


def build_city_registry(
    *,
    city: str,
    county_id: int,
    county_rows: list[dict[str, Any]],
    area_rows: list[dict[str, Any]],
    school_rows: list[dict[str, Any]],
    national_directory: dict[str, Any],
    retrieved_at: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    counties = [
        row for row in county_rows
        if int(row.get("CountyId") or 0) == county_id
        and normalize_city_name(row.get("County")) == city
    ]
    if len(counties) != 1:
        raise ValueError(f"中央平臺縣市清單無法唯一確認{city}")

    areas: dict[int, str] = {}
    area_order: dict[int, int] = {}
    for index, row in enumerate(area_rows):
        if int(row.get("CountyId") or 0) != county_id:
            raise ValueError(f"{city}行政區回應混入其他縣市")
        area_id = int(row.get("AreaId") or 0)
        district = str(row.get("Area") or "").strip()
        if area_id <= 0 or not district or area_id in areas:
            raise ValueError(f"{city}行政區識別資料無效")
        areas[area_id] = district
        area_order[area_id] = index
    if not areas:
        raise ValueError(f"中央平臺找不到{city}行政區")

    directory_by_code = _national_elementary_by_code(national_directory, city)
    verified: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    seen_codes: set[str] = set()
    sorted_rows = sorted(
        school_rows,
        key=lambda row: (
            area_order.get(int(row.get("AreaId") or 0), len(area_order)),
            str(row.get("SchoolName") or ""),
            int(row.get("SchoolId") or 0),
        ),
    )
    for row in sorted_rows:
        school_id = int(row.get("SchoolId") or 0)
        school_code = str(row.get("SchoolCode") or "").strip()
        full_name = str(row.get("SchoolName") or "").strip()
        area_id = int(row.get("AreaId") or 0)
        if (
            school_id <= 0
            or not school_code
            or not full_name
            or int(row.get("CountyId") or 0) != county_id
            or int(row.get("SchoolType") or 0) != 2
            or area_id not in areas
        ):
            raise ValueError(f"{city}學校清單包含無效識別資料：{row}")
        if school_id in seen_ids or school_code in seen_codes:
            raise ValueError(f"{city}學校清單包含重複 School ID 或 SchoolCode")
        seen_ids.add(school_id)
        seen_codes.add(school_code)

        district = areas[area_id]
        name = short_school_name(full_name, city, district)
        base_code = school_code.split("-", 1)[0]
        directory_rows = directory_by_code.get(base_code, [])
        result = {
            "fatraceSchoolId": school_id,
            "fatraceSchoolCode": school_code,
            "fullName": full_name,
            "district": district,
        }
        if not directory_rows:
            result.update(
                status="excluded",
                reason="教育部 115 學年度國小名錄找不到對應學校代碼",
            )
            results.append(result)
            continue
        name_match_method = school_name_match_method(directory_rows, name, school_code)
        if name_match_method is None:
            result.update(
                status="excluded",
                reason="中央平臺校名與教育部 115 學年度名錄不一致",
                directoryNames=[str(item.get("name") or "") for item in directory_rows],
            )
            results.append(result)
            continue

        level = (
            "高中附設國小"
            if "-" not in school_code
            and any(bool(item.get("attachedDepartment")) for item in directory_rows)
            else "國小"
        )
        school = {
            "city": city,
            "district": district,
            "level": level,
            "name": name,
            "fullName": full_name,
            "fatraceSchoolId": school_id,
            "moeSchoolCode": base_code,
            "fatraceSchoolCode": school_code,
        }
        verified.append(school)
        result.update(
            status="verified",
            moeSchoolCode=base_code,
            name=name,
            nameMatchMethod=name_match_method,
        )
        results.append(result)

    if not verified:
        raise ValueError(f"{city}沒有任何通過雙來源核對的國小")
    status_counts = Counter(item["status"] for item in results)
    source_urls = {
        "county": COUNTY_URL,
        "area": f"{FATRACE_ROOT}/area/?{urlencode({'CountyId': county_id})}",
        "schools": f"{FATRACE_ROOT}/school/?{urlencode({'CountyId': county_id, 'SchoolType': 2})}",
    }
    registry = {
        "schemaVersion": 1,
        "retrievedAt": retrieved_at,
        "source": {
            "name": "教育部校園食材登錄平臺公開查詢 API",
            "urls": source_urls,
            "fatraceCountyId": county_id,
        },
        "review": {
            "status": "reviewed",
            "method": (
                "以中央平臺縣市、行政區及國小清單取得 School ID，逐筆核對縣市、"
                "行政區、學段、教育部學校代碼與 115 學年度校名；未通過者不啟用。"
            ),
        },
        "summary": {
            "city": city,
            "candidateSchoolCount": len(school_rows),
            "districtCount": len({school["district"] for school in verified}),
            "schoolCount": len(verified),
            "excludedSchoolCount": status_counts["excluded"],
        },
        "schools": verified,
    }
    report = {
        "schemaVersion": 1,
        "retrievedAt": retrieved_at,
        "city": city,
        "countyId": county_id,
        "candidateSchoolCount": len(school_rows),
        "statusCounts": dict(sorted(status_counts.items())),
        "results": results,
    }
    return registry, report


def write_json_if_changed(path: Path, payload: dict[str, Any]) -> str:
    comparable = {key: value for key, value in payload.items() if key != "retrievedAt"}
    if path.is_file():
        existing = read_json(path)
        existing_comparable = {
            key: value for key, value in existing.items() if key != "retrievedAt"
        }
        if existing_comparable == comparable:
            return "unchanged"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
    return "updated"


def archive_download(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        if path.read_bytes() != raw:
            raise ValueError(f"原始來源封存雜湊衝突：{path}")
        return
    path.write_bytes(raw)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--city",
        action="append",
        choices=tuple(CITY_CONFIG),
        help="只更新指定縣市，可重複使用；預設更新所有已設定的擴充縣市",
    )
    parser.add_argument(
        "--national-directory",
        type=Path,
        default=PROJECT_ROOT / "data/reference/national-school-directory.json",
    )
    parser.add_argument(
        "--reference-dir",
        type=Path,
        default=PROJECT_ROOT / "data/reference",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--interval", type=float, default=0.5)
    parser.add_argument("--retries", type=int, default=1)
    args = parser.parse_args(argv)
    if args.timeout <= 0 or args.interval < 0 or args.retries < 0:
        parser.error("逾時必須大於零，請求間隔及重試次數不得小於零")

    cities = list(dict.fromkeys(args.city or CITY_CONFIG.keys()))
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
    pending: list[tuple[str, dict[str, Any], dict[str, Any], list[tuple[str, bytes]]]] = []
    for city in cities:
        config = CITY_CONFIG[city]
        county_id = int(config["countyId"])
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
        slug = str(config["slug"])
        downloads = [
            (f"{slug}-areas", area_raw),
            (f"{slug}-elementary-schools", school_raw),
        ]
        pending.append((city, registry, report, downloads))

    archive_root = args.reference_dir / "fatrace-school-registry-raw"
    county_digest = hashlib.sha256(county_raw).hexdigest()
    archive_download(archive_root / f"counties-{county_digest}.json", county_raw)
    summaries = []
    for city, registry, report, downloads in pending:
        config = CITY_CONFIG[city]
        for label, raw in downloads:
            digest = hashlib.sha256(raw).hexdigest()
            archive_download(archive_root / f"{label}-{digest}.json", raw)
        registry_status = write_json_if_changed(
            args.reference_dir / str(config["output"]), registry
        )
        report_status = write_json_if_changed(
            args.reference_dir / str(config["report"]), report
        )
        summaries.append(
            {
                **registry["summary"],
                "registryStatus": registry_status,
                "reportStatus": report_status,
            }
        )
    print(json.dumps({"cities": summaries}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
