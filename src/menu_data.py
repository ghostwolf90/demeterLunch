from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from datetime import date
from pathlib import Path
from typing import Any


class DataValidationError(ValueError):
    """Raised when a reviewed menu file does not match the expected schema."""


PROTEIN_KEYWORDS = {
    "chicken": ("雞",),
    "pork": ("豬", "排骨", "肉燥", "肉骨", "白肉", "豬腳"),
    "fish": ("魚",),
    "seafood": ("蝦", "蚵", "魷", "海鮮"),
    "egg": ("蛋",),
    "tofu": ("豆腐", "豆干", "豆皮", "豆包", "豆輪", "百頁"),
}

METHOD_KEYWORDS = {
    "fried": ("炸", "香酥", "可樂餅"),
    "braised": ("滷", "紅燒", "燒"),
    "grilled": ("烤",),
}

MEAL_TYPES = ("meat", "vegetarian")


def load_reviewed_weeks(parsed_root: Path) -> list[dict[str, Any]]:
    weeks: list[dict[str, Any]] = []
    seen_dates: set[str] = set()
    for path in sorted(parsed_root.glob("**/menu.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise DataValidationError(f"無法讀取 {path}: {exc}") from exc
        _merge_recipe_details(payload, path)
        _validate_week(payload, path, seen_dates)
        payload["_path"] = str(path)
        weeks.append(payload)
    if not weeks:
        raise DataValidationError(f"找不到結構化菜單：{parsed_root}")
    return weeks


def _merge_recipe_details(week: dict[str, Any], menu_path: Path) -> None:
    details_path = menu_path.with_name("recipe-details.json")
    if not details_path.is_file():
        return
    try:
        details = json.loads(details_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DataValidationError(f"無法讀取 {details_path}: {exc}") from exc
    if not isinstance(details, dict) or details.get("schemaVersion") != 1:
        raise DataValidationError(f"{details_path}: 不支援的食譜明細格式")
    review = details.get("review")
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        raise DataValidationError(f"{details_path}: 食譜明細必須先完成校讀")
    if details.get("week") != week.get("week"):
        raise DataValidationError(f"{details_path}: 週次與 menu.json 不一致")

    details_by_date: dict[str, dict[str, Any]] = {}
    for day in details.get("days", []):
        if not isinstance(day, dict) or not day.get("date"):
            raise DataValidationError(f"{details_path}: 明細日期不完整")
        if day["date"] in details_by_date:
            raise DataValidationError(f"{details_path}: 明細日期重複 {day['date']}")
        details_by_date[day["date"]] = day

    for day in week.get("days", []):
        detail_day = details_by_date.get(day.get("date"))
        if detail_day is None:
            raise DataValidationError(f"{details_path}: 缺少 {day.get('date')} 明細")
        variants = detail_day.get("variants")
        if not isinstance(variants, dict):
            raise DataValidationError(f"{details_path}: {day['date']} variants 不完整")
        for meal_type in MEAL_TYPES:
            dishes = variants.get(meal_type)
            if not isinstance(dishes, list) or not dishes:
                raise DataValidationError(
                    f"{details_path}: {day['date']} 缺少 {meal_type} 菜色明細"
                )
            day["variants"][meal_type]["dishes"] = dishes

    extra_dates = set(details_by_date) - {day["date"] for day in week.get("days", [])}
    if extra_dates:
        raise DataValidationError(
            f"{details_path}: 出現 menu.json 未收錄日期 {', '.join(sorted(extra_dates))}"
        )


def load_reviewed_traceability(
    parsed_root: Path, available_dates: set[str]
) -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = []
    seen_source_ids: set[str] = set()
    seen_dates: set[str] = set()
    for path in traceability_paths(parsed_root):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise DataValidationError(f"無法讀取 {path}: {exc}") from exc
        _validate_traceability(
            payload, path, available_dates, seen_source_ids, seen_dates
        )
        payload["_path"] = str(path)
        packages.append(payload)
    return packages


def traceability_paths(parsed_root: Path) -> list[Path]:
    return sorted(parsed_root.glob("**/traceability*.json"))


def validate_traceability_package(
    payload: object,
    path: Path,
    available_dates: set[str],
    *,
    seen_source_ids: set[str] | None = None,
    seen_dates: set[str] | None = None,
) -> None:
    _validate_traceability(
        payload,
        path,
        available_dates,
        seen_source_ids if seen_source_ids is not None else set(),
        seen_dates if seen_dates is not None else set(),
    )


def _validate_week(
    week: object, path: Path, seen_dates: set[str]
) -> None:
    if not isinstance(week, dict):
        raise DataValidationError(f"{path}: 根節點必須是物件")
    required = (
        "schemaVersion",
        "articleId",
        "sourceUrl",
        "sourceImage",
        "schoolYear",
        "semester",
        "week",
        "startDate",
        "endDate",
        "extraction",
        "days",
    )
    missing = [key for key in required if key not in week]
    if missing:
        raise DataValidationError(f"{path}: 缺少欄位 {', '.join(missing)}")
    if week["schemaVersion"] != 2:
        raise DataValidationError(f"{path}: 不支援 schemaVersion")
    source_images = week.get("sourceImages")
    if not isinstance(source_images, dict):
        raise DataValidationError(f"{path}: sourceImages 必須是物件")
    for key in ("summary", "meatDetail", "vegetarianDetail"):
        if not source_images.get(key):
            raise DataValidationError(f"{path}: sourceImages 缺少 {key}")
    if not isinstance(week["days"], list) or not week["days"]:
        raise DataValidationError(f"{path}: days 必須是非空陣列")

    start = _iso_date(week["startDate"], path)
    end = _iso_date(week["endDate"], path)
    if start > end:
        raise DataValidationError(f"{path}: startDate 晚於 endDate")

    for day in week["days"]:
        if not isinstance(day, dict):
            raise DataValidationError(f"{path}: day 必須是物件")
        for key in ("date", "weekday", "variants"):
            if key not in day:
                raise DataValidationError(f"{path}: day 缺少 {key}")
        day_date = _iso_date(day["date"], path)
        if not start <= day_date <= end:
            raise DataValidationError(f"{path}: {day_date} 不在週日期範圍")
        if day["date"] in seen_dates:
            raise DataValidationError(f"{path}: 日期重複 {day['date']}")
        seen_dates.add(day["date"])
        variants = day["variants"]
        if not isinstance(variants, dict):
            raise DataValidationError(f"{path}: {day_date} variants 必須是物件")
        missing_variants = [key for key in MEAL_TYPES if key not in variants]
        if missing_variants:
            raise DataValidationError(
                f"{path}: {day_date} 缺少餐別 {', '.join(missing_variants)}"
            )
        for meal_type in MEAL_TYPES:
            _validate_variant(variants[meal_type], path, day_date, meal_type)


def _validate_variant(
    variant: object, path: Path, day_date: date, meal_type: str
) -> None:
    if not isinstance(variant, dict):
        raise DataValidationError(f"{path}: {day_date} {meal_type} 必須是物件")
    for key in ("meal", "nutrition", "confidence"):
        if key not in variant:
            raise DataValidationError(f"{path}: {day_date} {meal_type} 缺少 {key}")
    meal = variant["meal"]
    if not isinstance(meal, dict) or not meal.get("staple") or not meal.get("mainDish"):
        raise DataValidationError(f"{path}: {day_date} {meal_type} 缺少主食或主菜")
    if not isinstance(meal.get("sideDishes", []), list):
        raise DataValidationError(
            f"{path}: {day_date} {meal_type} sideDishes 必須是陣列"
        )
    nutrition = variant["nutrition"]
    required_nutrition = (
        "caloriesKcal",
        "wholeGrainsServings",
        "proteinServings",
        "vegetablesServings",
        "oilsNutsServings",
        "fruitServings",
    )
    if not isinstance(nutrition, dict) or any(
        key not in nutrition for key in required_nutrition
    ):
        raise DataValidationError(f"{path}: {day_date} {meal_type} 營養資料不完整")
    dishes = variant.get("dishes", [])
    if not isinstance(dishes, list):
        raise DataValidationError(f"{path}: {day_date} {meal_type} dishes 必須是陣列")
    for dish in dishes:
        if not isinstance(dish, dict) or not dish.get("name") or not dish.get("role"):
            raise DataValidationError(f"{path}: {day_date} {meal_type} 菜色明細不完整")
        ingredients = dish.get("ingredients", [])
        if not isinstance(ingredients, list) or not ingredients:
            raise DataValidationError(
                f"{path}: {day_date} {meal_type} 的 {dish['name']} 缺少食材明細"
            )
        for ingredient in ingredients:
            if not isinstance(ingredient, dict) or not ingredient.get("name"):
                raise DataValidationError(f"{path}: {dish['name']} 食材缺少名稱")
            if not ingredient.get("quantityText"):
                raise DataValidationError(
                    f"{path}: {dish['name']} 的 {ingredient['name']} 缺少份量文字"
                )
            quantity_value = ingredient.get("quantityValue")
            if quantity_value is not None and not isinstance(quantity_value, (int, float)):
                raise DataValidationError(
                    f"{path}: {dish['name']} 的 {ingredient['name']} 數量必須是數字"
                )
            claims = ingredient.get("claims", [])
            if not isinstance(claims, list) or not all(
                isinstance(claim, str) for claim in claims
            ):
                raise DataValidationError(
                    f"{path}: {dish['name']} 的 {ingredient['name']} claims 必須是字串陣列"
                )


def _iso_date(value: object, path: Path) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise DataValidationError(f"{path}: 日期格式錯誤 {value!r}") from exc


def _validate_traceability(
    payload: object,
    path: Path,
    available_dates: set[str],
    seen_source_ids: set[str],
    seen_dates: set[str],
) -> None:
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise DataValidationError(f"{path}: 不支援的溯源資料格式")
    for key in ("schoolName", "source", "review", "businesses", "certifications", "days"):
        if key not in payload:
            raise DataValidationError(f"{path}: 溯源資料缺少 {key}")

    source = payload["source"]
    review = payload["review"]
    if not isinstance(source, dict) or not source.get("id") or not source.get("sourceMonth"):
        raise DataValidationError(f"{path}: 溯源來源資料不完整")
    if source["id"] in seen_source_ids:
        raise DataValidationError(f"{path}: 溯源來源重複 {source['id']}")
    seen_source_ids.add(source["id"])
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        raise DataValidationError(f"{path}: 溯源資料必須先完成校讀")

    businesses = payload["businesses"]
    certifications = payload["certifications"]
    days = payload["days"]
    if not isinstance(businesses, list) or not isinstance(certifications, list):
        raise DataValidationError(f"{path}: 廠商與認證資料必須是陣列")
    if not isinstance(days, list) or not days:
        raise DataValidationError(f"{path}: 溯源資料必須包含供餐日")

    business_ids: set[str] = set()
    for business in businesses:
        if not isinstance(business, dict) or not business.get("id") or not business.get("name"):
            raise DataValidationError(f"{path}: 廠商資料缺少 id 或 name")
        if business["id"] in business_ids:
            raise DataValidationError(f"{path}: 廠商 id 重複 {business['id']}")
        business_ids.add(business["id"])

    certification_ids: set[str] = set()
    for certification in certifications:
        if not isinstance(certification, dict) or not certification.get("id"):
            raise DataValidationError(f"{path}: 認證資料缺少 id")
        if not certification.get("label") or not certification.get("number"):
            raise DataValidationError(f"{path}: 認證資料缺少標章或編號")
        if certification["id"] in certification_ids:
            raise DataValidationError(f"{path}: 認證 id 重複 {certification['id']}")
        operator_id = certification.get("operatorBusinessId")
        if operator_id and operator_id not in business_ids:
            raise DataValidationError(f"{path}: 找不到認證經營者 {operator_id}")
        certification_ids.add(certification["id"])

    for day in days:
        if not isinstance(day, dict) or not day.get("date") or not isinstance(day.get("dishes"), list):
            raise DataValidationError(f"{path}: 每日溯源資料格式錯誤")
        _iso_date(day["date"], path)
        if day["date"] not in available_dates:
            raise DataValidationError(f"{path}: 溯源日期沒有校讀菜單 {day['date']}")
        if day["date"] in seen_dates:
            raise DataValidationError(f"{path}: 溯源日期重複 {day['date']}")
        seen_dates.add(day["date"])
        for dish in day["dishes"]:
            if not isinstance(dish, dict) or not dish.get("name"):
                raise DataValidationError(f"{path}: 菜色資料缺少名稱")
            ingredients = dish.get("ingredients")
            if not isinstance(ingredients, list) or not ingredients:
                raise DataValidationError(f"{path}: {dish['name']} 沒有食材")
            for ingredient in ingredients:
                if not isinstance(ingredient, dict) or not ingredient.get("name"):
                    raise DataValidationError(f"{path}: 食材資料缺少名稱")
                if ingredient.get("supplierBusinessId") not in business_ids:
                    raise DataValidationError(
                        f"{path}: 找不到食材供應商 {ingredient.get('supplierBusinessId')}"
                    )
                producer_id = ingredient.get("producerBusinessId")
                if producer_id and producer_id not in business_ids:
                    raise DataValidationError(f"{path}: 找不到食材製造／生產者 {producer_id}")
                certification_id = ingredient.get("certificationId")
                if certification_id and certification_id not in certification_ids:
                    raise DataValidationError(f"{path}: 找不到認證 {certification_id}")


def classify_items(items: list[str]) -> list[str]:
    text = " ".join(items)
    tags = [
        tag
        for tag, keywords in {**PROTEIN_KEYWORDS, **METHOD_KEYWORDS}.items()
        if any(keyword in text for keyword in keywords)
    ]
    return sorted(tags)


def build_database(parsed_root: Path, database_path: Path) -> dict[str, int]:
    weeks = load_reviewed_weeks(parsed_root)
    available_dates = {
        day["date"] for week in weeks for day in week["days"]
    }
    traceability_packages = load_reviewed_traceability(parsed_root, available_dates)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        prefix=f".{database_path.name}.", suffix=".tmp", dir=database_path.parent
    )
    os.close(handle)
    temporary_path = Path(temporary_name)
    try:
        with sqlite3.connect(temporary_path) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            _create_schema(connection)
            day_count = 0
            variant_count = 0
            item_count = 0
            recipe_ingredient_count = 0
            for week in weeks:
                week_id = f"{week['schoolYear']}-{week['semester']}-{week['week']:02d}"
                extraction = week["extraction"]
                connection.execute(
                    """
                    INSERT INTO weeks (
                        id, article_id, source_url, source_image, school_year,
                        semester, week_number, start_date, end_date,
                        meat_detail_image, vegetarian_detail_image,
                        review_status, reviewed_at, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        week_id,
                        week["articleId"],
                        week["sourceUrl"],
                        week["sourceImage"],
                        week["schoolYear"],
                        week["semester"],
                        week["week"],
                        week["startDate"],
                        week["endDate"],
                        week["sourceImages"]["meatDetail"],
                        week["sourceImages"]["vegetarianDetail"],
                        extraction["reviewStatus"],
                        extraction["reviewedAt"],
                        extraction.get("notes"),
                    ),
                )
                for day in week["days"]:
                    for meal_type in MEAL_TYPES:
                        variant = day["variants"][meal_type]
                        meal = variant["meal"]
                        nutrition = variant["nutrition"]
                        menu_id = f"{day['date']}:{meal_type}"
                        ordered_items = [
                            meal["staple"],
                            meal["mainDish"],
                            *meal.get("sideDishes", []),
                            meal.get("soup"),
                            meal.get("fruit"),
                            meal.get("drink"),
                        ]
                        ordered_items = [item for item in ordered_items if item]
                        tags = classify_items(ordered_items)
                        if meal_type == "vegetarian":
                            tags = [
                                tag
                                for tag in tags
                                if tag not in {"chicken", "pork", "fish", "seafood"}
                            ]
                        connection.execute(
                            """
                            INSERT INTO daily_menus (
                                id, date, meal_type, week_id, weekday, staple,
                                main_dish, side_dishes_json, soup, fruit, drink,
                                calories_kcal, whole_grains_servings,
                                protein_servings, vegetables_servings,
                                oils_nuts_servings, fruit_servings, tags_json,
                                allergens_json, confidence, review_status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                menu_id,
                                day["date"],
                                meal_type,
                                week_id,
                                day["weekday"],
                                meal["staple"],
                                meal["mainDish"],
                                json.dumps(meal.get("sideDishes", []), ensure_ascii=False),
                                meal.get("soup"),
                                meal.get("fruit"),
                                meal.get("drink"),
                                nutrition["caloriesKcal"],
                                nutrition["wholeGrainsServings"],
                                nutrition["proteinServings"],
                                nutrition["vegetablesServings"],
                                nutrition["oilsNutsServings"],
                                nutrition["fruitServings"],
                                json.dumps(tags, ensure_ascii=False),
                                json.dumps(variant.get("allergens", []), ensure_ascii=False),
                                variant["confidence"],
                                extraction["reviewStatus"],
                            ),
                        )
                        for position, item in enumerate(ordered_items):
                            role = _item_role(item, meal)
                            connection.execute(
                                "INSERT INTO menu_items (menu_id, position, role, name) VALUES (?, ?, ?, ?)",
                                (menu_id, position, role, item),
                            )
                            item_count += 1
                        recipe_ingredient_count += _insert_recipe_details(
                            connection, menu_id, variant.get("dishes", [])
                        )
                        variant_count += 1
                    day_count += 1
            traceability_count = _insert_traceability(
                connection, traceability_packages
            )
            connection.execute(
                "INSERT INTO metadata (key, value) VALUES ('schema_version', '4')"
            )
            connection.execute(
                "INSERT INTO metadata (key, value) VALUES ('generated_at', datetime('now'))"
            )
            connection.commit()
        os.replace(temporary_path, database_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return {
        "weeks": len(weeks),
        "days": day_count,
        "variants": variant_count,
        "items": item_count,
        "recipeIngredients": recipe_ingredient_count,
        "traceableIngredients": traceability_count,
    }


def _insert_recipe_details(
    connection: sqlite3.Connection,
    menu_id: str,
    dishes: list[dict[str, Any]],
) -> int:
    ingredient_count = 0
    for dish_position, dish in enumerate(dishes):
        cursor = connection.execute(
            """
            INSERT INTO recipe_dishes (menu_id, position, role, name)
            VALUES (?, ?, ?, ?)
            """,
            (menu_id, dish_position, dish["role"], dish["name"]),
        )
        dish_id = cursor.lastrowid
        for ingredient_position, ingredient in enumerate(dish.get("ingredients", [])):
            connection.execute(
                """
                INSERT INTO recipe_ingredients (
                    dish_id, position, name, quantity_value,
                    quantity_unit, quantity_text, claims_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dish_id,
                    ingredient_position,
                    ingredient["name"],
                    ingredient.get("quantityValue"),
                    ingredient.get("quantityUnit"),
                    ingredient.get("quantityText"),
                    json.dumps(ingredient.get("claims", []), ensure_ascii=False),
                ),
            )
            ingredient_count += 1
    return ingredient_count


def _insert_traceability(
    connection: sqlite3.Connection, packages: list[dict[str, Any]]
) -> int:
    ingredient_count = 0
    for package in packages:
        source = package["source"]
        review = package["review"]
        connection.execute(
            """
            INSERT INTO traceability_sources (
                id, name, school_name, source_month, exported_at,
                source_file, review_status, reviewed_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source["id"],
                source.get("name") or "校園食材登錄平臺",
                package["schoolName"],
                source["sourceMonth"],
                source.get("exportedAt"),
                source.get("sourceFile"),
                review["status"],
                review.get("reviewedAt"),
                review.get("notes"),
            ),
        )
        for business in package["businesses"]:
            connection.execute(
                """
                INSERT INTO businesses (
                    id, name, kind, tax_id, address, phone, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    kind = excluded.kind,
                    tax_id = COALESCE(excluded.tax_id, businesses.tax_id),
                    address = COALESCE(excluded.address, businesses.address),
                    phone = COALESCE(excluded.phone, businesses.phone),
                    source_url = COALESCE(excluded.source_url, businesses.source_url)
                """,
                (
                    business["id"],
                    business["name"],
                    business.get("kind") or "unknown",
                    business.get("taxId"),
                    business.get("address"),
                    business.get("phone"),
                    business.get("sourceUrl"),
                ),
            )
        for certification in package["certifications"]:
            connection.execute(
                """
                INSERT INTO certifications (
                    id, label, number, operator_business_id,
                    verification_body, status, valid_until, official_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    label = excluded.label,
                    number = excluded.number,
                    operator_business_id = COALESCE(
                        excluded.operator_business_id,
                        certifications.operator_business_id
                    ),
                    verification_body = COALESCE(
                        excluded.verification_body,
                        certifications.verification_body
                    ),
                    status = COALESCE(excluded.status, certifications.status),
                    valid_until = COALESCE(
                        excluded.valid_until,
                        certifications.valid_until
                    ),
                    official_url = COALESCE(
                        excluded.official_url,
                        certifications.official_url
                    )
                """,
                (
                    certification["id"],
                    certification["label"],
                    certification["number"],
                    certification.get("operatorBusinessId"),
                    certification.get("verificationBody"),
                    certification.get("status"),
                    certification.get("validUntil"),
                    certification.get("officialUrl"),
                ),
            )
        for day in package["days"]:
            for dish_position, dish in enumerate(day["dishes"]):
                for ingredient_position, ingredient in enumerate(dish["ingredients"]):
                    connection.execute(
                        """
                        INSERT INTO dish_ingredients (
                            source_id, menu_date, dish_position,
                            ingredient_position, dish_name, official_dish_name,
                            dish_category, ingredient_name,
                            producer_business_id, platform_mark, origin_country,
                            supplier_business_id, certification_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            source["id"],
                            day["date"],
                            dish_position,
                            ingredient_position,
                            dish["name"],
                            dish.get("officialName") or dish["name"],
                            dish.get("category"),
                            ingredient["name"],
                            ingredient.get("producerBusinessId"),
                            ingredient.get("platformMark"),
                            ingredient.get("originCountry"),
                            ingredient["supplierBusinessId"],
                            ingredient.get("certificationId"),
                        ),
                    )
                    ingredient_count += 1
    return ingredient_count


def _item_role(item: str, meal: dict[str, Any]) -> str:
    if item == meal.get("staple"):
        return "staple"
    if item == meal.get("mainDish"):
        return "main"
    if item == meal.get("soup"):
        return "soup"
    if item == meal.get("fruit"):
        return "fruit"
    if item == meal.get("drink"):
        return "drink"
    return "side"


def _create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE weeks (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL UNIQUE,
            source_url TEXT,
            source_image TEXT NOT NULL,
            school_year INTEGER NOT NULL,
            semester INTEGER NOT NULL,
            week_number INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            meat_detail_image TEXT NOT NULL,
            vegetarian_detail_image TEXT NOT NULL,
            review_status TEXT NOT NULL,
            reviewed_at TEXT NOT NULL,
            notes TEXT
        );
        CREATE TABLE daily_menus (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            meal_type TEXT NOT NULL CHECK (meal_type IN ('meat', 'vegetarian')),
            week_id TEXT NOT NULL REFERENCES weeks(id),
            weekday TEXT NOT NULL,
            staple TEXT NOT NULL,
            main_dish TEXT NOT NULL,
            side_dishes_json TEXT NOT NULL,
            soup TEXT,
            fruit TEXT,
            drink TEXT,
            calories_kcal REAL NOT NULL,
            whole_grains_servings REAL NOT NULL,
            protein_servings REAL NOT NULL,
            vegetables_servings REAL NOT NULL,
            oils_nuts_servings REAL NOT NULL,
            fruit_servings REAL NOT NULL,
            tags_json TEXT NOT NULL,
            allergens_json TEXT NOT NULL,
            confidence REAL NOT NULL,
            review_status TEXT NOT NULL,
            UNIQUE(date, meal_type)
        );
        CREATE TABLE menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_id TEXT NOT NULL REFERENCES daily_menus(id),
            position INTEGER NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE recipe_dishes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_id TEXT NOT NULL REFERENCES daily_menus(id),
            position INTEGER NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            UNIQUE(menu_id, position)
        );
        CREATE TABLE recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dish_id INTEGER NOT NULL REFERENCES recipe_dishes(id),
            position INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity_value REAL,
            quantity_unit TEXT,
            quantity_text TEXT,
            claims_json TEXT NOT NULL,
            UNIQUE(dish_id, position)
        );
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE traceability_sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            school_name TEXT NOT NULL,
            source_month TEXT NOT NULL,
            exported_at TEXT,
            source_file TEXT,
            review_status TEXT NOT NULL,
            reviewed_at TEXT,
            notes TEXT
        );
        CREATE TABLE businesses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            tax_id TEXT,
            address TEXT,
            phone TEXT,
            source_url TEXT
        );
        CREATE TABLE certifications (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            number TEXT NOT NULL,
            operator_business_id TEXT REFERENCES businesses(id),
            verification_body TEXT,
            status TEXT,
            valid_until TEXT,
            official_url TEXT
        );
        CREATE TABLE dish_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL REFERENCES traceability_sources(id),
            menu_date TEXT NOT NULL,
            dish_position INTEGER NOT NULL,
            ingredient_position INTEGER NOT NULL,
            dish_name TEXT NOT NULL,
            official_dish_name TEXT NOT NULL,
            dish_category TEXT,
            ingredient_name TEXT NOT NULL,
            producer_business_id TEXT REFERENCES businesses(id),
            platform_mark TEXT,
            origin_country TEXT,
            supplier_business_id TEXT NOT NULL REFERENCES businesses(id),
            certification_id TEXT REFERENCES certifications(id),
            UNIQUE(menu_date, dish_position, ingredient_position)
        );
        CREATE INDEX menu_items_menu_idx ON menu_items(menu_id, position);
        CREATE INDEX daily_menus_week_idx ON daily_menus(week_id, meal_type, date);
        CREATE INDEX daily_menus_date_idx ON daily_menus(date, meal_type);
        CREATE INDEX recipe_dishes_menu_idx ON recipe_dishes(menu_id, position);
        CREATE INDEX dish_ingredients_date_idx
            ON dish_ingredients(menu_date, dish_position, ingredient_position);
        CREATE INDEX dish_ingredients_supplier_idx
            ON dish_ingredients(supplier_business_id, menu_date);
        """
    )
