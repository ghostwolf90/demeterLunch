#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.prepare_release import load_release_metadata, public_release, render_release_html

from src.dashboard import load_dashboard  # noqa: E402
from src.menu_data import build_database  # noqa: E402
from src.school_dashboard import load_school_meal_catalog  # noqa: E402
from src.school_weekly_data import weekly_menu_image_paths  # noqa: E402


DEFAULT_SCHOOL_ID = 193609


def _sample_week_dates(days: list[dict], reference_date: str) -> list[str]:
    weeks: dict[str, list[dict]] = {}
    for day in days:
        week_id = day.get("weekId")
        meal_date = day.get("date")
        if not week_id or not meal_date or not day.get("meal"):
            continue
        weeks.setdefault(str(week_id), []).append(day)

    candidates = []
    for week_id, week_days in weeks.items():
        sorted_days = sorted(week_days, key=lambda item: item["date"])
        candidates.append(
            {
                "weekId": week_id,
                "days": sorted_days,
                "endDate": sorted_days[-1]["date"],
            }
        )
    candidates.sort(key=lambda item: item["endDate"], reverse=True)
    eligible = [item for item in candidates if item["endDate"] <= reference_date]
    pool = eligible or candidates
    selected = next((item for item in pool if len(item["days"]) >= 5), None)
    if selected is None and pool:
        selected = max(pool, key=lambda item: (len(item["days"]), item["endDate"]))
    return [day["date"] for day in selected["days"]] if selected else []


def _sample_variant(variant: dict, sample_dates: list[str]) -> dict:
    selected_dates = set(sample_dates)
    days = [day for day in variant["days"] if day["date"] in selected_dates]
    week_ids = {day["weekId"] for day in days}
    return {
        "days": days,
        **{
            key: {
                day: value
                for day, value in variant[key].items()
                if day in selected_dates
            }
            for key in (
                "nutritionAssessments",
                "dinnerSuggestions",
                "foodEducation",
                "homeRecipes",
                "traceability",
            )
        },
        "insights": variant["insights"],
        "archive": [
            week for week in variant["archive"] if week.get("id") in week_ids
        ],
        "dateRange": {
            "start": sample_dates[0],
            "end": sample_dates[-1],
        },
        "totalDays": len(sample_dates),
    }


def _seo_school_manifest(schools: list[dict], records: dict[str, dict]) -> dict:
    """Return only official school IDs that have reviewed public meal content."""
    school_ids = sorted(
        int(school["fatraceSchoolId"])
        for school in schools
        if records.get(str(school["fatraceSchoolId"]))
    )
    return {"schemaVersion": 1, "schoolIds": school_ids}


