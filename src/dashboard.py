from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

from .family_content import make_food_education, make_home_recipe


PROTEIN_LABELS = {
    "chicken": "雞肉",
    "pork": "豬肉",
    "fish": "魚類",
    "seafood": "海鮮",
    "egg": "蛋",
    "tofu": "豆製品",
}

TRACEABILITY_INGREDIENT_ALIASES = {
    "白蘿蔔": ("蘿蔔",),
    "甘藍": ("高麗菜",),
    "金針菇": ("金菇",),
}

DINNER_POOLS = {
    "chicken": (
        ("番茄豆腐煲", "蒜炒地瓜葉"),
        ("味噌烤鯖魚", "涼拌秋葵"),
        ("毛豆炒蛋", "香菇炊飯"),
        ("豆豉蒸鱈魚", "清炒高麗菜"),
        ("香煎板豆腐", "玉米筍炒菇"),
        ("鮭魚蔬菜炊飯", "海帶芽湯"),
        ("海鮮豆腐煲", "蒜炒菠菜"),
        ("香菇豆干煲", "烤南瓜"),
    ),
    "pork": (
        ("檸檬烤鯖魚", "蒜香花椰菜"),
        ("番茄炒蛋", "毛豆炒菇"),
        ("香煎百頁豆腐", "涼拌小黃瓜"),
        ("蛤蜊絲瓜", "烤地瓜"),
        ("豆腐蔬菜煲", "蒜炒菠菜"),
        ("香草烤鱸魚", "彩椒菇菇"),
        ("蒜香蛤蜊", "炒小白菜"),
        ("南瓜蒸蛋", "涼拌豆芽"),
    ),
    "fish": (
        ("香菇蒸雞", "清炒菠菜"),
        ("番茄炒蛋", "滷豆干"),
        ("三杯杏鮑菇", "毛豆玉米"),
        ("蔥燒雞腿", "涼拌小黃瓜"),
        ("豆腐蔬菜煲", "蒜炒青江菜"),
        ("雞肉蔬菜捲", "南瓜濃湯"),
        ("香草豬里肌", "燙青花菜"),
        ("毛豆豆干丁", "玉米濃湯"),
    ),
    "egg": (
        ("味噌烤鯖魚", "燙青花菜"),
        ("香菇雞肉煲", "涼拌木耳"),
        ("麻婆豆腐", "清炒高麗菜"),
        ("蒜香蝦仁", "清炒絲瓜"),
        ("毛豆豆干丁", "紫菜湯"),
        ("番茄燉魚", "烤南瓜"),
    ),
    "tofu": (
        ("蔥燒雞腿", "清炒小松菜"),
        ("鮭魚炊飯", "涼拌秋葵"),
        ("番茄炒蛋", "蒜香花椰菜"),
        ("蛤蜊冬瓜湯", "炒地瓜葉"),
        ("香草豬里肌", "烤時蔬"),
        ("蒸蛋", "毛豆玉米"),
    ),
    "balanced": (
        ("南瓜雞肉燉飯", "燙青花菜"),
        ("味噌烤鯖魚", "涼拌豆芽"),
        ("番茄豆腐煲", "蒜炒菠菜"),
        ("香菇蒸蛋", "烤地瓜"),
        ("蔥燒豬里肌", "炒高麗菜"),
        ("蛤蜊絲瓜", "玉米筍炒菇"),
    ),
}

DINNER_REASONS = {
    "chicken": "午餐已有雞肉，晚餐改用魚、蛋或豆製品，整天更有變化。",
    "pork": "午餐已有豬肉，晚餐換成魚、蛋、海鮮或豆製品。",
    "fish": "午餐已有魚或海鮮，晚餐改搭雞肉、蛋或豆製品。",
    "egg": "午餐已有蛋料理，晚餐換一種主要蛋白質。",
    "tofu": "午餐已有豆製品，晚餐可搭配魚、蛋或肉類。",
    "balanced": "從不同料理輪替選一組，讓一天的餐桌更多元。",
}


