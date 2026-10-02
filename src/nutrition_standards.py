from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RULES_PATH = (
    PROJECT_ROOT / "data" / "reference" / "school-lunch-nutrition-rules.json"
)

GRADE_GROUPS = ("elementary_lower", "elementary_upper")
STANDARD_MODES = ("target", "transitional")

STATUS_LABELS = {
    "within": "落在範圍",
    "below": "低於範圍",
    "above": "高於範圍",
    "unavailable": "資料不足",
}

DAILY_METRICS = (
    ("wholeGrains", "全穀雜糧", "wholeGrainsServings"),
    ("proteinFoods", "豆魚蛋肉", "proteinServings"),
    ("vegetables", "蔬菜", "vegetablesServings"),
    ("fruit", "水果", "fruitServings"),
    ("oilsNuts", "油脂與堅果", "oilsNutsServings"),
)


class NutritionRulesError(ValueError):
    """Raised when the reviewed nutrition standard data is incomplete."""


def load_nutrition_rules(path: Path = DEFAULT_RULES_PATH) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise NutritionRulesError(f"無法讀取營養基準 {path}: {exc}") from exc
    _validate_rules(payload, path)
    return payload


def public_rule_metadata(rules: dict[str, Any]) -> dict[str, Any]:
    source = rules["source"]
    return {
        "source": {
            "title": source["title"],
            "revisionDate": source["revisionDate"],
            "revisionLabel": source["revisionLabel"],
            "publisher": source["publisher"],
            "url": source["url"],
            "reviewedAt": source["review"]["reviewedAt"],
            "reviewedPages": source["review"]["pages"],
        },
        "weeklyAverageTolerancePercent": rules["weeklyAverageTolerancePercent"],
        "gradeGroups": [
            {
                "id": grade_group,
                "label": rules["profiles"][grade_group]["label"],
                "shortLabel": rules["profiles"][grade_group]["shortLabel"],
            }
            for grade_group in GRADE_GROUPS
        ],
        "modes": [
            {
                "id": mode,
                "label": rules["modes"][mode]["label"],
                "description": rules["modes"][mode]["description"],
            }
            for mode in STANDARD_MODES
        ],
    }


def build_all_week_assessments(
    days: list[dict[str, Any]],
    rules: dict[str, Any] | None = None,
) -> dict[str, dict[str, dict[str, Any]]]:
    active_rules = rules or load_nutrition_rules()
    return {
        grade_group: {
            mode: build_week_assessment(days, grade_group, mode, active_rules)
            for mode in STANDARD_MODES
        }
        for grade_group in GRADE_GROUPS
    }


