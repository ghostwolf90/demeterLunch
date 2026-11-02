from __future__ import annotations

import json
import os
import tempfile
import threading
from collections import Counter
from pathlib import Path
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "data" / "reference" / "city-visibility.json"
DEFAULT_REGISTRY_PATH = (
    PROJECT_ROOT / "data" / "reference" / "active-elementary-schools.json"
)
_WRITE_LOCK = threading.Lock()


def load_city_visibility(
    config_path: Path = DEFAULT_CONFIG_PATH,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
) -> list[dict[str, object]]:
    registry = _load_object(registry_path, "學校名冊")
    schools = registry.get("schools")
    if not isinstance(schools, list):
        raise ValueError("學校名冊缺少 schools 陣列")

    ordered_cities: list[str] = []
    counts: Counter[str] = Counter()
    for school in schools:
        if not isinstance(school, dict):
            raise ValueError("學校名冊包含無效的學校資料")
        city = school.get("city")
        if not isinstance(city, str) or not city.strip():
            raise ValueError("學校名冊包含缺少縣市的學校")
        city = city.strip()
        if city not in counts:
            ordered_cities.append(city)
        counts[city] += 1

    config = _load_object(config_path, "縣市顯示設定")
    if config.get("schemaVersion") != 1:
        raise ValueError("縣市顯示設定的 schemaVersion 必須是 1")
    entries = config.get("cities")
    if not isinstance(entries, list):
        raise ValueError("縣市顯示設定缺少 cities 陣列")

    configured: dict[str, bool] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("縣市顯示設定包含無效項目")
        name = entry.get("name")
        enabled = entry.get("enabled")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("縣市顯示設定包含空白名稱")
        name = name.strip()
        if name in configured:
            raise ValueError(f"縣市顯示設定重複：{name}")
        if name not in counts:
            raise ValueError(f"縣市顯示設定包含名冊外的縣市：{name}")
        if not isinstance(enabled, bool):
            raise ValueError(f"{name} 的 enabled 必須是布林值")
        configured[name] = enabled

    return [
        {
            "name": city,
            "enabled": configured.get(city, False),
            "schoolCount": counts[city],
        }
        for city in ordered_cities
    ]


def enabled_city_names(
    config_path: Path = DEFAULT_CONFIG_PATH,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
) -> set[str]:
    return {
        str(item["name"])
        for item in load_city_visibility(config_path, registry_path)
        if item["enabled"] is True
    }


def visible_schools(
    schools: Iterable[dict[str, object]],
    config_path: Path = DEFAULT_CONFIG_PATH,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
) -> list[dict[str, object]]:
    enabled = enabled_city_names(config_path, registry_path)
    return [school for school in schools if school.get("city") in enabled]


def set_city_visibility(
    city: str,
    enabled: bool,
    config_path: Path = DEFAULT_CONFIG_PATH,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
) -> list[dict[str, object]]:
    if not isinstance(city, str) or not city.strip():
        raise ValueError("縣市名稱不可空白")
    if not isinstance(enabled, bool):
        raise ValueError("enabled 必須是布林值")
    city = city.strip()

    with _WRITE_LOCK:
        settings = load_city_visibility(config_path, registry_path)
        if city not in {str(item["name"]) for item in settings}:
            raise ValueError(f"學校名冊沒有這個縣市：{city}")
        payload = {
            "schemaVersion": 1,
            "cities": [
                {
                    "name": item["name"],
                    "enabled": enabled if item["name"] == city else item["enabled"],
                }
                for item in settings
            ],
        }
        _atomic_write_json(config_path, payload)
        return load_city_visibility(config_path, registry_path)


def _load_object(path: Path, label: str) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"找不到{label}：{path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label}不是有效 JSON：{path}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{label}必須是 JSON 物件")
    return payload


def _atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        temporary_path.chmod(path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
