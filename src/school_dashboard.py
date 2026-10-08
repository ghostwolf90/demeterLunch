from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any
from urllib.parse import urlencode


DEFAULT_SCHOOL_ID = 193609
PUBLIC_SEARCH_URL = "https://fatraceschool.k12ea.gov.tw/frontend/search.html"


def load_school_meal_catalog(database_path: Path) -> dict[str, Any]:
    if not database_path.is_file():
        raise FileNotFoundError(f"結構化資料庫不存在：{database_path}")
    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        schools = connection.execute(
            """
            SELECT s.*,
                   MIN(d.meal_date) AS first_record_date,
                   MAX(d.meal_date) AS last_record_date,
                   COUNT(d.meal_date) AS record_count
            FROM schools s
            LEFT JOIN official_meal_days d ON d.school_id = s.id
            GROUP BY s.id
            ORDER BY s.city, s.district, s.display_order, s.id
            """
        ).fetchall()
        days = connection.execute(
            """
            SELECT * FROM official_meal_days
            ORDER BY school_id, meal_date
            """
        ).fetchall()
        meals = connection.execute(
            """
            SELECT * FROM official_meals
            ORDER BY school_id, meal_date, service_position, meal_position
            """
        ).fetchall()
        dishes = connection.execute(
            """
            SELECT d.*
            FROM official_dishes d
            ORDER BY d.official_meal_id, d.position
            """
        ).fetchall()
        ingredients = connection.execute(
            """
            SELECT i.*
            FROM official_ingredients i
            ORDER BY i.official_dish_id, i.position
            """
        ).fetchall()
        certifications = connection.execute(
            """
            SELECT c.*
            FROM official_ingredient_certifications c
            ORDER BY c.official_ingredient_id, c.position
            """
        ).fetchall()

    certifications_by_ingredient: dict[int, list[dict[str, Any]]] = {}
    for row in certifications:
        certifications_by_ingredient.setdefault(row["official_ingredient_id"], []).append(
            {
                "name": row["name"],
                "id": row["certification_id"],
            }
        )

    ingredients_by_dish: dict[int, list[dict[str, Any]]] = {}
    for row in ingredients:
        ingredients_by_dish.setdefault(row["official_dish_id"], []).append(
            {
                "name": row["name"],
                "standardName": row["standard_name"],
                "productName": row["product_name"],
                "manufacturer": row["manufacturer"],
                "origin": row["origin"],
                "supplierName": row["supplier_name"],
                "stockDate": row["stock_date"],
                "certifications": certifications_by_ingredient.get(row["id"], []),
            }
        )

    dishes_by_meal: dict[int, list[dict[str, Any]]] = {}
    for row in dishes:
        dishes_by_meal.setdefault(row["official_meal_id"], []).append(
            {
                "dishId": row["dish_id"],
                "dishBatchDataId": row["dish_batch_data_id"],
                "name": row["name"],
                "category": row["category"],
                "imageUrl": row["image_url"],
                "ingredients": ingredients_by_dish.get(row["id"], []),
            }
        )

    meals_by_day: dict[tuple[int, str], list[dict[str, Any]]] = {}
    for row in meals:
        meal_dishes = dishes_by_meal.get(row["id"], [])
        meals_by_day.setdefault((row["school_id"], row["meal_date"]), []).append(
            {
                "serviceId": row["service_id"],
                "serviceLabel": row["service_label"],
                "batchDataId": row["batch_data_id"],
                "menuType": row["menu_type"],
                "menuTypeName": row["menu_type_name"],
                "kitchenId": row["kitchen_id"],
                "kitchenName": row["kitchen_name"],
                "uploadedAt": row["uploaded_at"],
                "nutrition": json.loads(row["nutrition_json"]),
                "dishes": meal_dishes,
            }
        )

    records: dict[str, dict[str, dict[str, Any]]] = {}
    for row in days:
        key = (row["school_id"], row["meal_date"])
        day_meals = meals_by_day.get(key, [])
        dishes_flat = [dish for meal in day_meals for dish in meal["dishes"]]
        ingredients_flat = [
            ingredient for dish in dishes_flat for ingredient in dish["ingredients"]
        ]
        record = {
            "mealDate": row["meal_date"],
            "status": row["status"],
            "fetchedAt": row["fetched_at"],
            "source": {
                "name": row["source_name"],
                "url": row["source_url"],
                "scope": row["source_scope"],
            },
            "review": {
                "status": row["review_status"],
                "reviewedAt": row["reviewed_at"],
                "reviewedBy": row["reviewed_by"],
                "method": row["review_method"],
                "note": row["review_note"],
            },
            "noMealReasons": json.loads(row["no_meal_reasons_json"]),
            "meals": day_meals,
            "summary": {
                "mealCount": len(day_meals),
                "dishCount": len(dishes_flat),
                "ingredientCount": len(ingredients_flat),
                "certifiedIngredientCount": sum(
                    bool(item["certifications"]) for item in ingredients_flat
                ),
            },
        }
        records.setdefault(str(row["school_id"]), {})[row["meal_date"]] = record

    directory = [
        {
            "fatraceSchoolId": row["id"],
            "city": row["city"],
            "district": row["district"],
            "level": row["level"],
            "name": row["name"],
            "fullName": row["full_name"],
            "sourceUrl": row["source_url"],
            "recordCount": row["record_count"],
            "dateRange": {
                "start": row["first_record_date"],
                "end": row["last_record_date"],
            }
            if row["first_record_date"]
            else None,
            "recordDates": sorted(records.get(str(row["id"]), {})),
            "experience": "complete" if row["id"] == DEFAULT_SCHOOL_ID else "official_daily",
        }
        for row in schools
    ]
    all_dates = sorted({date for school_records in records.values() for date in school_records})
    return {
        "schemaVersion": 1,
        "defaultSchoolId": DEFAULT_SCHOOL_ID,
        "schools": directory,
        "records": records,
        "dateRange": {
            "start": all_dates[0] if all_dates else None,
            "end": all_dates[-1] if all_dates else None,
        },
    }