def build_week_assessment(
    days: list[dict[str, Any]],
    grade_group: str,
    mode: str,
    rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    active_rules = rules or load_nutrition_rules()
    if grade_group not in GRADE_GROUPS:
        raise ValueError(f"不支援的年級群組：{grade_group}")
    if mode not in STANDARD_MODES:
        raise ValueError(f"不支援的營養基準模式：{mode}")
    if not days:
        raise ValueError("無法分析空白供餐週")

    profile = active_rules["profiles"][grade_group]
    food_rules = profile["foodContent"][mode]
    tolerance = float(active_rules["weeklyAverageTolerancePercent"])
    day_count = len(days)
    metrics = [
        _calorie_metric(days, profile["nutrition"]["caloriesKcal"]),
    ]
    for key, label, nutrition_key in DAILY_METRICS:
        values = [float(day["nutrition"][nutrition_key]) for day in days]
        rule = food_rules[key]
        metrics.append(
            _food_metric(
                key=key,
                label=label,
                values=values,
                rule=rule,
                tolerance_percent=tolerance,
            )
        )
    metrics.append(_dairy_metric(food_rules["dairy"]))

    attention = [metric for metric in metrics if metric["status"] in {"below", "above"}]
    within_count = sum(metric["status"] == "within" for metric in metrics)
    unavailable_count = sum(metric["status"] == "unavailable" for metric in metrics)
    mode_info = active_rules["modes"][mode]
    meal_type = str(days[0].get("mealType") or "meat")
    meal_type_label = "葷食" if meal_type == "meat" else "素食"

    return {
        "gradeGroup": grade_group,
        "gradeLabel": profile["label"],
        "mode": mode,
        "modeLabel": mode_info["label"],
        "modeDescription": mode_info["description"],
        "dayCount": day_count,
        "mealType": meal_type,
        "mealTypeLabel": meal_type_label,
        "period": {
            "start": days[0]["weekStartDate"],
            "end": days[0]["weekEndDate"],
        },
        "metrics": metrics,
        "summary": {
            "withinCount": within_count,
            "attentionCount": len(attention),
            "unavailableCount": unavailable_count,
            "label": (
                f"{within_count} 項在範圍 · {len(attention)} 項需留意"
                f" · {unavailable_count} 項資料不足"
            ),
        },
        "observations": _build_observations(days, food_rules, active_rules),
        "guidance": _build_guidance(attention),
        "coverageNote": (
            "目前只判讀學校菜單明示的熱量與食物份數；蛋白質克數、脂肪、鈣、鈉、"
            "乳品及深色蔬菜份數未提供，因此不推估。"
        ),
        "methodNote": (
            f"以本週 {day_count} 個供餐日的校方食譜設計值計算；食物類別週間平均依"
            f"官方建議值 ±{_format_number(tolerance)}% 判讀，不代表孩子實際攝取量。"
        ),
    }


def _calorie_metric(
    days: list[dict[str, Any]], rule: dict[str, Any]
) -> dict[str, Any]:
    value = sum(float(day["nutrition"]["caloriesKcal"]) for day in days) / len(days)
    minimum = float(rule["minimum"])
    maximum = float(rule["maximum"])
    status = _range_status(value, minimum, maximum)
    return {
        "key": "calories",
        "label": "平均熱量",
        "value": round(value, 2),
        "valueLabel": f"{round(value):,} kcal",
        "targetLabel": f"建議 {round(minimum):,}–{round(maximum):,} kcal／餐",
        "status": status,
        "statusLabel": STATUS_LABELS[status],
        "message": _metric_message(status, weekly=False, unit="熱量"),
    }


def _food_metric(
    *,
    key: str,
    label: str,
    values: list[float],
    rule: dict[str, Any],
    tolerance_percent: float,
) -> dict[str, Any]:
    is_weekly = rule["unit"] == "servings_per_week"
    value = sum(values) if is_weekly else sum(values) / len(values)
    target_minimum = float(rule.get("minimum", rule.get("target")))
    target_maximum = float(rule.get("maximum", rule.get("target")))
    tolerance_ratio = tolerance_percent / 100
    acceptable_minimum = target_minimum * (1 - tolerance_ratio)
    acceptable_maximum = target_maximum * (1 + tolerance_ratio)
    status = _range_status(value, acceptable_minimum, acceptable_maximum)
    target_value = _target_label(rule)
    value_suffix = "份／週" if is_weekly else "份／餐"
    return {
        "key": key,
        "label": label,
        "value": round(value, 2),
        "valueLabel": f"{_format_number(value)} {value_suffix}",
        "targetLabel": (
            f"基準 {target_value} · 判讀含 ±{_format_number(tolerance_percent)}%"
        ),
        "status": status,
        "statusLabel": STATUS_LABELS[status],
        "message": _metric_message(status, weekly=is_weekly, unit=label),
        "calculation": "weekly_total" if is_weekly else "daily_average",
        "acceptableRange": {
            "minimum": round(acceptable_minimum, 3),
            "maximum": round(acceptable_maximum, 3),
        },
    }


def _dairy_metric(rule: dict[str, Any]) -> dict[str, Any]:
    return {
        "key": "dairy",
        "label": "乳品",
        "value": None,
        "valueLabel": "未提供",
        "targetLabel": f"基準 {_target_label(rule)}",
        "status": "unavailable",
        "statusLabel": STATUS_LABELS["unavailable"],
        "message": "校方營養欄沒有乳品份數，保留為資料不足。",
        "calculation": "unavailable",
    }


def _build_observations(
    days: list[dict[str, Any]],
    food_rules: dict[str, Any],
    rules: dict[str, Any],
) -> list[dict[str, Any]]:
    fish_days = sum(
        bool({"fish", "seafood"}.intersection(day.get("tags", []))) for day in days
    )
    soy_days = sum("tofu" in day.get("tags", []) for day in days)
    fried_days = sum("fried" in day.get("tags", []) for day in days)
    fish_rule = food_rules["fishSeafood"]
    shared = rules["sharedRules"]
    return [
        {
            "key": "fishSeafood",
            "label": "魚類／海鮮",
            "valueLabel": f"菜名可辨識 {fish_days} 天",
            "referenceLabel": f"基準至少 {_target_label(fish_rule)}",
            "note": "未拆分魚類實際份數，因此只呈現供應日觀察。",
        },
        {
            "key": "soyProducts",
            "label": "豆製品",
            "valueLabel": f"菜名可辨識 {soy_days} 天",
            "referenceLabel": (
                "基準至少 "
                f"{_format_number(shared['soyProductsMinimumServingsPerWeek'])} 份／週"
            ),
            "note": "未拆分豆製品實際份數，因此不做達標判定。",
        },
        {
            "key": "friedDishes",
            "label": "酥炸料理",
            "valueLabel": f"菜名可辨識 {fried_days} 天",
            "referenceLabel": (
                "注意事項為每週不超過 "
                f"{_format_number(shared['friedDishesMaximumOccurrencesPerWeek'])} 次"
            ),
            "note": "同一天可能有多道料理，天數不等同實際供應次數。",
        },
    ]


def _build_guidance(attention: list[dict[str, Any]]) -> list[str]:
    guidance = []
    for metric in attention:
        if metric["key"] == "fruit" and metric["status"] == "below":
            guidance.append("本週水果供應低於所選基準，可在早餐、晚餐或點心補一份當季水果。")
        elif metric["key"] == "vegetables" and metric["status"] == "below":
            guidance.append("本週蔬菜平均低於所選基準，家庭餐次可多安排一盤深色蔬菜。")
        elif metric["status"] == "below":
            guidance.append(f"{metric['label']}低於所選基準，先回原始菜單核對供應設計。")
        else:
            guidance.append(f"{metric['label']}高於所選基準；這是供應觀察，不代表個別孩子攝取過量。")
    if not guidance:
        guidance.append("已判讀項目均落在所選基準範圍；仍可依孩子實際食量調整其他餐次。")
    return guidance


def _target_label(rule: dict[str, Any]) -> str:
    unit_labels = {
        "servings_per_meal": "份／餐",
        "servings_per_week": "份／週",
        "servings_per_month": "份／月",
    }
    unit = unit_labels[rule["unit"]]
    if "minimum" in rule and "maximum" in rule:
        value = f"{_format_number(rule['minimum'])}–{_format_number(rule['maximum'])}"
    elif "minimum" in rule:
        value = _format_number(rule["minimum"])
    else:
        value = _format_number(rule["target"])
    return f"{value} {unit}"


def _range_status(value: float, minimum: float, maximum: float) -> str:
    if value < minimum:
        return "below"
    if value > maximum:
        return "above"
    return "within"


def _metric_message(status: str, *, weekly: bool, unit: str) -> str:
    period = "本週供應總量" if weekly else "本週平均"
    if status == "within":
        return f"{period}落在所選{unit}基準範圍。"
    if status == "below":
        return f"{period}低於所選{unit}基準範圍。"
    return f"{period}高於所選{unit}基準範圍。"


def _format_number(value: float | int) -> str:
    number = float(value)
    return str(int(number)) if number.is_integer() else f"{number:.2f}".rstrip("0").rstrip(".")


def _validate_rules(payload: object, path: Path) -> None:
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise NutritionRulesError(f"{path}: 不支援的營養基準格式")
    source = payload.get("source")
    if not isinstance(source, dict) or source.get("review", {}).get("status") != "reviewed":
        raise NutritionRulesError(f"{path}: 營養基準必須先完成校讀")
    tolerance = payload.get("weeklyAverageTolerancePercent")
    if not isinstance(tolerance, (int, float)) or not 0 <= tolerance <= 25:
        raise NutritionRulesError(f"{path}: 週間平均容許值不合理")
    profiles = payload.get("profiles")
    modes = payload.get("modes")
    if not isinstance(profiles, dict) or not isinstance(modes, dict):
        raise NutritionRulesError(f"{path}: 缺少年級或基準模式")
    for mode in STANDARD_MODES:
        if mode not in modes:
            raise NutritionRulesError(f"{path}: 缺少基準模式 {mode}")
    for grade_group in GRADE_GROUPS:
        profile = profiles.get(grade_group)
        if not isinstance(profile, dict):
            raise NutritionRulesError(f"{path}: 缺少年級群組 {grade_group}")
        calories = profile.get("nutrition", {}).get("caloriesKcal", {})
        if not _valid_range(calories):
            raise NutritionRulesError(f"{path}: {grade_group} 熱量範圍不完整")
        food_content = profile.get("foodContent")
        if not isinstance(food_content, dict):
            raise NutritionRulesError(f"{path}: {grade_group} 食物內容不完整")
        for mode in STANDARD_MODES:
            rules = food_content.get(mode)
            if not isinstance(rules, dict):
                raise NutritionRulesError(f"{path}: {grade_group} 缺少 {mode}")
            missing = [
                key
                for key in (*[metric[0] for metric in DAILY_METRICS], "dairy", "fishSeafood")
                if key not in rules
            ]
            if missing:
                raise NutritionRulesError(
                    f"{path}: {grade_group} {mode} 缺少 {', '.join(missing)}"
                )


def _valid_range(value: object) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("minimum"), (int, float))
        and isinstance(value.get("maximum"), (int, float))
        and value["minimum"] <= value["maximum"]
    )
