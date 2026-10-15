#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fatrace_daily import candidate_fingerprint  # noqa: E402
from src.school_meal_data import (  # noqa: E402
    SchoolMealValidationError,
    validate_reviewed_school_meal,
)


TAIPEI = ZoneInfo("Asia/Taipei")
PROJECT_ID = "appgprj_6abdf96b7f608191942ee50447a69129"
DEFAULT_SITE_URL = "https://zhongxin-lunch-2026.laibit.chatgpt.site"
DEFAULT_TOKEN_FILE = PROJECT_ROOT / ".secrets" / "site_publish_token"
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
USER_AGENT = "DemeterManualPublisher/1.0 (+https://zhongxin-lunch-2026.laibit.chatgpt.site)"


class ManualPublishError(RuntimeError):
    pass


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManualPublishError(f"無法讀取有效 JSON：{path}") from exc


def build_publish_bundle(
    project_root: Path,
    meal_date: date,
    *,
    school_ids: set[int] | None = None,
) -> dict[str, Any]:
    project_root = project_root.resolve()
    date_text = meal_date.isoformat()
    report_path = project_root / "data/raw/fatrace-daily" / date_text / "report.json"
    report = _read_json(report_path)
    if not isinstance(report, dict) or report.get("mealDate") != date_text:
        raise ManualPublishError(f"抓取報告日期不符：{report_path}")

    summary = report.get("summary")
    results = report.get("results")
    if not isinstance(summary, dict) or not isinstance(results, list):
        raise ManualPublishError(f"抓取報告缺少 summary 或 results：{report_path}")
    available = int(summary.get("available", 0))
    no_meal = int(summary.get("noMeal", 0))
    expected = available + no_meal
    school_count = int(summary.get("schools", 0))
    not_published = int(summary.get("notPublished", 0))
    failed = int(summary.get("failed", 0))
    if school_count < 1 or school_count != len(results):
        raise ManualPublishError("抓取報告的學校總數與 results 不一致")
    if expected + not_published + failed != school_count:
        raise ManualPublishError("抓取報告的狀態統計與學校總數不一致")

    normalized_results: list[dict[str, Any]] = []
    seen_school_ids: set[int] = set()
    for result in results:
        if not isinstance(result, dict):
            raise ManualPublishError("抓取報告包含無效的學校結果")
        school_id = int(result.get("fatraceSchoolId", 0))
        status = str(result.get("recordStatus") or "")
        if school_id <= 0 or school_id in seen_school_ids:
            raise ManualPublishError(f"抓取報告包含無效或重複學校代碼：{school_id}")
        if status not in {"available", "no_meal", "not_published", "failed"}:
            raise ManualPublishError(f"學校 {school_id} 的狀態不可發佈：{status or '空白'}")
        seen_school_ids.add(school_id)
        normalized_results.append(result)

    actual_counts = {
        status: sum(
            result.get("recordStatus") == status for result in normalized_results
        )
        for status in ("available", "no_meal", "not_published", "failed")
    }
    if actual_counts != {
        "available": available,
        "no_meal": no_meal,
        "not_published": not_published,
        "failed": failed,
    }:
        raise ManualPublishError("抓取報告的狀態統計與 results 不一致")

    if school_ids is not None:
        if not school_ids:
            raise ManualPublishError("指定的發佈學校不得為空")
        missing = school_ids - seen_school_ids
        if missing:
            raise ManualPublishError(
                f"抓取報告找不到學校代碼：{', '.join(map(str, sorted(missing)))}"
            )
        selected_results = [
            result
            for result in normalized_results
            if int(result.get("fatraceSchoolId", 0)) in school_ids
        ]
    else:
        if failed:
            raise ManualPublishError("當日仍有抓取失敗的學校，拒絕發佈")
        selected_results = normalized_results

    selected_failed = [
        result for result in selected_results if result.get("recordStatus") == "failed"
    ]
    if selected_failed:
        raise ManualPublishError("發佈批次不得包含抓取失敗的學校")

    report_results: list[dict[str, Any]] = []
    reviewed_records: list[dict[str, Any]] = []
    selected_available = 0
    selected_no_meal = 0
    selected_not_published = 0
    for result in selected_results:
        school_id = int(result.get("fatraceSchoolId", 0))
        status = str(result.get("recordStatus") or "")
        report_results.append(
            {
                "schoolId": school_id,
                "school": str(result.get("school") or ""),
                "status": status,
            }
        )
        if status == "not_published":
            selected_not_published += 1
            continue
        if status == "available":
            selected_available += 1
        elif status == "no_meal":
            selected_no_meal += 1

        record_path = (
            project_root
            / "data/parsed/schools/fatrace"
            / str(school_id)
            / f"{date_text}.json"
        )
        if not record_path.is_file():
            raise ManualPublishError(
                f"找不到已校讀紀錄：{record_path}；"
                f"請先執行 python3 scripts/review_school_meals.py --date {date_text}"
            )
        record = _read_json(record_path)
        if not isinstance(record, dict):
            raise ManualPublishError(f"reviewed 紀錄不是物件：{record_path}")
        record_school = record.get("school")
        review = record.get("review")
        if (
            record.get("mealDate") != date_text
            or record.get("status") != status
            or not isinstance(record_school, dict)
            or int(record_school.get("fatraceSchoolId", 0)) != school_id
            or not isinstance(review, dict)
            or review.get("status") != "reviewed"
        ):
            raise ManualPublishError(f"reviewed 紀錄內容與報告不一致：{record_path}")
        try:
            validate_reviewed_school_meal(record, record_path)
        except SchoolMealValidationError as exc:
            raise ManualPublishError(str(exc)) from exc
        fingerprint_json = json.dumps(
            {
                "school": record.get("school"),
                "mealDate": record.get("mealDate"),
                "status": record.get("status"),
                "noMealReasons": record.get("noMealReasons"),
                "services": record.get("services"),
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        if hashlib.sha256(fingerprint_json.encode("utf-8")).hexdigest() != record.get(
            "contentHash"
        ) or candidate_fingerprint(record) != record.get("contentHash"):
            raise ManualPublishError(f"reviewed 紀錄雜湊不一致：{record_path}")
        record_json = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
        reviewed_records.append(
            {
                "schoolId": school_id,
                "recordJson": record_json,
                "recordSha256": hashlib.sha256(record_json.encode("utf-8")).hexdigest(),
                "fingerprintJson": fingerprint_json,
            }
        )

    selected_expected = selected_available + selected_no_meal
    if len(reviewed_records) != selected_expected:
        raise ManualPublishError(
            f"reviewed 紀錄數不符：應有 {selected_expected}，"
            f"實際 {len(reviewed_records)}"
        )

    return {
        "schemaVersion": 1,
        "kind": "demeter-reviewed-school-meals",
        "projectId": PROJECT_ID,
        "mealDate": date_text,
        "createdAt": datetime.now(TAIPEI).isoformat(),
        "reportSummary": {
            "schools": len(selected_results),
            "available": selected_available,
            "noMeal": selected_no_meal,
            "notPublished": selected_not_published,
            "failed": 0,
        },
        "results": report_results,
        "records": reviewed_records,
    }


def _read_token(path: Path) -> str:
    try:
        token = path.read_text(encoding="utf-8").strip()
        mode = path.stat().st_mode & 0o777
    except OSError as exc:
        raise ManualPublishError(
            f"找不到本機發佈憑證：{path}；請先完成一次手動發佈設定"
        ) from exc
    if len(token) < 32:
        raise ManualPublishError(f"本機發佈憑證無效：{path}")
    if mode & 0o077:
        raise ManualPublishError(f"發佈憑證權限過寬，請執行：chmod 600 {path}")
    return token


def publish_bundle(
    bundle: dict[str, Any],
    site_url: str,
    token: str,
    *,
    timeout: float = 120.0,
    retries: int = 2,
) -> dict[str, Any]:
    body = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_UPLOAD_BYTES:
        raise ManualPublishError(
            f"發佈包超過 {MAX_UPLOAD_BYTES // 1024 // 1024} MiB 上限"
        )
    endpoint = f"{site_url.rstrip('/')}/api/admin/publish"
    if not endpoint.startswith("https://"):
        raise ManualPublishError("公開 Site 發佈網址必須使用 HTTPS")
    ssl_context = _verified_ssl_context()

    for attempt in range(retries + 1):
        request = urllib.request.Request(
            endpoint,
            data=body,
            method="POST",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": USER_AGENT,
            },
        )
        try:
            with urllib.request.urlopen(
                request,
                timeout=timeout,
                context=ssl_context,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict) or payload.get("status") != "published":
                raise ManualPublishError("Site 回傳了無效的發佈結果")
            return payload
        except urllib.error.HTTPError as exc:
            message = _http_error_message(exc)
            if exc.code not in {429, 500, 502, 503, 504} or attempt >= retries:
                raise ManualPublishError(f"Site 發佈失敗（HTTP {exc.code}）：{message}") from exc
        except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
            if attempt >= retries:
                raise ManualPublishError(f"無法連線到 Site：{exc}") from exc
        time.sleep(2**attempt)
    raise ManualPublishError("Site 發佈失敗")


def _verified_ssl_context() -> ssl.SSLContext:
    certificate_files: list[Path] = []
    try:
        import certifi

        certificate_files.append(Path(certifi.where()))
    except ImportError:
        pass

    default_file = ssl.get_default_verify_paths().cafile
    if default_file:
        certificate_files.append(Path(default_file))
    certificate_files.extend(
        [
            Path("/etc/ssl/cert.pem"),
            Path("/opt/homebrew/etc/openssl@3/cert.pem"),
            Path("/usr/local/etc/openssl@3/cert.pem"),
        ]
    )
    for certificate_file in certificate_files:
        if certificate_file.is_file():
            return ssl.create_default_context(cafile=str(certificate_file))
    return ssl.create_default_context()


def _http_error_message(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("error"), str):
            return payload["error"]
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        pass
    return "伺服器拒絕這次發佈"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="將本機已校讀的單校或多校同日午餐發佈到既有 Site。"
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(TAIPEI).date(),
        help="要發佈的供餐日期，預設為臺北時區今天",
    )
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL, help=argparse.SUPPRESS)
    parser.add_argument(
        "--token-file", type=Path, default=DEFAULT_TOKEN_FILE, help=argparse.SUPPRESS
    )
    parser.add_argument(
        "--school-id",
        action="append",
        type=int,
        default=[],
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="只驗證本機發佈包，不送到 Site"
    )
    args = parser.parse_args(argv)

    try:
        bundle = build_publish_bundle(
            PROJECT_ROOT,
            args.date,
            school_ids=set(args.school_id) if args.school_id else None,
        )
        if args.dry_run:
            result = {
                "status": "ready",
                "mealDate": bundle["mealDate"],
                "submittedSchools": bundle["reportSummary"]["schools"],
                "reviewedRecords": len(bundle["records"]),
                "siteUrl": args.site_url,
            }
        else:
            token = _read_token(args.token_file.resolve())
            result = publish_bundle(bundle, args.site_url, token)
    except ManualPublishError as exc:
        parser.error(str(exc))

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
