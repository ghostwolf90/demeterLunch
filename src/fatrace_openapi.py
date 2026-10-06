from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import ssl
import sys
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


API_ROOT = "https://fatraceschool.k12ea.gov.tw/cateringservice/openapi"
DOWNLOAD_HOST = "fatraceschool.k12ea.gov.tw"
DOWNLOAD_PATH_PREFIX = "/cateringservice/web/openapi_download/"
TAIPEI = ZoneInfo("Asia/Taipei")
DEFAULT_USER_AGENT = (
    "Demeter/1.0 (+https://zxes.blogspot.com/; "
    "personal non-commercial monthly school lunch archive)"
)
TRACEABILITY_DATASET_NAME = "午餐菜色及食材資料集"
TRACEABILITY_HEADERS = {
    "市縣名稱",
    "區域名稱",
    "學校名稱",
    "供餐日期",
    "供餐業者",
    "供餐業者統一編號",
    "食材供應商名稱",
    "食材供應商統編",
    "菜色類別",
    "菜色名稱",
    "食材名稱",
    "調味料供應商名稱",
    "調味料供應商統編",
    "調味料名稱",
    "認證標章",
    "認證號碼",
}


class FatraceError(RuntimeError):
    """Raised when the campus ingredient OpenAPI response is unusable."""


class FatraceDataUnavailable(FatraceError):
    """Raised when the requested monthly data has not been published yet."""


@dataclass(frozen=True)
class Dataset:
    year: str
    month: str
    county: str
    grade: str
    name: str
    created_at: str

    @property
    def key(self) -> tuple[str, str, str, str, str]:
        return (self.year, self.month, self.county, self.grade, self.name)


@dataclass(frozen=True)
class DownloadedCsv:
    path: Path
    filename: str
    byte_count: int
    sha256: str
    headers: tuple[str, ...]