def load_dashboard(database_path: Path, selected_date: str | None = None) -> dict[str, Any]:
    if not database_path.is_file():
        raise FileNotFoundError(f"結構化資料庫不存在：{database_path}")
    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT d.*, w.week_number, w.school_year, w.semester,
                   w.start_date, w.end_date, w.source_url, w.source_image
            FROM daily_menus d JOIN weeks w ON w.id = d.week_id
            ORDER BY d.date
            """
        ).fetchall()
        weeks = connection.execute(
            """
            SELECT w.*, COUNT(d.date) AS day_count
            FROM weeks w LEFT JOIN daily_menus d ON d.week_id = w.id
            GROUP BY w.id ORDER BY w.start_date DESC
            """
        ).fetchall()
        top_dishes = connection.execute(
            """
            SELECT name, COUNT(*) AS appearances
            FROM menu_items WHERE role IN ('main', 'side')
            GROUP BY name ORDER BY appearances DESC, name LIMIT 6
            """
        ).fetchall()
        traceability_rows = connection.execute(
            """
            SELECT di.source_id, di.menu_date, di.dish_position,
                   di.ingredient_position, di.dish_name,
                   di.official_dish_name, di.dish_category,
                   di.ingredient_name,
                   supplier.id AS supplier_id,
                   supplier.name AS supplier_name,
                   supplier.tax_id AS supplier_tax_id,
                   supplier.address AS supplier_address,
                   supplier.phone AS supplier_phone,
                   supplier.source_url AS supplier_source_url,
                   certification.id AS certification_id,
                   certification.label AS certification_label,
                   certification.number AS certification_number,
                   certification.verification_body,
                   certification.status AS certification_status,
                   certification.valid_until,
                   certification.official_url,
                   operator.id AS operator_id,
                   operator.name AS operator_name,
                   operator.address AS operator_address,
                   operator.phone AS operator_phone,
                   operator.source_url AS operator_source_url
            FROM dish_ingredients di
            JOIN businesses supplier ON supplier.id = di.supplier_business_id
            LEFT JOIN certifications certification
                ON certification.id = di.certification_id
            LEFT JOIN businesses operator
                ON operator.id = certification.operator_business_id
            ORDER BY di.menu_date, di.dish_position, di.ingredient_position
            """
        ).fetchall()
        traceability_sources = connection.execute(
            """
            SELECT * FROM traceability_sources ORDER BY source_month, id
            """
        ).fetchall()

    days = [_row_to_day(row) for row in rows]
    if not days:
        raise ValueError("資料庫沒有每日菜單")
    exact = next((day for day in days if day["date"] == selected_date), None)
    active = exact or _nearest_day(days, selected_date)
    traceability_by_date = {
        day["date"]: _build_traceability(
            day, traceability_rows, traceability_sources
        )
        for day in days
    }
    for day in days:
        traceability = traceability_by_date[day["date"]]
        day["traceabilityStatus"] = traceability["status"]
        day["traceableIngredientCount"] = traceability["ingredientCount"]
    week_days = [day for day in days if day["weekId"] == active["weekId"]]
    return {
        "selected": active,
        "requestedDate": selected_date,
        "isFallback": exact is None and selected_date is not None,
        "week": week_days,
        "dinnerSuggestion": make_dinner_suggestion(active),
        "foodEducation": make_food_education(active),
        "homeRecipe": make_home_recipe(active),
        "traceability": traceability_by_date[active["date"]],
        "insights": _build_insights(days, top_dishes),
        "archive": [
            {
                "id": row["id"],
                "week": row["week_number"],
                "startDate": row["start_date"],
                "endDate": row["end_date"],
                "dayCount": row["day_count"],
                "sourceUrl": row["source_url"],
                "sourceImage": f"/data/{row['source_image']}",
                "reviewStatus": row["review_status"],
            }
            for row in weeks
        ],
        "dateRange": {"start": days[0]["date"], "end": days[-1]["date"]},
        "totalDays": len(days),
    }


def _build_traceability(
    selected_day: dict[str, Any],
    rows: list[sqlite3.Row],
    sources: list[sqlite3.Row],
) -> dict[str, Any]:
    selected_date = selected_day["date"]
    selected_rows = [row for row in rows if row["menu_date"] == selected_date]
    if selected_rows:
        return _traceability_payload(
            selected_date=selected_date,
            status="verified",
            dishes=_group_exact_traceability(selected_rows),
            matched_rows=selected_rows,
            sources=sources,
            notice="本日菜色已與校園食材平臺的同日官方明細完成比對。",
        )

    matched_dishes, matched_rows = _match_historical_traceability(
        selected_day, rows
    )
    if matched_rows:
        reference_dates = sorted({row["menu_date"] for row in matched_rows})
        date_text = "、".join(reference_dates)
        return _traceability_payload(
            selected_date=selected_date,
            status="matched_reference",
            dishes=matched_dishes,
            matched_rows=matched_rows,
            sources=sources,
            notice=(
                f"{selected_date} 尚無同日食材明細；以下只列出菜名中能與既有資料"
                f"明確匹配的食材。供應商與認證來自 {date_text}，僅供來源參考，"
                "不代表本日批次。"
            ),
        )

    return {
        "status": "unavailable",
        "selectedDate": selected_date,
        "dataDate": None,
        "notice": (
            f"{selected_date} 尚無同日食材明細，菜名中也沒有可與既有資料"
            "可靠匹配的食材。"
        ),
        "dishes": [],
        "ingredientCount": 0,
        "certifiedIngredientCount": 0,
        "referenceDates": [],
    }


def _menu_dishes(day: dict[str, Any]) -> list[tuple[str, str]]:
    meal = day["meal"]
    values: list[tuple[str, str | None]] = [
        ("主食", meal.get("staple")),
        ("主菜", meal.get("mainDish")),
        *[("配菜", item) for item in meal.get("sideDishes", [])],
        ("湯品", meal.get("soup")),
        ("水果", meal.get("fruit")),
        ("飲品", meal.get("drink")),
    ]
    return [(category, name) for category, name in values if name]


def _normalize_trace_text(value: str) -> str:
    return "".join(character for character in value if character.isalnum())


def _group_historical_dishes(
    rows: list[sqlite3.Row],
) -> list[list[sqlite3.Row]]:
    groups: dict[tuple[str, int], list[sqlite3.Row]] = {}
    for row in rows:
        groups.setdefault((row["menu_date"], row["dish_position"]), []).append(row)
    return list(groups.values())


def _match_historical_traceability(
    selected_day: dict[str, Any], rows: list[sqlite3.Row]
) -> tuple[list[dict[str, Any]], list[sqlite3.Row]]:
    historical_rows = [
        row for row in rows if row["menu_date"] < selected_day["date"]
    ]
    historical_groups = _group_historical_dishes(historical_rows)
    dishes: list[dict[str, Any]] = []
    matched_rows: list[sqlite3.Row] = []

    for category, dish_name in _menu_dishes(selected_day):
        normalized_dish = _normalize_trace_text(dish_name)
        exact_candidates = [
            group
            for group in historical_groups
            if normalized_dish
            in {
                _normalize_trace_text(group[0]["dish_name"]),
                _normalize_trace_text(group[0]["official_dish_name"]),
            }
        ]
        if exact_candidates:
            selected_group = max(
                exact_candidates, key=lambda group: group[0]["menu_date"]
            )
            ingredients = [
                _traceability_ingredient(
                    row,
                    match_type="dish",
                    match_reason=f"同名菜色「{dish_name}」",
                )
                for row in selected_group
            ]
            matched_rows.extend(selected_group)
        else:
            ingredient_matches: dict[str, tuple[sqlite3.Row, str]] = {}
            for row in sorted(
                historical_rows, key=lambda item: item["menu_date"], reverse=True
            ):
                ingredient_name = row["ingredient_name"]
                terms = (
                    ingredient_name,
                    *TRACEABILITY_INGREDIENT_ALIASES.get(ingredient_name, ()),
                )
                matched_term = next(
                    (
                        term
                        for term in terms
                        if _normalize_trace_text(term) in normalized_dish
                    ),
                    None,
                )
                if matched_term and ingredient_name not in ingredient_matches:
                    ingredient_matches[ingredient_name] = (row, matched_term)

            ingredients = []
            for row, matched_term in ingredient_matches.values():
                ingredients.append(
                    _traceability_ingredient(
                        row,
                        match_type="ingredient",
                        match_reason=(
                            f"菜名「{dish_name}」包含「{matched_term}」"
                            + (
                                f"，對應食材「{row['ingredient_name']}」"
                                if matched_term != row["ingredient_name"]
                                else ""
                            )
                        ),
                    )
                )
                matched_rows.append(row)

        if ingredients:
            dishes.append(
                {
                    "name": dish_name,
                    "officialName": dish_name,
                    "category": category,
                    "ingredients": ingredients,
                }
            )

    return dishes, matched_rows


def _group_exact_traceability(
    selected_rows: list[sqlite3.Row],
) -> list[dict[str, Any]]:
    dishes: list[dict[str, Any]] = []
    dish_by_position: dict[int, dict[str, Any]] = {}
    for row in selected_rows:
        dish_position = row["dish_position"]
        dish = dish_by_position.get(dish_position)
        if dish is None:
            dish = {
                "name": row["dish_name"],
                "officialName": row["official_dish_name"],
                "category": row["dish_category"],
                "ingredients": [],
            }
            dish_by_position[dish_position] = dish
            dishes.append(dish)
        dish["ingredients"].append(_traceability_ingredient(row))
    return dishes


def _traceability_ingredient(
    row: sqlite3.Row,
    *,
    match_type: str | None = None,
    match_reason: str | None = None,
) -> dict[str, Any]:
    certification = None
    if row["certification_id"]:
        operator = None
        if row["operator_id"]:
            operator = {
                "id": row["operator_id"],
                "name": row["operator_name"],
                "address": row["operator_address"],
                "phone": row["operator_phone"],
                "sourceUrl": row["operator_source_url"],
            }
        certification = {
            "id": row["certification_id"],
            "label": row["certification_label"],
            "number": row["certification_number"],
            "verificationBody": row["verification_body"],
            "status": row["certification_status"],
            "validUntil": row["valid_until"],
            "officialUrl": row["official_url"],
            "operator": operator,
        }
    ingredient = {
        "name": row["ingredient_name"],
        "supplier": {
            "id": row["supplier_id"],
            "name": row["supplier_name"],
            "taxId": row["supplier_tax_id"],
            "address": row["supplier_address"],
            "phone": row["supplier_phone"],
            "sourceUrl": row["supplier_source_url"],
        },
        "certification": certification,
    }
    if match_type:
        ingredient["matchType"] = match_type
        ingredient["matchReason"] = match_reason
        ingredient["referenceDate"] = row["menu_date"]
        ingredient["referenceDishName"] = row["dish_name"]
    return ingredient


def _traceability_payload(
    *,
    selected_date: str,
    status: str,
    dishes: list[dict[str, Any]],
    matched_rows: list[sqlite3.Row],
    sources: list[sqlite3.Row],
    notice: str,
) -> dict[str, Any]:
    source_by_id = {row["id"]: row for row in sources}
    used_sources = [
        source_by_id[source_id]
        for source_id in dict.fromkeys(row["source_id"] for row in matched_rows)
    ]
    source = used_sources[0]
    reference_dates = sorted({row["menu_date"] for row in matched_rows})
    ingredient_count = sum(len(dish["ingredients"]) for dish in dishes)
    certified_count = sum(
        ingredient["certification"] is not None
        for dish in dishes
        for ingredient in dish["ingredients"]
    )
    return {
        "status": status,
        "selectedDate": selected_date,
        "dataDate": selected_date if status == "verified" else None,
        "notice": notice,
        "schoolName": source["school_name"],
        "sourceName": source["name"],
        "sourceMonth": source["source_month"],
        "sourceMonths": sorted({item["source_month"] for item in used_sources}),
        "exportedAt": source["exported_at"],
        "reviewedAt": max(item["reviewed_at"] for item in used_sources),
        "referenceDates": reference_dates,
        "dishes": dishes,
        "ingredientCount": ingredient_count,
        "certifiedIngredientCount": certified_count,
    }


def _nearest_day(days: list[dict[str, Any]], selected_date: str | None) -> dict[str, Any]:
    if not selected_date:
        return days[-1]
    earlier = [day for day in days if day["date"] <= selected_date]
    return earlier[-1] if earlier else days[0]


def _row_to_day(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "date": row["date"],
        "weekday": row["weekday"],
        "weekId": row["week_id"],
        "week": row["week_number"],
        "schoolYear": row["school_year"],
        "semester": row["semester"],
        "weekStartDate": row["start_date"],
        "weekEndDate": row["end_date"],
        "meal": {
            "staple": row["staple"],
            "mainDish": row["main_dish"],
            "sideDishes": json.loads(row["side_dishes_json"]),
            "soup": row["soup"],
            "fruit": row["fruit"],
            "drink": row["drink"],
        },
        "nutrition": {
            "caloriesKcal": row["calories_kcal"],
            "wholeGrainsServings": row["whole_grains_servings"],
            "proteinServings": row["protein_servings"],
            "vegetablesServings": row["vegetables_servings"],
            "oilsNutsServings": row["oils_nuts_servings"],
            "fruitServings": row["fruit_servings"],
        },
        "tags": json.loads(row["tags_json"]),
        "allergens": json.loads(row["allergens_json"]),
        "confidence": row["confidence"],
        "reviewStatus": row["review_status"],
        "source": {
            "url": row["source_url"],
            "image": f"/data/{row['source_image']}",
        },
    }


def _build_insights(
    days: list[dict[str, Any]], top_rows: list[sqlite3.Row]
) -> dict[str, Any]:
    total = len(days)
    protein_counts = Counter()
    for day in days:
        protein_counts.update(tag for tag in day["tags"] if tag in PROTEIN_LABELS)
    calories = [day["nutrition"]["caloriesKcal"] for day in days]
    vegetables = [day["nutrition"]["vegetablesServings"] for day in days]
    return {
        "averageCaloriesKcal": round(sum(calories) / total),
        "averageVegetablesServings": round(sum(vegetables) / total, 1),
        "fruitDays": sum(day["nutrition"]["fruitServings"] > 0 for day in days),
        "friedDays": sum("fried" in day["tags"] for day in days),
        "proteinCounts": [
            {"key": key, "label": label, "count": protein_counts[key]}
            for key, label in PROTEIN_LABELS.items()
        ],
        "calorieTrend": [
            {"date": day["date"], "value": day["nutrition"]["caloriesKcal"]}
            for day in days
        ],
        "topDishes": [
            {"name": row["name"], "appearances": row["appearances"]}
            for row in top_rows
        ],
    }


def make_dinner_suggestion(day: dict[str, Any]) -> dict[str, Any]:
    tags = set(day["tags"])
    dinner_group = _primary_protein(day, tags)
    pool = DINNER_POOLS[dinner_group]
    main_dish = str(day.get("meal", {}).get("mainDish") or "")
    rotation_key = f"{day['date']}:{main_dish}".encode("utf-8")
    rotation_seed = int.from_bytes(hashlib.sha256(rotation_key).digest()[:4], "big")
    rotation = rotation_seed % len(pool)
    proteins = list(pool[rotation])
    reason = DINNER_REASONS[dinner_group]

    notes: list[str] = []
    nutrition = day["nutrition"]
    if nutrition["vegetablesServings"] < 1.5:
        notes.append("補一盤深綠色蔬菜")
    else:
        notes.append("蔬菜份量不錯，晚餐維持一盤蔬菜")
    if nutrition["fruitServings"] == 0:
        notes.append("餐後可加一份當季水果")
    if "fried" in tags:
        notes.append("午餐有酥炸料理，晚餐以蒸、煮或燉為主")
    if not notes:
        notes.append("以清淡烹調延續今天的均衡")

    return {
        "title": "今晚換個主角",
        "recommendations": proteins,
        "reason": reason,
        "notes": notes,
        "disclaimer": "這是依午餐內容產生的家庭搭配靈感，不是個人化醫療或營養建議。",
    }


def _primary_protein(day: dict[str, Any], tags: set[str]) -> str:
    main_dish = str(day.get("meal", {}).get("mainDish") or "")
    if "雞" in main_dish:
        return "chicken"
    if any(keyword in main_dish for keyword in ("豬", "排骨", "肉燥", "肉片", "豬腳")):
        return "pork"
    if any(keyword in main_dish for keyword in ("魚", "蝦", "蚵", "魷", "海鮮")):
        return "fish"
    if "蛋" in main_dish:
        return "egg"
    if any(keyword in main_dish for keyword in ("豆腐", "豆干", "豆皮", "百頁")):
        return "tofu"
    for tag in ("chicken", "pork", "fish", "seafood", "egg", "tofu"):
        if tag in tags:
            return "fish" if tag == "seafood" else tag
    return "balanced"