def build_static_site(
    *,
    web_root: Path,
    raw_root: Path,
    parsed_root: Path,
    database_path: Path,
    news_path: Path,
    output_root: Path,
) -> dict[str, int]:
    database_stats = build_database(parsed_root, database_path)
    if output_root.exists():
        shutil.rmtree(output_root)
    shutil.copytree(web_root, output_root)
    release = load_release_metadata()
    index_path = output_root / "index.html"
    if index_path.is_file():
        index_path.write_text(render_release_html(index_path.read_text(encoding="utf-8"), release), encoding="utf-8")
    (output_root / "version.json").write_text(json.dumps(public_release(release), ensure_ascii=False), encoding="utf-8")

    with sqlite3.connect(database_path) as connection:
        dates = [
            row[0]
            for row in connection.execute(
                "SELECT DISTINCT date FROM daily_menus ORDER BY date"
            ).fetchall()
        ]
    if not dates:
        raise ValueError("資料庫沒有可匯出的供餐日")

    dashboards = {
        meal_type: {
            day: load_dashboard(database_path, day, meal_type) for day in dates
        }
        for meal_type in ("meat", "vegetarian")
    }
    latest = {meal_type: values[dates[-1]] for meal_type, values in dashboards.items()}
    official_school_meals = load_school_meal_catalog(database_path, parsed_root)
    generated_at = datetime.now(timezone.utc).isoformat()
    public_official_school_meals = {
        **official_school_meals,
        "records": {
            str(DEFAULT_SCHOOL_ID): official_school_meals.get("records", {}).get(
                str(DEFAULT_SCHOOL_ID), {}
            )
        },
    }
    payload = {
        "schemaVersion": 5,
        "generatedAt": generated_at,
        "nutritionStandard": latest["meat"]["nutritionStandard"],
        "officialSchoolMeals": public_official_school_meals,
        "variants": {
            meal_type: {
                "days": [values[day]["selected"] for day in dates],
                "nutritionAssessments": {
                    day: values[day]["nutritionAssessments"] for day in dates
                },
                "dinnerSuggestions": {
                    day: values[day]["dinnerSuggestion"] for day in dates
                },
                "foodEducation": {
                    day: values[day]["foodEducation"] for day in dates
                },
                "homeRecipes": {
                    day: values[day]["homeRecipe"] for day in dates
                },
                "traceability": {
                    day: values[day]["traceability"] for day in dates
                },
                "insights": latest[meal_type]["insights"],
                "archive": latest[meal_type]["archive"],
                "dateRange": latest[meal_type]["dateRange"],
                "totalDays": latest[meal_type]["totalDays"],
            }
            for meal_type, values in dashboards.items()
        },
    }
    data_output = output_root / "data"
    data_output.mkdir(parents=True, exist_ok=True)
    (data_output / "site-data.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    sample_dates = _sample_week_dates(
        payload["variants"]["meat"]["days"],
        datetime.now(ZoneInfo("Asia/Taipei")).date().isoformat(),
    )
    if not sample_dates:
        raise ValueError("找不到可建立首頁功能範例的供餐週")
    default_school = next(
        (
            school
            for school in official_school_meals["schools"]
            if int(school["fatraceSchoolId"]) == DEFAULT_SCHOOL_ID
        ),
        None,
    )
    if default_school is None:
        raise ValueError("學校名冊缺少首頁功能範例學校")
    default_records = official_school_meals.get("records", {}).get(
        str(DEFAULT_SCHOOL_ID), {}
    )
    sample_payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "nutritionStandard": payload["nutritionStandard"],
        "officialSchoolMeals": {
            "schemaVersion": official_school_meals.get("schemaVersion", 1),
            "defaultSchoolId": DEFAULT_SCHOOL_ID,
            "schools": [default_school],
            "records": {
                str(DEFAULT_SCHOOL_ID): {
                    day: default_records[day]
                    for day in sample_dates
                    if day in default_records
                }
            },
            "dateRange": {
                "start": sample_dates[0],
                "end": sample_dates[-1],
            },
        },
        "variants": {
            meal_type: _sample_variant(variant, sample_dates)
            for meal_type, variant in payload["variants"].items()
        },
    }
    (data_output / "sample-data.json").write_text(
        json.dumps(sample_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (data_output / "schools.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "generatedAt": generated_at,
                "schools": official_school_meals["schools"],
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    school_meals_output = data_output / "school-meals"
    school_meals_output.mkdir(parents=True, exist_ok=True)
    school_directory_by_id = {
        str(school["fatraceSchoolId"]): school
        for school in official_school_meals["schools"]
    }
    for school_id, records in official_school_meals.get("records", {}).items():
        (school_meals_output / f"{school_id}.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "schoolId": int(school_id),
                    "experience": school_directory_by_id.get(school_id, {}).get(
                        "experience", "official_daily"
                    ),
                    "records": records,
                },
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
    (data_output / "seo-schools.json").write_text(
        json.dumps(
            _seo_school_manifest(
                official_school_meals["schools"],
                official_school_meals.get("records", {}),
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    if not news_path.is_file():
        raise FileNotFoundError(f"找不到午餐新聞資料：{news_path}")
    news_payload = json.loads(news_path.read_text(encoding="utf-8"))
    if not isinstance(news_payload, dict) or not isinstance(
        news_payload.get("items"), list
    ):
        raise ValueError(f"午餐新聞資料格式不正確：{news_path}")
    (data_output / "news.json").write_text(
        json.dumps(news_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    copied_images = 0
    image_paths = {
        str(week[key]).removeprefix("/data/")
        for week in latest["meat"]["archive"]
        for key in ("sourceImage", "meatDetailImage", "vegetarianDetailImage")
    }
    for relative in sorted(image_paths):
        source = raw_root / relative
        if not source.is_file():
            raise FileNotFoundError(f"找不到原始菜單圖：{source}")
        destination = data_output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied_images += 1

    for relative in sorted(weekly_menu_image_paths(parsed_root)):
        source = raw_root / relative
        if not source.is_file():
            raise FileNotFoundError(f"找不到校方週菜單原圖：{source}")
        destination = data_output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied_images += 1

    return {
        **database_stats,
        "images": copied_images,
        "outputFiles": sum(path.is_file() for path in output_root.rglob("*")),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the static, deployable version of the lunch website."
    )
    parser.add_argument("--web-root", type=Path, default=PROJECT_ROOT / "web")
    parser.add_argument("--raw-root", type=Path, default=PROJECT_ROOT / "data" / "raw")
    parser.add_argument(
        "--parsed-root", type=Path, default=PROJECT_ROOT / "data" / "parsed"
    )
    parser.add_argument(
        "--database", type=Path, default=PROJECT_ROOT / "data" / "lunch.db"
    )
    parser.add_argument(
        "--news", type=Path, default=PROJECT_ROOT / "data" / "news" / "news.json"
    )
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "dist")
    args = parser.parse_args()
    stats = build_static_site(
        web_root=args.web_root,
        raw_root=args.raw_root,
        parsed_root=args.parsed_root,
        database_path=args.database,
        news_path=args.news,
        output_root=args.output,
    )
    print(
        f"Built {args.output} with {stats['days']} days, "
        f"{stats['images']} source images and {stats['outputFiles']} files."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