def load_school_meal_dashboard(
    database_path: Path,
    school_id: int,
    selected_date: str | None,
    *,
    catalog: dict[str, Any] | None = None,
    meal_type: str = "meat",
) -> dict[str, Any]:
    data = catalog or load_school_meal_catalog(database_path)
    school = next(
        (
            item
            for item in data["schools"]
            if int(item["fatraceSchoolId"]) == int(school_id)
        ),
        None,
    )
    if school is None:
        raise ValueError(f"找不到學校代碼：{school_id}")
    record_dates = school["recordDates"]
    requested_date = selected_date or (record_dates[-1] if record_dates else None)
    record = data["records"].get(str(school_id), {}).get(requested_date)
    source_url = None
    if requested_date:
        source_url = f"{PUBLIC_SEARCH_URL}?{urlencode({'school': school_id, 'period': requested_date})}"
    return {
        "viewMode": "officialDaily",
        "school": school,
        "schoolDirectory": data["schools"],
        "requestedDate": requested_date,
        "selectedDate": requested_date,
        "record": record,
        "records": data["records"].get(str(school_id), {}),
        "isMissing": record is None,
        "availableDates": record_dates,
        "dateRange": school["dateRange"],
        "totalDays": school["recordCount"],
        "sourceUrl": record["source"]["url"] if record else source_url,
        "mealType": meal_type,
        "mealTypeLabel": "素食" if meal_type == "vegetarian" else "葷食",
        "dataNotice": (
            "教育部校園食材登錄平臺的當日或歷史實際供餐公開紀錄；"
            "若同時出現葷、素主菜，本站依菜名的「素」字拆分主菜與副菜，"
            "其他分類列為共用。"
        ),
    }
