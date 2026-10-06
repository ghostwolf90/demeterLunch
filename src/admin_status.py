from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


TAIPEI = ZoneInfo("Asia/Taipei")
AUTOMATION_NAME = "每月校園食材資料更新"


def load_admin_status(
    project_root: Path,
    *,
    automation_root: Path | None = None,
) -> dict[str, Any]:
    project_root = project_root.resolve()
    raw_root = project_root / "data" / "raw" / "fatrace-openapi"
    parsed_root = project_root / "data" / "parsed" / "traceability"
    database_path = project_root / "data" / "lunch.db"
    static_data_path = project_root / "dist" / "data" / "site-data.json"
    deployment_path = project_root / "data" / "monitor" / "site-deployment.json"
    secret_path = project_root / ".secrets" / "fatrace_access_code"

    schedule = _load_schedule(automation_root or _default_automation_root())
    access_code = _secret_status(secret_path)
    latest_import = _load_latest_import(raw_root)
    traceability = _load_latest_traceability(parsed_root)
    database = _load_database_status(database_path)
    static_site = _load_static_site_status(static_data_path)
    site_deployment = _load_site_deployment(deployment_path)

    warnings: list[str] = []
    if not schedule["found"]:
        warnings.append("找不到每月校園食材資料更新排程。")
    elif schedule["status"] != "ACTIVE":
        warnings.append("每月更新排程目前不是啟用狀態。")
    if not access_code["configured"]:
        warnings.append("尚未設定 OpenAPI access code。")
    elif not access_code["permissionsSecure"]:
        warnings.append("access code 檔案權限不是僅限目前使用者。")
    if not latest_import["found"]:
        warnings.append("尚未找到 OpenAPI 下載紀錄。")
    elif latest_import["missingFiles"]:
        warnings.append("最新月份有下載檔案遺失或大小不符。")
    if not traceability["found"]:
        warnings.append("尚未找到 reviewed 食材追溯資料。")
    if not database["found"]:
        warnings.append("SQLite 資料庫尚未建立。")
    elif database.get("error"):
        warnings.append("SQLite 資料庫無法讀取。")
    if not static_site["found"]:
        warnings.append("靜態網站資料尚未建立。")
    if not site_deployment["found"]:
        warnings.append("尚未記錄公開 Site 的發布結果。")

    import_month = latest_import.get("sourceMonth")
    trace_month = traceability.get("sourceMonth")
    if import_month and trace_month and import_month != trace_month:
        warnings.append("最新 CSV 月份與 reviewed 追溯資料月份不一致。")
    deployed_month = site_deployment.get("sourceMonth")
    if import_month and deployed_month and import_month != deployed_month:
        warnings.append("最新本機資料尚未發布到公開 Site。")

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(TAIPEI).isoformat(timespec="seconds"),
        "status": "healthy" if not warnings else "attention",
        "warnings": warnings,
        "schedule": schedule,
        "accessCode": access_code,
        "latestImport": latest_import,
        "traceability": traceability,
        "database": database,
        "staticSite": static_site,
        "siteDeployment": site_deployment,
    }


def _default_automation_root() -> Path:
    codex_root = os.environ.get("CODEX_HOME")
    if codex_root:
        return Path(codex_root) / "automations"
    return Path.home() / ".codex" / "automations"


def _load_schedule(automation_root: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "found": False,
        "name": AUTOMATION_NAME,
        "status": "UNKNOWN",
        "summary": "尚未找到排程",
    }
    if not automation_root.is_dir():
        return result

    for path in sorted(automation_root.glob("*/automation.toml")):
        try:
            values = _parse_simple_toml(path.read_text(encoding="utf-8"))
        except OSError:
            continue
        if values.get("name") != AUTOMATION_NAME:
            continue
        rrule = str(values.get("rrule") or "")
        return {
            "found": True,
            "name": AUTOMATION_NAME,
            "status": str(values.get("status") or "UNKNOWN"),
            "summary": _schedule_summary(rrule),
            "updatedAt": _milliseconds_to_iso(values.get("updated_at")),
        }
    return result


def _parse_simple_toml(content: str) -> dict[str, str | int]:
    values: dict[str, str | int] = {}
    for line in content.splitlines():
        match = re.match(r'^([a-z_]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$', line)
        if match:
            values[match.group(1)] = bytes(
                match.group(2), "utf-8"
            ).decode("unicode_escape") if "\\" in match.group(2) else match.group(2)
            continue
        number = re.match(r"^([a-z_]+)\s*=\s*(\d+)\s*$", line)
        if number:
            values[number.group(1)] = int(number.group(2))
    return values


def _schedule_summary(rrule: str) -> str:
    rule = rrule.removeprefix("RRULE:")
    values = dict(re.findall(r"(?:^|;)([A-Z]+)=([^;]+)", rule))
    if values.get("FREQ") != "MONTHLY":
        return "自訂排程"
    try:
        day = int(values.get("BYMONTHDAY", "0"))
        hour = int(values.get("BYHOUR", "0"))
        minute = int(values.get("BYMINUTE", "0"))
    except ValueError:
        return "每月自訂時間"
    if not 1 <= day <= 31 or not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return "每月自訂時間"
    return f"每月 {day} 日 {hour:02d}:{minute:02d}"


