from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from .http_client import HttpClient


API_ROOT = "https://fatraceschool.k12ea.gov.tw"
PUBLIC_SEARCH_URL = f"{API_ROOT}/frontend/search.html"
TAIPEI = ZoneInfo("Asia/Taipei")
DAILY_USER_AGENT = (
    "DemeterLunchCollector/0.2 "
    "(+https://zxes.blogspot.com/; personal non-commercial school lunch archive)"
)
MAX_JSON_BYTES = 8 * 1024 * 1024
STABLE_STATUSES = {"available", "no_meal"}


class FatraceDailyError(RuntimeError):
    """Raised when a public daily-record response cannot be trusted."""


@dataclass(frozen=True)
class School:
    city: str
    district: str
    level: str
    name: str
    full_name: str
    fatrace_school_id: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "city": self.city,
            "district": self.district,
            "level": self.level,
            "name": self.name,
            "fullName": self.full_name,
            "fatraceSchoolId": self.fatrace_school_id,
        }


@dataclass(frozen=True)
class SaveOutcome:
    status: str
    path: Path


def load_school_registry(path: Path) -> list[School]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FatraceDailyError(f"無法讀取學校名冊 {path}: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise FatraceDailyError(f"{path}: 不支援的學校名冊格式")
    rows = payload.get("schools")
    if not isinstance(rows, list) or not rows:
        raise FatraceDailyError(f"{path}: schools 必須是非空陣列")

    schools: list[School] = []
    seen_ids: set[int] = set()
    seen_names: set[tuple[str, str, str]] = set()
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise FatraceDailyError(f"{path}: schools[{index}] 必須是物件")
        required = ("city", "district", "level", "name", "fullName", "fatraceSchoolId")
        missing = [key for key in required if row.get(key) in (None, "")]
        if missing:
            raise FatraceDailyError(
                f"{path}: schools[{index}] 缺少欄位 {', '.join(missing)}"
            )
        try:
            school_id = int(row["fatraceSchoolId"])
        except (TypeError, ValueError) as exc:
            raise FatraceDailyError(
                f"{path}: schools[{index}] fatraceSchoolId 必須是正整數"
            ) from exc
        if school_id <= 0 or school_id in seen_ids:
            raise FatraceDailyError(
                f"{path}: fatraceSchoolId 重複或無效 {school_id}"
            )
        key = (str(row["city"]), str(row["district"]), str(row["name"]))
        if key in seen_names:
            raise FatraceDailyError(f"{path}: 學校重複 {'/'.join(key)}")
        seen_ids.add(school_id)
        seen_names.add(key)
        schools.append(
            School(
                city=key[0],
                district=key[1],
                level=str(row["level"]),
                name=key[2],
                full_name=str(row["fullName"]),
                fatrace_school_id=school_id,
            )
        )
    return schools


class FatraceDailyClient:
    def __init__(self, http: HttpClient, *, include_ingredients: bool = True) -> None:
        self.http = http
        self.include_ingredients = include_ingredients

    def collect(
        self,
        school: School,
        meal_date: date,
        *,
        fetched_at: datetime | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        checked_at = (fetched_at or datetime.now(TAIPEI)).astimezone(TAIPEI)
        date_text = meal_date.isoformat()
        school_response = self._get(f"/school/{school.fatrace_school_id}")
        official_school = _expect_object(school_response["data"], "school.data")
        if int(official_school.get("SchoolId") or 0) != school.fatrace_school_id:
            raise FatraceDailyError(
                f"學校代碼 {school.fatrace_school_id} 的官方回應代碼不一致"
            )
        official_name = str(official_school.get("SchoolName") or "").strip()
        if official_name != school.full_name:
            raise FatraceDailyError(
                f"學校代碼 {school.fatrace_school_id} 預期為 {school.full_name}，"
                f"官方回應為 {official_name or '空白'}"
            )

        base_params = {
            "SchoolId": school.fatrace_school_id,
            "period": date_text,
        }
        service_response = self._get("/offering/service", base_params)
        services = _expect_list(service_response["data"], "offering/service.data")
        lunch_services = [item for item in services if _is_lunch_service(item)]
        kitchen_response = self._get("/offered/kitchen", base_params)
        kitchens = _expect_list(kitchen_response["data"], "offered/kitchen.data")
        kitchen_rows = [
            _expect_object(item, "offered/kitchen.data[]") for item in kitchens
        ]

        raw_lunch_services: list[dict[str, Any]] = []
        normalized_services: list[dict[str, Any]] = []
        no_meal_rows: list[dict[str, Any]] = []
        meal_count = 0

        for service in lunch_services:
            service_id = _positive_int(service.get("ServiceId"), "ServiceId")
            service_label = str(service.get("label") or "午餐").strip()
            no_menu_response = self._get(
                "/nomenudatelist",
                {
                    "schoolId": school.fatrace_school_id,
                    "period": date_text,
                    "menuType": service_id,
                },
            )
            service_no_meal = _expect_list(
                no_menu_response["data"], "nomenudatelist.data"
            )
            no_meal_rows.extend(
                item
                for item in service_no_meal
                if isinstance(item, dict) and _covers_date(item, meal_date)
            )

            raw_meal_queries: list[dict[str, Any]] = []
            normalized_meals: list[dict[str, Any]] = []
            seen_batch_ids: set[int] = set()
            kitchen_queries: list[dict[str, Any] | None] = kitchen_rows or [None]
            for kitchen in kitchen_queries:
                query = {**base_params, "MenuType": service_id}
                if kitchen is not None:
                    query["KitchenId"] = _positive_int(
                        kitchen.get("KitchenId"), "KitchenId"
                    )
                meal_response = self._get("/offered/meal", query)
                meals = _expect_list(meal_response["data"], "offered/meal.data")
                raw_meals: list[dict[str, Any]] = []
                for meal in meals:
                    meal_obj = _expect_object(meal, "offered/meal.data[]")
                    batch_id = _positive_int(
                        meal_obj.get("BatchDataId"), "BatchDataId"
                    )
                    if batch_id in seen_batch_ids:
                        continue
                    seen_batch_ids.add(batch_id)
                    dish_response = self._get("/dish", {"BatchDataId": batch_id})
                    dishes = _expect_list(dish_response["data"], "dish.data")
                    raw_dishes: list[dict[str, Any]] = []
                    normalized_dishes: list[dict[str, Any]] = []
                    for dish in dishes:
                        dish_obj = _expect_object(dish, "dish.data[]")
                        dish_id = _dish_id(dish_obj)
                        if str(dish_obj.get("DishName") or "").strip() == "調味料":
                            raw_dishes.append(
                                {"dish": dish_obj, "ingredients": None}
                            )
                            continue
                        ingredient_response: dict[str, Any] | None = None
                        ingredients: list[Any] = []
                        if self.include_ingredients:
                            ingredient_response = self._get(
                                "/ingredient",
                                {"BatchDataId": batch_id, "DishId": dish_id},
                            )
                            ingredients = _expect_list(
                                ingredient_response["data"], "ingredient.data"
                            )
                        raw_dishes.append(
                            {
                                "dish": dish_obj,
                                "ingredients": ingredient_response,
                            }
                        )
                        normalized_dishes.append(
                            _normalize_dish(dish_obj, ingredients)
                        )
                    raw_meals.append(
                        {
                            "meal": meal_obj,
                            "dishes": raw_dishes,
                        }
                    )
                    normalized_meals.append(
                        _normalize_meal(meal_obj, normalized_dishes)
                    )
                raw_meal_queries.append(
                    {
                        "kitchen": kitchen,
                        "meals": meal_response,
                        "details": raw_meals,
                    }
                )
            meal_count += len(normalized_meals)
            raw_lunch_services.append(
                {
                    "service": service,
                    "noMenuDates": no_menu_response,
                    "mealQueries": raw_meal_queries,
                }
            )
            normalized_services.append(
                {
                    "serviceId": service_id,
                    "label": service_label,
                    "meals": normalized_meals,
                }
            )

        if meal_count:
            record_status = "available"
        elif no_meal_rows:
            record_status = "no_meal"
        else:
            record_status = "not_published"

        source_page = f"{PUBLIC_SEARCH_URL}?{urlencode({'school': school.fatrace_school_id, 'period': date_text})}"
        raw = {
            "schemaVersion": 1,
            "recordType": "official-daily-meal-raw",
            "school": school.as_dict(),
            "mealDate": date_text,
            "fetchedAt": checked_at.isoformat(),
            "source": {
                "name": "教育部校園食材登錄平臺公開查詢頁",
                "url": source_page,
                "apiRoot": API_ROOT,
            },
            "responses": {
                "school": school_response,
                "services": service_response,
                "kitchens": kitchen_response,
                "lunchServices": raw_lunch_services,
            },
        }
        candidate = {
            "schemaVersion": 1,
            "recordType": "official-daily-meal-record",
            "school": school.as_dict(),
            "mealDate": date_text,
            "status": record_status,
            "fetchedAt": checked_at.isoformat(),
            "source": {
                "name": "教育部校園食材登錄平臺公開查詢頁",
                "url": source_page,
                "scope": "當日或歷史實際供餐公開紀錄；不是未來預定菜單",
            },
            "noMealReasons": [_normalize_no_meal(item) for item in no_meal_rows],
            "services": normalized_services,
            "review": {
                "status": "pending",
                "note": "候選資料尚未校讀，不會自動匯入 SQLite 或公開網站。",
            },
        }
        candidate["contentHash"] = candidate_fingerprint(candidate)
        return raw, candidate

    def _get(
        self, path: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        url = f"{API_ROOT}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        response = self.http.get(
            url,
            max_bytes=MAX_JSON_BYTES,
            accept="application/json",
        )
        try:
            payload = json.loads(response.text())
        except json.JSONDecodeError as exc:
            raise FatraceDailyError(f"官方接口不是有效 JSON：{path}") from exc
        if not isinstance(payload, dict):
            raise FatraceDailyError(f"官方接口根節點不是物件：{path}")
        if payload.get("result") not in (1, "1", True):
            message = str(payload.get("message") or "未知錯誤")
            raise FatraceDailyError(f"官方接口拒絕查詢 {path}：{message}")
        if "data" not in payload:
            raise FatraceDailyError(f"官方接口缺少 data：{path}")
        return payload


class DailyMealStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def target_path(self, school: School, meal_date: date) -> Path:
        return self.root / meal_date.isoformat() / str(school.fatrace_school_id)

    def save(
        self,
        school: School,
        meal_date: date,
        raw: dict[str, Any],
        candidate: dict[str, Any],
    ) -> SaveOutcome:
        target = self.target_path(school, meal_date)
        existing = _load_json(target / "candidate.json")
        if existing:
            old_status = str(existing.get("status") or "")
            new_status = str(candidate.get("status") or "")
            if old_status in STABLE_STATUSES and new_status == "not_published":
                return SaveOutcome("preserved", target)
            if existing.get("contentHash") == candidate.get("contentHash"):
                return SaveOutcome("unchanged", target)

        target.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(
            tempfile.mkdtemp(
                prefix=f".{school.fatrace_school_id}-",
                suffix=".tmp",
                dir=target.parent,
            )
        )
        backup: Path | None = None
        try:
            _write_json(staging / "raw.json", raw)
            _write_json(staging / "candidate.json", candidate)
            if target.exists():
                backup = target.with_name(f".{target.name}.backup-{uuid.uuid4().hex}")
                os.replace(target, backup)
            os.replace(staging, target)
        except OSError as exc:
            if backup and backup.exists() and not target.exists():
                os.replace(backup, target)
            raise FatraceDailyError(f"無法原子寫入 {target}: {exc}") from exc
        finally:
            shutil.rmtree(staging, ignore_errors=True)
        if backup:
            shutil.rmtree(backup, ignore_errors=True)
        return SaveOutcome("updated" if existing else "created", target)


def candidate_fingerprint(candidate: dict[str, Any]) -> str:
    content = {
        "school": candidate.get("school"),
        "mealDate": candidate.get("mealDate"),
        "status": candidate.get("status"),
        "noMealReasons": candidate.get("noMealReasons"),
        "services": candidate.get("services"),
    }
    encoded = json.dumps(
        content, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}-", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(payload, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _load_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FatraceDailyError(f"無法讀取既有資料 {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise FatraceDailyError(f"既有資料根節點不是物件：{path}")
    return payload


def _expect_object(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise FatraceDailyError(f"{label} 必須是物件")
    return value


def _expect_list(value: object, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise FatraceDailyError(f"{label} 必須是陣列")
    return value


def _positive_int(value: object, label: str) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise FatraceDailyError(f"{label} 必須是正整數") from exc
    if result <= 0:
        raise FatraceDailyError(f"{label} 必須是正整數")
    return result


def _is_lunch_service(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    label = str(value.get("label") or "").strip()
    return label == "午餐"


def _dish_id(dish: dict[str, Any]) -> int:
    for key in ("DishId", "DishBatchDataId"):
        try:
            value = int(dish.get(key) or 0)
        except (TypeError, ValueError):
            value = 0
        if value > 0:
            return value
    raise FatraceDailyError("菜色缺少 DishId 與 DishBatchDataId")


def _clean(value: object) -> str | int | float | bool | None:
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value).strip()
    return text or None


def _normalize_meal(
    meal: dict[str, Any], dishes: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "batchDataId": _clean(meal.get("BatchDataId")),
        "menuDate": _clean(meal.get("MenuDate")),
        "menuType": _clean(meal.get("MenuType")),
        "menuTypeName": _clean(meal.get("MenuTypeName")),
        "kitchenId": _clean(meal.get("KitchenId")),
        "kitchenName": _clean(meal.get("KitchenName")),
        "uploadedAt": _clean(meal.get("UploadDateTime")),
        "nutrition": {
            "caloriesKcal": _clean(meal.get("Calorie")),
            "wholeGrainsServings": _clean(meal.get("TypeGrains")),
            "proteinServings": _clean(meal.get("TypeMeatBeans")),
            "vegetablesServings": _clean(meal.get("TypeVegetable")),
            "oilsNutsServings": _clean(meal.get("TypeOil")),
            "fruitServings": _clean(meal.get("TypeFruit")),
            "milkServings": _clean(meal.get("TypeMilk")),
        },
        "dishes": dishes,
    }


def _normalize_dish(
    dish: dict[str, Any], ingredients: list[Any]
) -> dict[str, Any]:
    dish_id = _dish_id(dish)
    return {
        "dishId": dish_id,
        "batchDataId": _clean(dish.get("BatchDataId")),
        "dishBatchDataId": _clean(dish.get("DishBatchDataId")),
        "name": _clean(dish.get("DishName")),
        "category": _clean(dish.get("DishType")),
        "imageUrl": (
            f"{API_ROOT}/dish/pic/{dish_id}"
            if int(dish.get("DishId") or 0) > 0
            else _clean(dish.get("DishShowName"))
        ),
        "ingredients": [
            _normalize_ingredient(item)
            for item in ingredients
            if isinstance(item, dict)
        ],
    }


def _normalize_ingredient(ingredient: dict[str, Any]) -> dict[str, Any]:
    certifications = ingredient.get("Certification")
    if not isinstance(certifications, list):
        certifications = []
    return {
        "name": _clean(ingredient.get("IngredientName")),
        "standardName": _clean(ingredient.get("standardIngredientName")),
        "productName": _clean(ingredient.get("ProductName")),
        "manufacturer": _clean(ingredient.get("Manufacturer")),
        "origin": _clean(ingredient.get("IngredientSourceNameList")),
        "supplierName": _clean(ingredient.get("SupplierName")),
        "stockDate": _clean(ingredient.get("StockDate")),
        "certifications": [
            {
                "name": _clean(item.get("SourceCertification")),
                "id": _clean(item.get("CertificationId")),
            }
            for item in certifications
            if isinstance(item, dict)
            and (item.get("SourceCertification") or item.get("CertificationId"))
        ],
    }


def _normalize_no_meal(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "startDate": _clean(item.get("startdate")),
        "endDate": _clean(item.get("enddate")),
        "mealType": _clean(item.get("menutypeName")),
        "reason": _clean(item.get("nomenutypeName")),
        "note": _clean(item.get("note")),
        "updatedAt": _clean(item.get("updateDateTime")),
    }


def _covers_date(item: dict[str, Any], meal_date: date) -> bool:
    start_text = str(item.get("startdate") or "").strip()
    end_text = str(item.get("enddate") or "").strip()
    try:
        start = date.fromisoformat(start_text)
        end = date.fromisoformat(end_text)
    except ValueError:
        return False
    return start <= meal_date <= end
