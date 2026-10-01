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


def load_reviewed_weeks(parsed_root: Path) -> list[dict[str, Any]]:
    weeks: list[dict[str, Any]] = []
    seen_dates: set[str] = set()
    for path in sorted(parsed_root.glob("**/menu.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise DataValidationError(f"無法讀取 {path}: {exc}") from exc
        _validate_week(payload, path, seen_dates)
        payload["_path"] = str(path)
        weeks.append(payload)
    if not weeks:
        raise DataValidationError(f"找不到結構化菜單：{parsed_root}")
    return weeks


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
    if week["schemaVersion"] != 1:
        raise DataValidationError(f"{path}: 不支援 schemaVersion")
    if not isinstance(week["days"], list) or not week["days"]:
        raise DataValidationError(f"{path}: days 必須是非空陣列")

    start = _iso_date(week["startDate"], path)
    end = _iso_date(week["endDate"], path)
    if start > end:
        raise DataValidationError(f"{path}: startDate 晚於 endDate")

    for day in week["days"]:
        if not isinstance(day, dict):
            raise DataValidationError(f"{path}: day 必須是物件")
        for key in ("date", "weekday", "meal", "nutrition", "confidence"):
            if key not in day:
                raise DataValidationError(f"{path}: day 缺少 {key}")
        day_date = _iso_date(day["date"], path)
        if not start <= day_date <= end:
            raise DataValidationError(f"{path}: {day_date} 不在週日期範圍")
        if day["date"] in seen_dates:
            raise DataValidationError(f"{path}: 日期重複 {day['date']}")
        seen_dates.add(day["date"])
        meal = day["meal"]
        if not isinstance(meal, dict) or not meal.get("staple") or not meal.get("mainDish"):
            raise DataValidationError(f"{path}: {day_date} 缺少主食或主菜")
        if not isinstance(meal.get("sideDishes", []), list):
            raise DataValidationError(f"{path}: {day_date} sideDishes 必須是陣列")
        nutrition = day["nutrition"]
        if not isinstance(nutrition, dict) or "caloriesKcal" not in nutrition:
            raise DataValidationError(f"{path}: {day_date} 缺少營養資料")


def _iso_date(value: object, path: Path) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise DataValidationError(f"{path}: 日期格式錯誤 {value!r}") from exc


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
            item_count = 0
            for week in weeks:
                week_id = f"{week['schoolYear']}-{week['semester']}-{week['week']:02d}"
                extraction = week["extraction"]
                connection.execute(
                    """
                    INSERT INTO weeks (
                        id, article_id, source_url, source_image, school_year,
                        semester, week_number, start_date, end_date,
                        review_status, reviewed_at, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        extraction["reviewStatus"],
                        extraction["reviewedAt"],
                        extraction.get("notes"),
                    ),
                )
                for day in week["days"]:
                    meal = day["meal"]
                    nutrition = day["nutrition"]
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
                    connection.execute(
                        """
                        INSERT INTO daily_menus (
                            date, week_id, weekday, staple, main_dish,
                            side_dishes_json, soup, fruit, drink,
                            calories_kcal, whole_grains_servings,
                            protein_servings, vegetables_servings,
                            oils_nuts_servings, fruit_servings, tags_json,
                            allergens_json, confidence, review_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            day["date"],
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
                            json.dumps(day.get("allergens", []), ensure_ascii=False),
                            day["confidence"],
                            extraction["reviewStatus"],
                        ),
                    )
                    for position, item in enumerate(ordered_items):
                        role = _item_role(item, meal)
                        connection.execute(
                            "INSERT INTO menu_items (menu_date, position, role, name) VALUES (?, ?, ?, ?)",
                            (day["date"], position, role, item),
                        )
                        item_count += 1
                    day_count += 1
            connection.execute(
                "INSERT INTO metadata (key, value) VALUES ('schema_version', '1')"
            )
            connection.execute(
                "INSERT INTO metadata (key, value) VALUES ('generated_at', datetime('now'))"
            )
            connection.commit()
        os.replace(temporary_path, database_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return {"weeks": len(weeks), "days": day_count, "items": item_count}


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
            source_url TEXT NOT NULL,
            source_image TEXT NOT NULL,
            school_year INTEGER NOT NULL,
            semester INTEGER NOT NULL,
            week_number INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            review_status TEXT NOT NULL,
            reviewed_at TEXT NOT NULL,
            notes TEXT
        );
        CREATE TABLE daily_menus (
            date TEXT PRIMARY KEY,
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
            review_status TEXT NOT NULL
        );
        CREATE TABLE menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_date TEXT NOT NULL REFERENCES daily_menus(date),
            position INTEGER NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX menu_items_date_idx ON menu_items(menu_date, position);
        CREATE INDEX daily_menus_week_idx ON daily_menus(week_id, date);
        """
    )