def _milliseconds_to_iso(value: object) -> str | None:
    if not isinstance(value, int):
        return None
    return datetime.fromtimestamp(value / 1000, timezone.utc).astimezone(TAIPEI).isoformat(
        timespec="seconds"
    )


def _secret_status(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"configured": False, "permissionsSecure": False}
    mode = path.stat().st_mode & 0o777
    return {
        "configured": path.stat().st_size > 0,
        "permissionsSecure": mode & 0o077 == 0,
        "mode": f"{mode:03o}",
    }


def _load_latest_import(raw_root: Path) -> dict[str, Any]:
    manifests: list[tuple[str, Path, dict[str, Any]]] = []
    for path in raw_root.glob("*/manifest.json"):
        payload = _read_json_object(path)
        if payload is None:
            continue
        source_month = str(payload.get("sourceMonth") or "")
        if re.fullmatch(r"\d{4}-\d{2}", source_month):
            manifests.append((source_month, path, payload))
    if not manifests:
        return {"found": False, "datasets": [], "missingFiles": []}

    source_month, path, payload = max(manifests, key=lambda item: item[0])
    datasets: list[dict[str, Any]] = []
    missing_files: list[str] = []
    total_bytes = 0
    for item in payload.get("datasets", []):
        if not isinstance(item, dict):
            continue
        filename = str(item.get("file") or "")
        expected_bytes = int(item.get("bytes") or 0)
        source = path.parent / filename
        available = source.is_file() and source.stat().st_size == expected_bytes
        if not available:
            missing_files.append(filename or "未命名檔案")
        total_bytes += expected_bytes
        datasets.append(
            {
                "name": str(item.get("datasetName") or "未命名資料集"),
                "county": str(item.get("county") or "共用"),
                "grade": str(item.get("grade") or "全部"),
                "createdAt": str(item.get("createdAt") or ""),
                "filename": filename,
                "bytes": expected_bytes,
                "sha256": str(item.get("sha256") or ""),
                "available": available,
            }
        )
    return {
        "found": True,
        "sourceMonth": source_month,
        "datasetCount": len(datasets),
        "totalBytes": total_bytes,
        "datasets": datasets,
        "missingFiles": missing_files,
        "manifestUpdatedAt": _file_modified_iso(path),
    }


def _load_latest_traceability(parsed_root: Path) -> dict[str, Any]:
    packages: list[tuple[str, Path, dict[str, Any]]] = []
    for path in parsed_root.glob("traceability-*.json"):
        payload = _read_json_object(path)
        if payload is None:
            continue
        source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
        source_month = str(source.get("sourceMonth") or "")
        if re.fullmatch(r"\d{4}-\d{2}", source_month):
            packages.append((source_month, path, payload))
    if not packages:
        return {"found": False}

    source_month, path, payload = max(packages, key=lambda item: item[0])
    days = [item for item in payload.get("days", []) if isinstance(item, dict)]
    dishes = [
        dish
        for day in days
        for dish in day.get("dishes", [])
        if isinstance(dish, dict)
    ]
    ingredient_count = sum(
        len([item for item in dish.get("ingredients", []) if isinstance(item, dict)])
        for dish in dishes
    )
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    return {
        "found": True,
        "sourceMonth": source_month,
        "schoolDays": len(days),
        "dishes": len(dishes),
        "ingredients": ingredient_count,
        "firstDate": days[0].get("date") if days else None,
        "lastDate": days[-1].get("date") if days else None,
        "exportedAt": source.get("exportedAt"),
        "updatedAt": _file_modified_iso(path),
    }


def _load_database_status(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"found": False}
    try:
        with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
            ingredients = connection.execute(
                "SELECT COUNT(*) FROM dish_ingredients"
            ).fetchone()[0]
            dates = connection.execute(
                "SELECT COUNT(DISTINCT menu_date) FROM dish_ingredients"
            ).fetchone()[0]
            sources = connection.execute(
                "SELECT COUNT(*) FROM traceability_sources"
            ).fetchone()[0]
    except (sqlite3.Error, OSError) as exc:
        return {
            "found": True,
            "error": str(exc),
            "updatedAt": _file_modified_iso(path),
        }
    return {
        "found": True,
        "traceabilityIngredients": ingredients,
        "traceabilityDates": dates,
        "sources": sources,
        "bytes": path.stat().st_size,
        "updatedAt": _file_modified_iso(path),
    }


def _load_static_site_status(path: Path) -> dict[str, Any]:
    payload = _read_json_object(path)
    if payload is None:
        return {"found": False}
    variants = payload.get("variants") if isinstance(payload.get("variants"), dict) else {}
    meat = variants.get("meat") if isinstance(variants.get("meat"), dict) else {}
    days = meat.get("days") if isinstance(meat.get("days"), list) else []
    return {
        "found": True,
        "generatedAt": payload.get("generatedAt"),
        "menuDays": len(days),
        "updatedAt": _file_modified_iso(path),
    }


def _load_site_deployment(path: Path) -> dict[str, Any]:
    payload = _read_json_object(path)
    if payload is None:
        return {"found": False}
    return {
        "found": True,
        "status": str(payload.get("status") or "unknown"),
        "sourceMonth": payload.get("sourceMonth"),
        "versionNumber": payload.get("versionNumber"),
        "deployedAt": payload.get("deployedAt"),
        "url": payload.get("url"),
    }


def _read_json_object(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _file_modified_iso(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).astimezone(
        TAIPEI
    ).isoformat(timespec="seconds")
