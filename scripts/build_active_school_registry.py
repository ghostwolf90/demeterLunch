#!/usr/bin/env python3
"""Merge reviewed city registries and generate city-scoped refresh groups."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CITY_ORDER = ("臺中市", "臺南市")


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON 必須是物件：{path}")
    return payload


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def merge_registries(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_city: dict[str, list[dict[str, Any]]] = {}
    seen_ids: set[int] = set()
    seen_names: set[tuple[str, str, str]] = set()
    for payload in payloads:
        if payload.get("schemaVersion") != 1 or not isinstance(payload.get("schools"), list):
            raise ValueError("城市啟用名冊格式無效")
        city = str(payload.get("summary", {}).get("city") or "")
        if city not in CITY_ORDER or city in by_city:
            raise ValueError(f"城市啟用名冊重複或不支援：{city or '空白'}")
        schools: list[dict[str, Any]] = []
        for row in payload["schools"]:
            if not isinstance(row, dict):
                raise ValueError(f"{city} 名冊包含非物件學校")
            required = ("city", "district", "level", "name", "fullName", "fatraceSchoolId")
            missing = [key for key in required if row.get(key) in (None, "")]
            if missing:
                raise ValueError(f"{city} 名冊缺少欄位：{', '.join(missing)}")
            school_id = int(row["fatraceSchoolId"])
            name_key = (str(row["city"]), str(row["district"]), str(row["name"]))
            if row["city"] != city or school_id <= 0 or school_id in seen_ids:
                raise ValueError(f"學校縣市或 School ID 無效：{row}")
            if name_key in seen_names:
                raise ValueError(f"學校名稱重複：{'/'.join(name_key)}")
            seen_ids.add(school_id)
            seen_names.add(name_key)
            schools.append(dict(row))
        by_city[city] = schools
    missing_cities = [city for city in CITY_ORDER if city not in by_city]
    if missing_cities:
        raise ValueError(f"缺少城市啟用名冊：{'、'.join(missing_cities)}")
    return [school for city in CITY_ORDER for school in by_city[city]]


def partition_city_districts(
    schools: list[dict[str, Any]], *, target_group_size: int = 80
) -> list[dict[str, Any]]:
    if target_group_size <= 0:
        raise ValueError("target_group_size 必須大於零")
    districts: list[str] = []
    counts: Counter[str] = Counter()
    for school in schools:
        district = str(school["district"])
        if district not in counts:
            districts.append(district)
        counts[district] += 1
    if not districts:
        return []
    group_count = max(1, math.ceil(len(schools) / target_group_size))
    groups: list[dict[str, Any]] = []
    current: list[str] = []
    current_count = 0
    remaining_count = len(schools)
    remaining_groups = group_count
    for district in districts:
        district_count = counts[district]
        target = math.ceil(remaining_count / remaining_groups)
        if current and current_count + district_count > target and remaining_groups > 1:
            groups.append({"districts": current, "expectedSchoolCount": current_count})
            remaining_count -= current_count
            remaining_groups -= 1
            current = []
            current_count = 0
        current.append(district)
        current_count += district_count
    if current:
        groups.append({"districts": current, "expectedSchoolCount": current_count})
    return groups


def build_refresh_groups(
    schools: list[dict[str, Any]],
    taichung_plan: dict[str, Any],
    *,
    target_group_size: int = 80,
) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    taichung_schools = [school for school in schools if school["city"] == "臺中市"]
    for source in taichung_plan.get("groups", []):
        districts = list(source.get("districts", []))
        selected = [school for school in taichung_schools if school["district"] in districts]
        expected = int(source.get("expectedSchoolCount") or 0)
        if len(selected) != expected:
            raise ValueError(
                f"臺中第 {source.get('id')} 批預期 {expected} 校，實際 {len(selected)} 校"
            )
        groups.append({
            "id": len(groups) + 1,
            "city": "臺中市",
            "expectedSchoolCount": expected,
            "districts": districts,
        })
    tainan_schools = [school for school in schools if school["city"] == "臺南市"]
    for source in partition_city_districts(
        tainan_schools, target_group_size=target_group_size
    ):
        groups.append({
            "id": len(groups) + 1,
            "city": "臺南市",
            **source,
        })
    selected_ids: list[int] = []
    for group in groups:
        selected_ids.extend(
            int(school["fatraceSchoolId"])
            for school in schools
            if school["city"] == group["city"]
            and school["district"] in group["districts"]
        )
    expected_ids = [int(school["fatraceSchoolId"]) for school in schools]
    if len(selected_ids) != len(set(selected_ids)) or set(selected_ids) != set(expected_ids):
        raise ValueError("刷新批次未恰好涵蓋合併名冊中的每所學校")
    return groups


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--taichung",
        type=Path,
        default=PROJECT_ROOT / "data/reference/taichung-active-elementary-schools.json",
    )
    parser.add_argument(
        "--tainan",
        type=Path,
        default=PROJECT_ROOT / "data/reference/tainan-active-elementary-schools.json",
    )
    parser.add_argument(
        "--taichung-groups",
        type=Path,
        default=PROJECT_ROOT / "data/reference/taichung-school-refresh-groups.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data/reference/active-elementary-schools.json",
    )
    parser.add_argument(
        "--groups-output",
        type=Path,
        default=PROJECT_ROOT / "data/reference/school-refresh-groups.json",
    )
    parser.add_argument("--target-group-size", type=int, default=80)
    args = parser.parse_args(argv)
    payloads = [read_json(args.taichung), read_json(args.tainan)]
    schools = merge_registries(payloads)
    groups = build_refresh_groups(
        schools,
        read_json(args.taichung_groups),
        target_group_size=args.target_group_size,
    )
    by_city = Counter(school["city"] for school in schools)
    registry = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "cityOrder": list(CITY_ORDER),
        "sources": [str(args.taichung.name), str(args.tainan.name)],
        "summary": {
            "cityCount": len(by_city),
            "schoolCount": len(schools),
            "byCity": {city: by_city[city] for city in CITY_ORDER},
        },
        "schools": schools,
    }
    plan = {
        "schemaVersion": 2,
        "cityOrder": list(CITY_ORDER),
        "schoolCount": len(schools),
        "groups": groups,
    }
    write_json_atomic(args.output, registry)
    write_json_atomic(args.groups_output, plan)
    print(json.dumps({"summary": registry["summary"], "groups": groups}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
