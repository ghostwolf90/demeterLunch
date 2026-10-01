from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any


PROTEIN_LABELS = {
    "chicken": "雞肉",
    "pork": "豬肉",
    "fish": "魚類",
    "seafood": "海鮮",
    "egg": "蛋",
    "tofu": "豆製品",
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

    days = [_row_to_day(row) for row in rows]
    if not days:
        raise ValueError("資料庫沒有每日菜單")
    exact = next((day for day in days if day["date"] == selected_date), None)
    active = exact or _nearest_day(days, selected_date)
    week_days = [day for day in days if day["weekId"] == active["weekId"]]
    return {
        "selected": active,
        "requestedDate": selected_date,
        "isFallback": exact is None and selected_date is not None,
        "week": week_days,
        "dinnerSuggestion": make_dinner_suggestion(active),
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
    if "chicken" in tags:
        proteins = ["清蒸魚", "板豆腐料理"]
        reason = "午餐已有雞肉，晚餐換一種蛋白質，整天會更有變化。"
    elif "pork" in tags:
        proteins = ["烤鮭魚", "豆腐蔬菜煲"]
        reason = "午餐已有豬肉，晚餐可改選魚類或豆製品。"
    elif tags & {"fish", "seafood"}:
        proteins = ["香煎雞胸", "番茄炒蛋"]
        reason = "午餐已有魚或海鮮，晚餐可改搭雞蛋或雞肉。"
    elif "egg" in tags:
        proteins = ["清蒸魚", "滷豆干"]
        reason = "午餐已有蛋料理，晚餐可換成魚類或豆製品。"
    else:
        proteins = ["清蒸魚", "豆腐料理"]
        reason = "用不同的蛋白質與午餐錯開，讓一天的餐桌更多元。"

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