class FatraceClient:
    def __init__(
        self,
        access_code: str,
        *,
        timeout: float = 30.0,
        attempts: int = 3,
        request_interval: float = 1.0,
        user_agent: str = DEFAULT_USER_AGENT,
        opener: Callable[..., Any] = urlopen,
        sleeper: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        if not access_code.strip():
            raise ValueError("校園食材 OpenAPI access code 不可為空")
        if attempts < 1:
            raise ValueError("attempts 必須至少為 1")
        self._access_code = access_code.strip()
        self.timeout = timeout
        self.attempts = attempts
        self.request_interval = request_interval
        self.user_agent = user_agent
        self._opener = opener
        self._sleep = sleeper
        self._monotonic = monotonic
        self._ssl_context = ssl_context or _verified_ssl_context()
        self._last_request_at: float | None = None

    def query_datasets(self, year: int, month: int, county: str) -> list[Dataset]:
        payload = self._post_json(
            "/opendatadataset/",
            {
                "accesscode": self._access_code,
                "year": f"{year:04d}",
                "month": f"{month:02d}",
                "county": county,
            },
        )
        rows = payload.get("datasetList")
        if rows is None:
            message = str(payload.get("message") or "資料尚未提供")
            raise FatraceDataUnavailable(
                f"{year:04d}-{month:02d} {county} 的資料集清單不可用：{message}"
            )
        if not isinstance(rows, list):
            raise FatraceError("OpenAPI datasetList 不是陣列")

        datasets: list[Dataset] = []
        for row in rows:
            if not isinstance(row, dict):
                raise FatraceError("OpenAPI datasetList 含有非物件項目")
            name = str(row.get("datasetname") or "").strip()
            if not name:
                raise FatraceError("OpenAPI 資料集缺少 datasetname")
            response_month = str(row.get("month") or "").strip()
            datasets.append(
                Dataset(
                    year=str(row.get("year") or "").strip(),
                    month=response_month.zfill(2) if response_month else "",
                    county=str(row.get("county") or "").strip(),
                    grade=str(row.get("grade") or "").strip(),
                    name=name,
                    created_at=str(row.get("createdate") or "").strip(),
                )
            )
        return datasets

    def get_download_link(self, dataset: Dataset) -> str:
        payload = self._post_json(
            "/opendatadownload/",
            {
                "accesscode": self._access_code,
                "year": dataset.year,
                "month": dataset.month,
                "county": dataset.county,
                "grade": dataset.grade,
                "datasetname": dataset.name,
            },
        )
        link = str(payload.get("link") or "").strip()
        if not link:
            message = str(payload.get("message") or "下載連結尚未提供")
            raise FatraceDataUnavailable(
                f"{dataset.year}-{dataset.month} {dataset.name}：{message}"
            )
        return normalize_download_url(link)

    def download_csv(self, link: str, directory: Path) -> DownloadedCsv:
        safe_url = normalize_download_url(link)
        filename = download_filename(safe_url)
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / filename
        last_error: BaseException | None = None

        for attempt in range(self.attempts):
            destination.unlink(missing_ok=True)
            self._respect_interval()
            request = Request(
                safe_url,
                headers={"Accept": "text/csv,*/*;q=0.5", "User-Agent": self.user_agent},
                method="GET",
            )
            try:
                with self._opener(
                    request, timeout=self.timeout, context=self._ssl_context
                ) as response:
                    status = getattr(response, "status", 200)
                    if status != 200:
                        raise FatraceError(f"CSV 下載回應 HTTP {status}")
                    digest = hashlib.sha256()
                    byte_count = 0
                    with destination.open("wb") as output:
                        while True:
                            chunk = response.read(1024 * 1024)
                            if not chunk:
                                break
                            output.write(chunk)
                            digest.update(chunk)
                            byte_count += len(chunk)
                if byte_count == 0:
                    raise FatraceError("CSV 下載結果是空檔案")
                headers = validate_csv_file(destination)
                return DownloadedCsv(
                    path=destination,
                    filename=filename,
                    byte_count=byte_count,
                    sha256=digest.hexdigest(),
                    headers=headers,
                )
            except (HTTPError, URLError, TimeoutError, OSError, FatraceError) as exc:
                destination.unlink(missing_ok=True)
                last_error = exc
                if attempt + 1 >= self.attempts or not _retryable(exc):
                    break
                self._sleep(min(2 ** (attempt + 1), 8))

        raise FatraceError(f"無法下載官方 CSV：{_safe_error(last_error)}") from last_error

    def _post_json(self, path: str, payload: dict[str, str]) -> dict[str, Any]:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = Request(
            f"{API_ROOT}{path}",
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": self.user_agent,
            },
            method="POST",
        )
        last_error: BaseException | None = None
        for attempt in range(self.attempts):
            self._respect_interval()
            try:
                with self._opener(
                    request, timeout=self.timeout, context=self._ssl_context
                ) as response:
                    status = getattr(response, "status", 200)
                    raw = response.read()
                if status != 200:
                    raise FatraceError(f"OpenAPI 回應 HTTP {status}")
                result = json.loads(raw.decode("utf-8-sig"))
                if not isinstance(result, dict):
                    raise FatraceError("OpenAPI JSON 根節點不是物件")
                return result
            except (
                HTTPError,
                URLError,
                TimeoutError,
                OSError,
                UnicodeDecodeError,
                json.JSONDecodeError,
                FatraceError,
            ) as exc:
                last_error = exc
                if attempt + 1 >= self.attempts or not _retryable(exc):
                    break
                self._sleep(min(2 ** (attempt + 1), 8))
        raise FatraceError(f"校園食材 OpenAPI 請求失敗：{_safe_error(last_error)}") from last_error

    def _respect_interval(self) -> None:
        if self._last_request_at is not None:
            elapsed = self._monotonic() - self._last_request_at
            remaining = self.request_interval - elapsed
            if remaining > 0:
                self._sleep(remaining)
        self._last_request_at = self._monotonic()


def normalize_download_url(link: str) -> str:
    parts = urlsplit(link)
    if parts.scheme != "https" or (parts.hostname or "").lower() != DOWNLOAD_HOST:
        raise FatraceError("OpenAPI 回傳了不允許的下載主機")
    if not parts.path.startswith(DOWNLOAD_PATH_PREFIX):
        raise FatraceError("OpenAPI 回傳了不允許的下載路徑")
    encoded_path = quote(unquote(parts.path), safe="/%")
    return urlunsplit((parts.scheme, parts.netloc, encoded_path, parts.query, ""))


def download_filename(link: str) -> str:
    filename = Path(unquote(urlsplit(link).path)).name
    if not filename or filename in {".", ".."} or not filename.lower().endswith(".csv"):
        raise FatraceError("OpenAPI 下載連結不是 CSV")
    if Path(filename).name != filename:
        raise FatraceError("OpenAPI CSV 檔名不安全")
    return filename


def validate_csv_file(
    path: Path, required_headers: Iterable[str] | None = None
) -> tuple[str, ...]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream)
            headers = tuple((value or "").strip() for value in next(reader))
            first_row = next(reader, None)
    except (OSError, UnicodeDecodeError, csv.Error, StopIteration) as exc:
        raise FatraceError(f"CSV 格式無法解析：{path.name}") from exc
    if len(headers) < 2 or len(set(headers)) != len(headers):
        raise FatraceError(f"CSV 欄位名稱不完整或重複：{path.name}")
    if first_row is None:
        raise FatraceError(f"CSV 沒有資料列：{path.name}")
    required = set(required_headers or ())
    missing = sorted(required - set(headers))
    if missing:
        raise FatraceError(f"{path.name} 缺少欄位：{', '.join(missing)}")
    return headers


