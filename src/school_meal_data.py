from __future__ import annotations

import copy
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

from .fatrace_daily import candidate_fingerprint, write_json_atomic


REVIEWED_RECORD_GLOB = "schools/fatrace/*/*.json"
PUBLIC_RECORD_STATUSES = {"available", "no_meal"}


class SchoolMealValidationError(ValueError):
    """Raised when an official daily school-meal record is not publishable."""


def load_reviewed_school_meals(parsed_root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()
    for path in sorted(parsed_root.glob(REVIEWED_RECORD_GLOB)):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SchoolMealValidationError(f"無法讀取 {path}: {exc}") from exc
        validate_reviewed_school_meal(payload, path)
        school_id = int(payload["school"]["fatraceSchoolId"])
        key = (school_id, payload["mealDate"])
        if key in seen:
            raise SchoolMealValidationError(
                f"{path}: 學校 {school_id} 的 {payload['mealDate']} 紀錄重複"
            )
        seen.add(key)
        payload["_path"] = str(path)
        records.append(payload)
    return records


def promote_candidate(
    candidate: object,
    *,
    reviewed_at: str,
    reviewed_by: str,
) -> dict[str, Any]:
    if not isinstance(candidate, dict):
        raise SchoolMealValidationError("候選紀錄根節點必須是物件")
    payload = copy.deepcopy(candidate)
    payload["review"] = {
        "status": "reviewed",
        "reviewedAt": reviewed_at,
        "reviewedBy": reviewed_by,
        "method": "official-structured-record-validation",
        "note": (
            "已核對官方學校代碼、學校名稱、供餐日期、批次、菜色與食材欄位；"
            "不從菜名推定整餐葷素。"
        ),
    }
    validate_reviewed_school_meal(payload, Path("candidate.json"))
    return payload


def reviewed_record_path(parsed_root: Path, record: dict[str, Any]) -> Path:
    school_id = int(record["school"]["fatraceSchoolId"])
    return (
        parsed_root
        / "schools"
        / "fatrace"
        / str(school_id)
        / f"{record['mealDate']}.json"
    )


def save_reviewed_record(
    parsed_root: Path, record: dict[str, Any]
) -> tuple[str, Path]:
    target = reviewed_record_path(parsed_root, record)
    existing: dict[str, Any] | None = None
    if target.is_file():
        try:
            loaded = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SchoolMealValidationError(f"無法讀取既有校讀紀錄 {target}: {exc}") from exc
        if isinstance(loaded, dict):
            existing = loaded
    if existing and existing.get("contentHash") == record.get("contentHash"):
        validate_reviewed_school_meal(existing, target)
        return "unchanged", target
    write_json_atomic(target, record)
    return ("updated" if existing else "created"), target


def validate_reviewed_school_meal(payload: object, path: Path) -> None:
    if not isinstance(payload, dict):
        raise SchoolMealValidationError(f"{path}: 根節點必須是物件")
    if payload.get("schemaVersion") != 1:
        raise SchoolMealValidationError(f"{path}: 不支援的 schemaVersion")
    if payload.get("recordType") != "official-daily-meal-record":
        raise SchoolMealValidationError(f"{path}: recordType 不正確")

    school = payload.get("school")
    if not isinstance(school, dict):
        raise SchoolMealValidationError(f"{path}: school 必須是物件")
    for key in ("city", "district", "level", "name", "fullName"):
        if not str(school.get(key) or "").strip():
            raise SchoolMealValidationError(f"{path}: school 缺少 {key}")
    try:
        school_id = int(school.get("fatraceSchoolId"))
    except (TypeError, ValueError) as exc:
        raise SchoolMealValidationError(f"{path}: fatraceSchoolId 無效") from exc
    if school_id <= 0:
        raise SchoolMealValidationError(f"{path}: fatraceSchoolId 必須是正整數")

    meal_date = _iso_date(payload.get("mealDate"), path, "mealDate")
    status = str(payload.get("status") or "")
    if status not in PUBLIC_RECORD_STATUSES:
        raise SchoolMealValidationError(
            f"{path}: 只有 available 或 no_meal 可以公開，收到 {status or '空白'}"
        )
    _iso_datetime(payload.get("fetchedAt"), path, "fetchedAt")

    source = payload.get("source")
    if not isinstance(source, dict) or not source.get("name") or not source.get("url"):
        raise SchoolMealValidationError(f"{path}: source 資料不完整")
    expected_query = f"school={school_id}&period={meal_date.isoformat()}"
    if expected_query not in str(source["url"]):
        raise SchoolMealValidationError(
            f"{path}: source.url 必須包含 {expected_query}"
        )

    review = payload.get("review")
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        raise SchoolMealValidationError(f"{path}: 紀錄必須先完成校讀")
    _iso_datetime(review.get("reviewedAt"), path, "review.reviewedAt")
    if not review.get("reviewedBy") or not review.get("method"):
        raise SchoolMealValidationError(f"{path}: 校讀人與方法不得空白")

    expected_hash = candidate_fingerprint(payload)
    if payload.get("contentHash") != expected_hash:
        raise SchoolMealValidationError(f"{path}: contentHash 與內容不一致")

    services = payload.get("services")
    if not isinstance(services, list):
        raise SchoolMealValidationError(f"{path}: services 必須是陣列")
    meal_count = 0
    batch_ids: set[str] = set()
    for service_index, service in enumerate(services):
        if not isinstance(service, dict):
            raise SchoolMealValidationError(
                f"{path}: services[{service_index}] 必須是物件"
            )
        if not service.get("serviceId") or not service.get("label"):
            raise SchoolMealValidationError(
                f"{path}: services[{service_index}] 缺少代碼或名稱"
            )
        meals = service.get("meals")
        if not isinstance(meals, list):
            raise SchoolMealValidationError(
                f"{path}: services[{service_index}].meals 必須是陣列"
            )
        for meal_index, meal in enumerate(meals):
            _validate_meal(
                meal,
                path,
                meal_date,
                batch_ids,
                f"services[{service_index}].meals[{meal_index}]",
            )
            meal_count += 1

    if status == "available" and meal_count == 0:
        raise SchoolMealValidationError(f"{path}: available 紀錄必須包含餐次")
    if status == "no_meal" and meal_count:
        raise SchoolMealValidationError(f"{path}: no_meal 紀錄不應包含餐次")


def _validate_meal(
    meal: object,
    path: Path,
    expected_date: date,
    batch_ids: set[str],
    label: str,
) -> None:
    if not isinstance(meal, dict):
        raise SchoolMealValidationError(f"{path}: {label} 必須是物件")
    batch_id = str(meal.get("batchDataId") or "").strip()
    if not batch_id or batch_id in batch_ids:
        raise SchoolMealValidationError(f"{path}: {label} 批次缺漏或重複")
    batch_ids.add(batch_id)
    menu_date = str(meal.get("menuDate") or "").replace("/", "-")
    if menu_date != expected_date.isoformat():
        raise SchoolMealValidationError(
            f"{path}: {label} 日期 {menu_date or '空白'} 與 mealDate 不一致"
        )
    if not meal.get("menuType") or not meal.get("kitchenId") or not meal.get("kitchenName"):
        raise SchoolMealValidationError(f"{path}: {label} 餐別或廚房資料不完整")
    _iso_datetime(meal.get("uploadedAt"), path, f"{label}.uploadedAt")
    nutrition = meal.get("nutrition")
    if not isinstance(nutrition, dict):
        raise SchoolMealValidationError(f"{path}: {label}.nutrition 必須是物件")
    dishes = meal.get("dishes")
    if not isinstance(dishes, list) or not dishes:
        raise SchoolMealValidationError(f"{path}: {label} 必須包含菜色")
    for dish_index, dish in enumerate(dishes):
        _validate_dish(dish, path, batch_id, f"{label}.dishes[{dish_index}]")


def _validate_dish(dish: object, path: Path, batch_id: str, label: str) -> None:
    if not isinstance(dish, dict):
        raise SchoolMealValidationError(f"{path}: {label} 必須是物件")
    if not dish.get("dishId") or not dish.get("dishBatchDataId"):
        raise SchoolMealValidationError(f"{path}: {label} 缺少菜色代碼")
    if str(dish.get("batchDataId") or "") != batch_id:
        raise SchoolMealValidationError(f"{path}: {label} 批次代碼不一致")
    name = str(dish.get("name") or "").strip()
    if not name or name == "調味料":
        raise SchoolMealValidationError(f"{path}: {label} 菜名無效")
    if not str(dish.get("category") or "").strip():
        raise SchoolMealValidationError(f"{path}: {label} 缺少菜色分類")
    ingredients = dish.get("ingredients")
    if not isinstance(ingredients, list):
        raise SchoolMealValidationError(f"{path}: {label}.ingredients 必須是陣列")
    for ingredient_index, ingredient in enumerate(ingredients):
        ingredient_label = f"{label}.ingredients[{ingredient_index}]"
        if not isinstance(ingredient, dict) or not ingredient.get("name"):
            raise SchoolMealValidationError(f"{path}: {ingredient_label} 缺少名稱")
        certifications = ingredient.get("certifications")
        if not isinstance(certifications, list):
            raise SchoolMealValidationError(
                f"{path}: {ingredient_label}.certifications 必須是陣列"
            )
        for certification in certifications:
            if not isinstance(certification, dict) or not certification.get("name"):
                raise SchoolMealValidationError(
                    f"{path}: {ingredient_label} 認證資料不完整"
                )


def _iso_date(value: object, path: Path, label: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise SchoolMealValidationError(f"{path}: {label} 日期格式錯誤") from exc


def _iso_datetime(value: object, path: Path, label: str) -> datetime:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise SchoolMealValidationError(f"{path}: {label} 時間格式錯誤") from exc
