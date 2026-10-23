#!/usr/bin/env python3
"""Fetch an inactive MOE directory; never enroll schools in meal collection."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    ("elementary", "國小", False, "6087", "school/{year}/e1_new.json"),
    ("junior", "國中", False, "6088", "opendata/j1_new.json"),
    ("senior", "高中職", False, "6089", "school/{year}/high.json"),
    ("attached_elementary", "國小", True, "28591", "school/{year}/ac.json"),
    ("attached_junior", "國中", True, "28590", "opendata/aj_new.json"),
)


def normalize(rows: list[dict], *, year: int, level: str, attached: bool,
              source_id: str) -> list[dict]:
    schools = []
    seen = set()
    for row in rows:
        if str(row.get("學年度", "")) != str(year):
            continue
        code = str(row.get("代碼", "")).strip()
        name = str(row.get("學校名稱", "")).strip()
        city = re.sub(r"^\[[^]]+\]", "", str(row.get("縣市名稱", ""))).strip()
        if not re.fullmatch(r"[0-9A-Z]{6}", code) or not name or not city:
            raise ValueError(f"Invalid school identity: {row!r}")
        identity = f"moe:{code}:{level}:{'attached' if attached else 'main'}"
        if identity in seen:
            raise ValueError(f"Duplicate school unit: {identity}")
        seen.add(identity)
        schools.append({
            "directoryId": identity,
            "moeSchoolCode": code,
            "name": name,
            "city": city,
            "level": level,
            "attachedDepartment": attached,
            "ownership": str(row.get("公/私立", "")).strip(),
            "address": str(row.get("地址", "")).strip(),
            "phone": str(row.get("電話", "")).strip(),
            "website": str(row.get("網址", "")).strip(),
            "sourceDatasetId": source_id,
            "enabled": False,
            "mealDataStatus": "not_checked",
        })
    if not schools:
        raise ValueError(f"No {year} records for {level} (attached={attached})")
    return schools


def fetch(url: str) -> bytes:
    # curl uses the host certificate store; keep TLS verification enabled.
    return subprocess.run([
        "curl", "--fail", "--silent", "--show-error", "--location",
        "--max-time", "30", "--retry", "1", "--retry-delay", "2",
        "--user-agent", "Demeter/1.0 (public MOE school directory archive)",
        "--header", "Accept: application/json", url,
    ], check=True, capture_output=True, timeout=70).stdout


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=115)
    parser.add_argument("--output", type=Path,
                        default=ROOT / "data/reference/national-school-directory.json")
    args = parser.parse_args()
    schools, sources, downloads = [], [], []
    for key, level, attached, dataset_id, resource in SOURCES:
        if downloads:
            time.sleep(1)
        url = "https://stats.moe.gov.tw/files/" + resource.format(year=args.year)
        raw = fetch(url)
        rows = json.loads(raw.decode("utf-8-sig"))
        if not isinstance(rows, list):
            raise ValueError(f"Expected a JSON list: {url}")
        units = normalize(rows, year=args.year, level=level,
                          attached=attached, source_id=dataset_id)
        digest = hashlib.sha256(raw).hexdigest()
        raw_name = f"{key}-{digest}.json"
        downloads.append((raw_name, raw))
        schools.extend(units)
        sources.append({"datasetId": dataset_id,
                        "catalogUrl": f"https://data.gov.tw/dataset/{dataset_id}",
                        "url": url, "sha256": digest, "rawFile": raw_name,
                        "recordCount": len(units)})
    schools.sort(key=lambda item: item["directoryId"])
    summary = {
        "schoolUnitCount": len(schools),
        "uniqueSchoolCodeCount": len({s["moeSchoolCode"] for s in schools}),
        "cityCount": len({s["city"] for s in schools}),
        "byLevel": dict(sorted(Counter(s["level"] for s in schools).items())),
        "byCity": dict(sorted(Counter(s["city"] for s in schools).items())),
    }
    payload = {
        "schemaVersion": 1, "academicYear": args.year,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "status": "inactive_reference_only",
        "license": "政府資料開放授權條款－第1版",
        "licenseUrl": "https://data.gov.tw/license",
        "provider": "教育部統計處",
        "note": "名冊不代表有供餐或可取得午餐資料；教育部代碼不是校園食材平臺 ID。附設部依學段保留，不視為獨立學校。",
        "sources": sources, "summary": summary, "schools": schools,
    }
    # Validate every download before writing any archive or replacing valid output.
    archive = args.output.parent / "national-school-directory-raw"
    archive.mkdir(parents=True, exist_ok=True)
    for name, raw in downloads:
        path = archive / name
        if path.exists():
            if path.read_bytes() != raw:
                raise ValueError(f"Archive checksum conflict: {path}")
        else:
            path.write_bytes(raw)
    if args.output.exists():
        previous = json.loads(args.output.read_text())
        if all(previous.get(k) == v for k, v in payload.items() if k != "retrievedAt"):
            print(json.dumps({"status": "unchanged", **summary}, ensure_ascii=False))
            return
    staging = args.output.with_suffix(".json.tmp")
    staging.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
    staging.replace(args.output)
    print(json.dumps({"status": "updated", **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