def select_monthly_datasets(
    datasets: Iterable[Dataset], *, county: str, grade: str
) -> list[Dataset]:
    selected: OrderedDict[tuple[str, str, str, str, str], Dataset] = OrderedDict()
    for dataset in datasets:
        is_county = dataset.county == county and dataset.grade == grade
        is_national = dataset.county in {"", "全國"} and dataset.grade == ""
        if is_county or is_national:
            selected.setdefault(dataset.key, dataset)
    return sorted(
        selected.values(),
        key=lambda item: (item.county != county, item.grade != grade, item.name),
    )


def find_traceability_dataset(
    datasets: Iterable[Dataset], *, county: str, grade: str
) -> Dataset:
    matches = [
        dataset
        for dataset in datasets
        if dataset.county == county
        and dataset.grade == grade
        and dataset.name == TRACEABILITY_DATASET_NAME
    ]
    if len(matches) != 1:
        raise FatraceDataUnavailable(
            f"找不到唯一的 {county}{grade}{TRACEABILITY_DATASET_NAME}"
        )
    return matches[0]


def build_traceability_package(
    csv_path: Path,
    *,
    source_month: str,
    source_file: str,
    school_name: str,
    county: str,
    available_dates: set[str],
    excluded_dates: set[str] | None = None,
    existing_payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    validate_csv_file(csv_path, TRACEABILITY_HEADERS)
    excluded = excluded_dates or set()
    rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
        for raw in csv.DictReader(stream):
            row = {key: _clean_csv_value(value) for key, value in raw.items()}
            if row.get("學校名稱") != school_name or row.get("市縣名稱") != county:
                continue
            menu_date = _normalize_date(row.get("供餐日期", ""))
            if not menu_date.startswith(f"{source_month}-"):
                continue
            if menu_date not in available_dates or menu_date in excluded:
                continue
            for required in ("菜色名稱", "食材名稱", "食材供應商名稱"):
                if not row.get(required):
                    raise FatraceError(
                        f"{csv_path.name}: {menu_date} 的官方資料缺少{required}"
                    )
            row["供餐日期"] = menu_date
            rows.append(row)
    if not rows:
        return None

    businesses: OrderedDict[str, dict[str, Any]] = OrderedDict()
    certifications: OrderedDict[str, dict[str, Any]] = OrderedDict()
    day_groups: OrderedDict[str, OrderedDict[tuple[str, str], dict[str, Any]]] = (
        OrderedDict()
    )
    seen_ingredients: set[tuple[str, str, str, str, str, str]] = set()

    for row in rows:
        menu_date = row["供餐日期"]
        supplier_name = row["食材供應商名稱"]
        supplier_tax_id = _digits(row.get("食材供應商統編", ""))
        supplier_id = _business_id(supplier_name, supplier_tax_id)
        businesses.setdefault(
            supplier_id,
            {
                "id": supplier_id,
                "name": supplier_name,
                "kind": "platform-supplier",
                "taxId": supplier_tax_id or None,
                "address": None,
                "phone": None,
                "sourceUrl": None,
            },
        )

        label = row.get("認證標章", "")
        number = _identifier(row.get("認證號碼", ""))
        certification_id: str | None = None
        if label and number:
            certification_id = _certification_id(label, number)
            certifications.setdefault(
                certification_id,
                {
                    "id": certification_id,
                    "label": label,
                    "number": number,
                    "operatorBusinessId": None,
                    "verificationBody": _verification_body(label),
                    "status": None,
                    "validUntil": None,
                    "officialUrl": _official_certification_url(label, number),
                },
            )

        category = row.get("菜色類別") or "未分類"
        official_name = row["菜色名稱"]
        dishes = day_groups.setdefault(menu_date, OrderedDict())
        dish = dishes.setdefault(
            (category, official_name),
            {
                "name": official_name,
                "officialName": official_name,
                "category": category,
                "ingredients": [],
            },
        )
        ingredient_key = (
            menu_date,
            category,
            official_name,
            row["食材名稱"],
            supplier_id,
            certification_id or label,
        )
        if ingredient_key in seen_ingredients:
            continue
        seen_ingredients.add(ingredient_key)
        ingredient: dict[str, Any] = {
            "name": row["食材名稱"],
            "supplierBusinessId": supplier_id,
            "certificationId": certification_id,
        }
        if label and not certification_id:
            ingredient["platformMark"] = label
        dish["ingredients"].append(ingredient)

    exported_at = _exported_at_from_filename(csv_path.name)
    prior_source = (existing_payload or {}).get("source", {})
    prior_review = (existing_payload or {}).get("review", {})
    reviewed_at = (
        prior_review.get("reviewedAt")
        if prior_source.get("sourceFile") == source_file
        else datetime.now(TAIPEI).date().isoformat()
    )
    return {
        "schemaVersion": 1,
        "schoolName": school_name,
        "source": {
            "id": f"school-food-platform-{source_month}-{_slug(school_name)}-openapi",
            "name": "校園食材登錄平臺 OpenAPI",
            "sourceMonth": source_month,
            "exportedAt": exported_at,
            "sourceFile": source_file,
        },
        "review": {
            "status": "reviewed",
            "reviewedAt": reviewed_at,
            "notes": (
                f"由官方 OpenAPI CSV 自動匯入；精確篩選{school_name}，"
                "並核對月份、必填欄位、日期、供應商、認證關聯與重複列。"
                "菜單與食譜名稱仍以人工校讀資料為準。"
            ),
        },
        "businesses": list(businesses.values()),
        "certifications": list(certifications.values()),
        "days": [
            {"date": menu_date, "dishes": list(dishes.values())}
            for menu_date, dishes in day_groups.items()
        ],
    }


def _retryable(exc: BaseException) -> bool:
    if isinstance(exc, HTTPError):
        return exc.code == 429 or 500 <= exc.code < 600
    return isinstance(exc, (URLError, TimeoutError, OSError))


def _verified_ssl_context() -> ssl.SSLContext:
    if os.environ.get("SSL_CERT_FILE"):
        return ssl.create_default_context()
    system_bundle = Path("/etc/ssl/cert.pem")
    if sys.platform == "darwin" and system_bundle.is_file():
        return ssl.create_default_context(cafile=system_bundle)
    return ssl.create_default_context()


def _safe_error(exc: BaseException | None) -> str:
    if exc is None:
        return "未知錯誤"
    if isinstance(exc, HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, URLError):
        return f"URLError ({exc.reason})"
    if isinstance(exc, TimeoutError):
        return "TimeoutError"
    if isinstance(exc, OSError):
        return f"{exc.__class__.__name__} ({exc})"
    return exc.__class__.__name__


def _clean_csv_value(value: object) -> str:
    text = str(value or "").strip()
    match = re.fullmatch(r'=\"(.*)\"', text)
    return match.group(1).strip() if match else text


def _normalize_date(value: str) -> str:
    text = value.strip().split(" ", 1)[0]
    for pattern in ("%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            pass
    raise FatraceError(f"官方 CSV 日期格式錯誤：{value!r}")


def _digits(value: str) -> str:
    return "".join(character for character in value if character.isdigit())


def _identifier(value: str) -> str:
    return value.strip().replace(" ", "")


def _business_id(name: str, tax_id: str) -> str:
    if tax_id:
        return f"tax-{tax_id}"
    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:12]
    return f"supplier-{digest}"


def _certification_id(label: str, number: str) -> str:
    prefixes = {
        "產銷履歷": "tap",
        "臺灣優良農產品(CAS)": "cas",
        "台灣優良農產品(CAS)": "cas",
        "臺灣有機農產品": "organic",
        "台灣有機農產品": "organic",
        "溯源農糧產品": "trace",
        "溯源水產品": "fish-trace",
    }
    prefix = prefixes.get(label)
    if prefix is None:
        prefix = f"mark-{hashlib.sha256(label.encode('utf-8')).hexdigest()[:8]}"
    return f"{prefix}-{number}"


def _verification_body(label: str) -> str | None:
    if "溯源農糧" in label:
        return "農業部農糧署"
    return None


def _official_certification_url(label: str, number: str) -> str | None:
    if "溯源農糧" in label:
        return f"https://qrc.afa.gov.tw/blog/{quote(number)}"
    return None


def _exported_at_from_filename(filename: str) -> str | None:
    matches = re.findall(r"(20\d{12})", filename)
    if not matches:
        return None
    try:
        value = datetime.strptime(matches[-1], "%Y%m%d%H%M%S")
    except ValueError:
        return None
    return value.isoformat() + "+08:00"


def _slug(value: str) -> str:
    known = {"臺中市西區忠信國小": "zhongxin"}
    if value in known:
        return known[value]
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
