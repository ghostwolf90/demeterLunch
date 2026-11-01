#!/usr/bin/env python3
"""Build a reviewed Tainan elementary-school registry from public official pages."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import re
import sys
from typing import Any, Callable
from urllib.parse import urlencode, urlsplit, urlunsplit

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.http_client import HttpClient, RequestError  # noqa: E402


TAINAN_DIRECTORY_URL = (
    "https://soa.tainan.gov.tw/Api/Service/Get/"
    "b32ffde3-b030-4445-80a3-e83f06477c78"
)
FATRACE_ROOT = "https://fatraceschool.k12ea.gov.tw"
USER_AGENT = (
    "DemeterLunchCollector/0.3 "
    "(+https://haohaofood.cc/; official Tainan school registry bootstrap)"
)
MAX_DIRECTORY_BYTES = 2 * 1024 * 1024
MAX_HTML_BYTES = 4 * 1024 * 1024
MAX_SCHOOL_BYTES = 128 * 1024
SCHOOL_ID_PATTERNS = (
    re.compile(r"search\.html\?[^\"'<>]*?\bschool=(\d+)", re.I),
    re.compile(r"[?&]SchoolId=(\d+)", re.I),
    re.compile(
        r"https?://fatraceschool\.k12ea\.gov\.tw/school/(\d+)(?:[?\"'<>/]|$)",
        re.I,
    ),
)


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


def tainan_candidates(national_directory: dict[str, Any]) -> list[dict[str, Any]]:
    rows = national_directory.get("schools")
    if not isinstance(rows, list):
        raise ValueError("教育部名錄缺少 schools")
    candidates = [
        row
        for row in rows
        if isinstance(row, dict)
        and row.get("city") == "臺南市"
        and row.get("level") == "國小"
    ]
    if not candidates:
        raise ValueError("教育部名錄找不到臺南市國小")
    return sorted(candidates, key=lambda row: str(row.get("directoryId") or ""))


def parse_tainan_directory(raw: bytes) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    payload = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise ValueError("臺南市政府學校名錄回應無效")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise ValueError("臺南市政府學校名錄缺少 data")
    by_code: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get("Edu_code") or "").strip()
        if not re.fullmatch(r"[0-9A-Z]{6}", code):
            continue
        current = by_code.get(code)
        if current is None or (
            str(row.get("Stage") or "") == "國小"
            and str(current.get("Stage") or "") != "國小"
        ):
            by_code[code] = row
    return payload, by_code


def lunch_page_urls(*values: object, meal_date: date) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for raw_value in values:
        raw = str(raw_value or "").strip()
        if not raw:
            continue
        if not re.match(r"^https?://", raw, re.I):
            raw = "https://" + raw.lstrip("/")
        split = urlsplit(raw)
        if not split.hostname:
            continue
        base_path = split.path.rstrip("/")
        if "/modules/" in base_path:
            base_path = base_path.split("/modules/", 1)[0]
        path = base_path + "/modules/tad_lunch3/index.php"
        query = urlencode({"period": meal_date.isoformat()})
        schemes = [split.scheme]
        if split.scheme == "http":
            schemes.insert(0, "https")
        for scheme in schemes:
            for candidate in (
                urlunsplit((scheme, split.netloc, base_path + "/", "", "")),
                urlunsplit((scheme, split.netloc, path, query, "")),
            ):
                if candidate not in seen:
                    seen.add(candidate)
                    urls.append(candidate)
    return urls


def extract_school_ids(html: str) -> set[int]:
    return {
        int(value)
        for pattern in SCHOOL_ID_PATTERNS
        for value in pattern.findall(html)
        if int(value) > 0
    }


def normalize_name(value: object) -> str:
    text = str(value or "").strip().replace("台", "臺")
    text = re.sub(r"^(?:國立|市立|私立)", "", text)
    text = text.replace("國民小學", "國小").replace("國民中小學", "國中小")
    text = text.replace("實驗小學", "實小").replace("實驗國小", "實小")
    text = text.replace("小學", "國小")
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]", "", text)


def school_name_matches(candidate: dict[str, Any], official_name: str) -> bool:
    district = str(candidate.get("district") or "")
    short = official_name.replace("臺南市", "", 1)
    if district and short.startswith(district):
        short = short[len(district):]
    expected = normalize_name(candidate.get("name"))
    actual = normalize_name(short)
    return expected == actual or (
        min(len(expected), len(actual)) >= 4
        and (expected in actual or actual in expected)
    )


def verified_school(
    client: HttpClient,
    school_id: int,
    candidate: dict[str, Any],
    area_ids: dict[str, int],
) -> dict[str, Any]:
    response = client.get(
        f"{FATRACE_ROOT}/school/{school_id}",
        max_bytes=MAX_SCHOOL_BYTES,
        accept="application/json",
    )
    payload = json.loads(response.data.decode("utf-8"))
    school = payload.get("data") if isinstance(payload, dict) else None
    if payload.get("result") != 1 or not isinstance(school, dict):
        raise ValueError("中央平臺單校回應無效")
    if int(school.get("SchoolId") or 0) != school_id:
        raise ValueError("中央平臺 School ID 不一致")
    if int(school.get("SchoolType") or 0) != 2:
        raise ValueError("中央平臺學段不是國小")
    if int(school.get("ConuntyId") or school.get("CountyId") or 0) != 33:
        raise ValueError("中央平臺縣市不是臺南市")
    district = str(candidate.get("district") or "")
    if district not in area_ids or int(school.get("AreaId") or 0) != area_ids[district]:
        raise ValueError("中央平臺行政區與官方名錄不一致")
    full_name = str(school.get("SchoolName") or "").strip()
    if not school_name_matches(candidate, full_name):
        raise ValueError(
            f"中央平臺校名不一致：候選 {candidate.get('name')}，回應 {full_name}"
        )
    short_name = full_name.removeprefix("臺南市")
    if short_name.startswith(district):
        short_name = short_name[len(district):]
    return {
        "city": "臺南市",
        "district": district,
        "level": (
            "高中附設國小" if candidate.get("attachedDepartment") else "國小"
        ),
        "name": short_name,
        "fullName": full_name,
        "fatraceSchoolId": school_id,
        "moeSchoolCode": str(candidate.get("moeSchoolCode") or ""),
    }


def resolve_verified_school(
    school_ids: set[int],
    verifier: Callable[[int], dict[str, Any]],
    seen_ids: set[int],
) -> tuple[int, dict[str, Any]]:
    matches: list[tuple[int, dict[str, Any]]] = []
    errors: list[str] = []
    for school_id in sorted(school_ids):
        try:
            school = verifier(school_id)
            if school_id in seen_ids:
                raise ValueError("School ID 與其他學校重複")
        except (RequestError, ValueError, json.JSONDecodeError) as exc:
            errors.append(f"{school_id}: {exc}")
            continue
        matches.append((school_id, school))
    if len(matches) != 1:
        detail = "；".join(errors[-4:])
        raise ValueError(
            f"{len(school_ids)} 個公開 School ID 中有 {len(matches)} 個通過核對"
            + (f"（{detail}）" if detail else "")
        )
    return matches[0]


def fetch_area_ids(client: HttpClient) -> dict[str, int]:
    response = client.get(
        f"{FATRACE_ROOT}/area/?CountyId=33",
        max_bytes=MAX_SCHOOL_BYTES,
        accept="application/json",
    )
    payload = json.loads(response.data.decode("utf-8"))
    rows = payload.get("data") if isinstance(payload, dict) else None
    if payload.get("result") != 1 or not isinstance(rows, list):
        raise ValueError("中央平臺臺南行政區回應無效")
    area_ids = {
        str(row.get("Area") or "").strip(): int(row.get("AreaId") or 0)
        for row in rows
        if isinstance(row, dict)
    }
    if len(area_ids) != 37 or any(value <= 0 for value in area_ids.values()):
        raise ValueError(f"中央平臺臺南行政區數量異常：{len(area_ids)}")
    return area_ids


def build_registry(
    *,
    candidates: list[dict[str, Any]],
    city_rows: dict[str, dict[str, Any]],
    meal_date: date,
    page_client: HttpClient,
    central_client: HttpClient,
    area_ids: dict[str, int],
    existing_map: dict[str, Any] | None = None,
    checkpoint: Callable[[list[dict[str, Any]], list[dict[str, Any]]], None] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    schools: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    saved = existing_map or {}
    seen_ids: set[int] = set()
    for position, candidate in enumerate(candidates, start=1):
        code = str(candidate.get("moeSchoolCode") or "")
        city_row = city_rows.get(code, {})
        district = str(city_row.get("District") or "").strip()
        if district not in area_ids:
            results.append({
                "moeSchoolCode": code,
                "name": candidate.get("name"),
                "status": "unmatched",
                "error": f"臺南市政府名錄行政區無效：{district or '空白'}",
            })
            if checkpoint:
                checkpoint(schools, results)
            continue
        enriched = {**candidate, "district": district}
        page_urls = lunch_page_urls(
            city_row.get("URL"), candidate.get("website"), meal_date=meal_date
        )
        school_ids: set[int] = set()
        discovery_url: str | None = None
        errors: list[str] = []
        saved_id = saved.get(code)
        if isinstance(saved_id, int) and saved_id > 0:
            school_ids.add(saved_id)
            discovery_url = "reviewed-map"
        else:
            for page_url in page_urls:
                try:
                    html = page_client.get(
                        page_url,
                        max_bytes=MAX_HTML_BYTES,
                        accept="text/html,application/xhtml+xml",
                    ).text()
                except RequestError as exc:
                    errors.append(f"{page_url}: {exc}")
                    continue
                found = extract_school_ids(html)
                if found:
                    school_ids.update(found)
                    discovery_url = page_url
                    break
        if not school_ids:
            results.append({
                "moeSchoolCode": code,
                "name": candidate.get("name"),
                "district": district,
                "status": "unmatched",
                "pageUrls": page_urls,
                "error": (
                    "；".join(errors[-2:]) or "公開午餐頁未提供 School ID"
                ),
            })
            logging.info("[%s/%s] %s：未配對", position, len(candidates), candidate.get("name"))
            if checkpoint:
                checkpoint(schools, results)
            continue
        try:
            school_id, school = resolve_verified_school(
                school_ids,
                lambda value: verified_school(
                    central_client, value, enriched, area_ids
                ),
                seen_ids,
            )
        except (RequestError, ValueError, json.JSONDecodeError) as exc:
            results.append({
                "moeSchoolCode": code,
                "name": candidate.get("name"),
                "district": district,
                "status": "rejected",
                "discoveredSchoolIds": sorted(school_ids),
                "discoveryUrl": discovery_url,
                "error": str(exc),
            })
            logging.info("[%s/%s] %s：驗證失敗", position, len(candidates), candidate.get("name"))
            if checkpoint:
                checkpoint(schools, results)
            continue
        seen_ids.add(school_id)
        schools.append(school)
        results.append({
            "moeSchoolCode": code,
            "name": candidate.get("name"),
            "district": district,
            "status": "verified",
            "fatraceSchoolId": school_id,
            "fullName": school["fullName"],
            "discoveryUrl": discovery_url,
        })
        logging.info("[%s/%s] %s：%s", position, len(candidates), school["name"], school_id)
        if checkpoint:
            checkpoint(schools, results)
    return schools, results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date", type=date.fromisoformat, default=date(2026, 10, 30),
        help="用於公開校網午餐頁的查詢日期（預設 2026-10-30）",
    )
    parser.add_argument(
        "--national-directory",
        type=Path,
        default=PROJECT_ROOT / "data/reference/national-school-directory.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data/reference/tainan-active-elementary-schools.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=PROJECT_ROOT / "data/reference/tainan-school-registry-report.json",
    )
    parser.add_argument(
        "--reviewed-map",
        type=Path,
        default=PROJECT_ROOT / "data/reference/tainan-reviewed-school-ids.json",
    )
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--interval", type=float, default=0.25)
    parser.add_argument("--retries", type=int, default=1)
    args = parser.parse_args(argv)
    if args.timeout <= 0 or args.interval < 0 or args.retries < 0:
        parser.error("逾時必須大於零，請求間隔及重試次數不得小於零")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    directory_client = HttpClient(
        timeout=args.timeout,
        min_interval=args.interval,
        retries=args.retries,
        user_agent=USER_AGENT,
    )
    raw = directory_client.get(
        TAINAN_DIRECTORY_URL,
        max_bytes=MAX_DIRECTORY_BYTES,
        accept="application/json",
    ).data
    _, city_rows = parse_tainan_directory(raw)
    candidates = tainan_candidates(read_json(args.national_directory))
    area_ids = fetch_area_ids(directory_client)
    existing_map: dict[str, Any] = {}
    if args.reviewed_map.is_file():
        reviewed = read_json(args.reviewed_map)
        values = reviewed.get("schools", reviewed)
        if isinstance(values, dict):
            existing_map = values
    if args.report.is_file():
        previous = read_json(args.report)
        for item in previous.get("results", []):
            if (
                isinstance(item, dict)
                and item.get("status") == "verified"
                and isinstance(item.get("fatraceSchoolId"), int)
            ):
                existing_map.setdefault(
                    str(item.get("moeSchoolCode") or ""), item["fatraceSchoolId"]
                )
    page_client = HttpClient(
        timeout=args.timeout,
        min_interval=args.interval,
        retries=args.retries,
        user_agent=USER_AGENT,
    )
    central_client = HttpClient(
        timeout=args.timeout,
        min_interval=args.interval,
        retries=args.retries,
        user_agent=USER_AGENT,
    )
    retrieved_at = datetime.now(timezone.utc).isoformat()

    def checkpoint(schools: list[dict[str, Any]], results: list[dict[str, Any]]) -> None:
        write_json_atomic(args.report, {
            "schemaVersion": 1,
            "retrievedAt": retrieved_at,
            "mealDiscoveryDate": args.date.isoformat(),
            "candidateSchoolCount": len(candidates),
            "completedCandidateCount": len(results),
            "statusCounts": dict(sorted(Counter(item["status"] for item in results).items())),
            "results": results,
        })

    try:
        schools, results = build_registry(
            candidates=candidates,
            city_rows=city_rows,
            meal_date=args.date,
            page_client=page_client,
            central_client=central_client,
            area_ids=area_ids,
            existing_map=existing_map,
            checkpoint=checkpoint,
        )
    except KeyboardInterrupt:
        print("\n已中斷並保存名冊發現進度；重跑會沿用已驗證的 School ID。", file=sys.stderr)
        return 130
    status_counts = Counter(item["status"] for item in results)
    digest = hashlib.sha256(raw).hexdigest()
    archive = args.output.parent / "tainan-school-directory-raw"
    archive.mkdir(parents=True, exist_ok=True)
    archive_path = archive / f"tainan-schools-{digest}.json"
    if archive_path.exists() and archive_path.read_bytes() != raw:
        raise ValueError(f"臺南市政府名錄封存雜湊衝突：{archive_path}")
    if not archive_path.exists():
        archive_path.write_bytes(raw)
    registry = {
        "schemaVersion": 1,
        "source": {
            "name": "臺南市政府教育局各級學校基本資料與各校公開午餐頁",
            "directoryUrl": TAINAN_DIRECTORY_URL,
            "directorySha256": digest,
            "directoryRawFile": archive_path.name,
            "mealDiscoveryDate": args.date.isoformat(),
            "fatraceCountyId": 33,
            "schoolType": 2,
            "note": "僅納入經公開校網取得 School ID，並由中央平臺單校端點核對縣市、行政區、學段及校名的學校。",
        },
        "summary": {
            "city": "臺南市",
            "candidateSchoolCount": len(candidates),
            "districtCount": len({school["district"] for school in schools}),
            "schoolCount": len(schools),
            "unmatchedSchoolCount": len(candidates) - len(schools),
        },
        "schools": schools,
    }
    report = {
        "schemaVersion": 1,
        "retrievedAt": retrieved_at,
        "mealDiscoveryDate": args.date.isoformat(),
        "candidateSchoolCount": len(candidates),
        "statusCounts": dict(sorted(status_counts.items())),
        "results": results,
    }
    write_json_atomic(args.output, registry)
    write_json_atomic(args.report, report)
    print(json.dumps({**registry["summary"], "statusCounts": report["statusCounts"]}, ensure_ascii=False))
    return 0 if schools else 1


if __name__ == "__main__":
    raise SystemExit(main())
