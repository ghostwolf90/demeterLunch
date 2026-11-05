#!/usr/bin/env python3
"""Build the 22-city service catalog without enrolling new meal collectors."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
GEOGRAPHIC_ORDER_PATH = (
    PROJECT_ROOT / "data/reference/taiwan-geographic-order.json"
)


def load_geographic_order(
    path: Path = GEOGRAPHIC_ORDER_PATH,
) -> tuple[tuple[str, ...], dict[str, tuple[str, ...]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise ValueError("臺灣地理順序資料格式無效")
    city_order = payload.get("cityOrder")
    district_order = payload.get("districtOrder")
    if (
        not isinstance(city_order, list)
        or not city_order
        or not all(isinstance(city, str) and city for city in city_order)
        or len(city_order) != len(set(city_order))
        or not isinstance(district_order, dict)
        or set(district_order) != set(city_order)
    ):
        raise ValueError("臺灣地理順序缺少完整縣市")
    normalized: dict[str, tuple[str, ...]] = {}
    for city in city_order:
        districts = district_order.get(city)
        if (
            not isinstance(districts, list)
            or not districts
            or not all(isinstance(district, str) and district for district in districts)
            or len(districts) != len(set(districts))
        ):
            raise ValueError(f"{city}地理順序缺少完整行政區")
        normalized[city] = tuple(districts)
    return tuple(city_order), normalized


TAIWAN_CITY_ORDER, TAIWAN_DISTRICT_ORDER = load_geographic_order()


def district_order_index(city: str, district: str) -> int:
    districts = TAIWAN_DISTRICT_ORDER.get(city)
    if districts is None or district not in districts:
        raise ValueError(f"臺灣地理順序沒有{city}{district}")
    return districts.index(district)


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON 必須是物件：{path}")
    return payload


def build_catalog_payload(
    national_directory: dict[str, Any],
    active_registry: dict[str, Any],
) -> dict[str, Any]:
    national_schools = national_directory.get("schools")
    active_schools = active_registry.get("schools")
    if not isinstance(national_schools, list):
        raise ValueError("全臺學校名錄缺少 schools 陣列")
    if not isinstance(active_schools, list):
        raise ValueError("午餐啟用名冊缺少 schools 陣列")

    official_counts: Counter[str] = Counter()
    for school in national_schools:
        if not isinstance(school, dict):
            raise ValueError("全臺學校名錄包含無效項目")
        if school.get("level") != "國小":
            continue
        city = str(school.get("city") or "").strip()
        if not city:
            raise ValueError("全臺國小名錄包含缺少縣市的學校")
        official_counts[city] += 1

    if set(official_counts) != set(TAIWAN_CITY_ORDER):
        missing = sorted(set(TAIWAN_CITY_ORDER) - set(official_counts))
        extra = sorted(set(official_counts) - set(TAIWAN_CITY_ORDER))
        raise ValueError(f"全臺國小縣市不完整；缺少={missing}，額外={extra}")

    active_counts: Counter[str] = Counter()
    for school in active_schools:
        if not isinstance(school, dict):
            raise ValueError("午餐啟用名冊包含無效項目")
        city = str(school.get("city") or "").strip()
        if city not in official_counts:
            raise ValueError(f"午餐啟用名冊包含全臺名錄外縣市：{city or '空白'}")
        active_counts[city] += 1

    configured_order = active_registry.get("cityOrder")
    if not isinstance(configured_order, list) or not all(
        isinstance(city, str) and city in official_counts for city in configured_order
    ):
        raise ValueError("午餐啟用名冊的 cityOrder 無效")
    collection_cities = set(configured_order)
    if collection_cities != set(active_counts):
        raise ValueError("午餐啟用名冊的 cityOrder 與實際學校縣市不一致")
    expected_collection_order = [
        city for city in TAIWAN_CITY_ORDER if city in collection_cities
    ]
    if configured_order != expected_collection_order:
        raise ValueError("午餐啟用名冊的 cityOrder 必須依臺灣地理順序排列")

    return {
        "schemaVersion": 1,
        "academicYear": national_directory.get("academicYear"),
        "nationalDirectoryRetrievedAt": national_directory.get("retrievedAt"),
        "activeRegistryGeneratedAt": active_registry.get("generatedAt"),
        "cities": [
            {
                "name": city,
                "schoolCount": official_counts[city],
                "mealUnitCount": active_counts[city],
                "collectionEnabled": city in collection_cities,
            }
            for city in TAIWAN_CITY_ORDER
        ],
    }


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--national-directory",
        type=Path,
        default=PROJECT_ROOT / "data/reference/national-school-directory.json",
    )
    parser.add_argument(
        "--active-registry",
        type=Path,
        default=PROJECT_ROOT / "data/reference/active-elementary-schools.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data/reference/city-service-catalog.json",
    )
    args = parser.parse_args(argv)
    payload = build_catalog_payload(
        read_json(args.national_directory),
        read_json(args.active_registry),
    )
    write_json_atomic(args.output, payload)
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
