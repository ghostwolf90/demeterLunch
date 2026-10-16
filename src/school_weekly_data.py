from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any


REVIEWED_WEEKLY_MENU_GLOB = "schools/weekly/*/*.json"
GRADE_GROUPS = {"elementary_lower", "elementary_upper"}
NUTRITION_KEYS = (
    "caloriesKcal",
    "wholeGrainsServings",
    "proteinServings",
    "vegetablesServings",
    "oilsNutsServings",
    "fruitServings",
    "milkServings",
)


class SchoolWeeklyMenuValidationError(ValueError):
    """Raised when a reviewed school weekly menu is not publishable."""


def load_reviewed_school_weekly_menus(parsed_root: Path) -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()
    for path in sorted(parsed_root.glob(REVIEWED_WEEKLY_MENU_GLOB)):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SchoolWeeklyMenuValidationError(f"無法讀取 {path}: {exc}") from exc
        validate_reviewed_school_weekly_menu(payload, path)
        school_id = int(payload["school"]["fatraceSchoolId"])
        for day in payload["days"]:
            key = (school_id, day["date"])
            if key in seen:
                raise SchoolWeeklyMenuValidationError(
                    f"{path}: 學校 {school_id} 的 {day['date']} 週菜單重複"
                )
            seen.add(key)
        payload["_path"] = str(path)
        packages.append(payload)
    return packages


def weekly_menu_overlays(parsed_root: Path) -> tuple[dict[tuple[int, str], dict[str, Any]], set[int]]:
    overlays: dict[tuple[int, str], dict[str, Any]] = {}
    school_ids: set[int] = set()
    for package in load_reviewed_school_weekly_menus(parsed_root):
        school_id = int(package["school"]["fatraceSchoolId"])
        school_ids.add(school_id)
        source = {
            **package["source"],
            "images": {
                key: f"/data/{value}"
                for key, value in package["source"]["images"].items()
            },
        }
        for day in package["days"]:
            overlays[(school_id, day["date"])] = {
                "week": package["week"],
                "startDate": package["startDate"],
                "endDate": package["endDate"],
                "source": source,
                "review": package["review"],
                "dishes": day["dishes"],
                "nutritionSnapshots": day["nutritionSnapshots"],
                "allergenNotes": package.get("allergenNotes", []),
                "menuNotes": package.get("menuNotes", []),
                "nutritionStandard": package.get("nutritionStandard"),
            }
    return overlays, school_ids


def weekly_menu_image_paths(parsed_root: Path) -> set[str]:
    return {
        str(relative)
        for package in load_reviewed_school_weekly_menus(parsed_root)
        for relative in package["source"]["images"].values()
    }


def validate_reviewed_school_weekly_menu(payload: object, path: Path) -> None:
    if not isinstance(payload, dict):
        raise SchoolWeeklyMenuValidationError(f"{path}: 根節點必須是物件")
    if payload.get("schemaVersion") != 1:
        raise SchoolWeeklyMenuValidationError(f"{path}: 不支援的 schemaVersion")
    if payload.get("recordType") != "reviewed-school-weekly-menu":
        raise SchoolWeeklyMenuValidationError(f"{path}: recordType 不正確")

    school = payload.get("school")
    if not isinstance(school, dict):
        raise SchoolWeeklyMenuValidationError(f"{path}: school 必須是物件")
    for key in ("city", "district", "level", "name", "fullName"):
        if not str(school.get(key) or "").strip():
            raise SchoolWeeklyMenuValidationError(f"{path}: school 缺少 {key}")
    try:
        school_id = int(school.get("fatraceSchoolId"))
    except (TypeError, ValueError) as exc:
        raise SchoolWeeklyMenuValidationError(f"{path}: fatraceSchoolId 無效") from exc
    if school_id <= 0:
        raise SchoolWeeklyMenuValidationError(f"{path}: fatraceSchoolId 必須是正整數")

    start = _iso_date(payload.get("startDate"), path, "startDate")
    end = _iso_date(payload.get("endDate"), path, "endDate")
    if start > end:
        raise SchoolWeeklyMenuValidationError(f"{path}: startDate 晚於 endDate")
    if not isinstance(payload.get("week"), int) or payload["week"] <= 0:
        raise SchoolWeeklyMenuValidationError(f"{path}: week 必須是正整數")

    source = payload.get("source")
    images = source.get("images") if isinstance(source, dict) else None
    if not isinstance(source, dict) or not source.get("name") or not source.get("scope"):
        raise SchoolWeeklyMenuValidationError(f"{path}: source 資料不完整")
    if not isinstance(images, dict) or not images.get("overview") or not images.get("servingsNutrition"):
        raise SchoolWeeklyMenuValidationError(f"{path}: source.images 資料不完整")

    review = payload.get("review")
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        raise SchoolWeeklyMenuValidationError(f"{path}: 菜單必須先完成校讀")
    _iso_datetime(review.get("reviewedAt"), path, "review.reviewedAt")
    if not review.get("reviewedBy") or not review.get("method"):
        raise SchoolWeeklyMenuValidationError(f"{path}: 校讀人與方法不得空白")

    days = payload.get("days")
    if not isinstance(days, list) or not days:
        raise SchoolWeeklyMenuValidationError(f"{path}: days 必須是非空陣列")
    seen_dates: set[str] = set()
    for day in days:
        if not isinstance(day, dict):
            raise SchoolWeeklyMenuValidationError(f"{path}: day 必須是物件")
        day_date = _iso_date(day.get("date"), path, "day.date")
        if not start <= day_date <= end:
            raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 不在週日期範圍")
        if day_date.isoformat() in seen_dates:
            raise SchoolWeeklyMenuValidationError(f"{path}: 日期重複 {day_date}")
        seen_dates.add(day_date.isoformat())
        dishes = day.get("dishes")
        if not isinstance(dishes, list) or not dishes:
            raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 沒有菜色")
        for dish in dishes:
            if not isinstance(dish, dict) or not dish.get("category") or not dish.get("name"):
                raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 菜色資料不完整")
            serving_text = dish.get("servingText")
            if serving_text is not None and not isinstance(serving_text, str):
                raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 每份重量格式錯誤")
        snapshots = day.get("nutritionSnapshots")
        if not isinstance(snapshots, list) or len(snapshots) != 2:
            raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 必須包含低、高年級營養分析")
        groups = {snapshot.get("gradeGroup") for snapshot in snapshots if isinstance(snapshot, dict)}
        if groups != GRADE_GROUPS:
            raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 年級群組不完整")
        for snapshot in snapshots:
            nutrition = snapshot.get("nutrition")
            if not isinstance(nutrition, dict) or any(key not in nutrition for key in NUTRITION_KEYS):
                raise SchoolWeeklyMenuValidationError(f"{path}: {day_date} 營養資料不完整")
            for key in NUTRITION_KEYS:
                value = nutrition[key]
                if key == "milkServings" and value is None:
                    continue
                if not isinstance(value, (int, float)) or value < 0:
                    raise SchoolWeeklyMenuValidationError(
                        f"{path}: {day_date} {key} 必須是非負數或允許的未提供值"
                    )


def _iso_date(value: object, path: Path, label: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise SchoolWeeklyMenuValidationError(f"{path}: {label} 日期格式錯誤") from exc


def _iso_datetime(value: object, path: Path, label: str) -> datetime:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise SchoolWeeklyMenuValidationError(f"{path}: {label} 時間格式錯誤") from exc
