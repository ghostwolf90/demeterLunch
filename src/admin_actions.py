from __future__ import annotations

import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


TAIPEI = ZoneInfo("Asia/Taipei")
MAX_OUTPUT_CHARACTERS = 24_000


class AdminActionRunner:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root.resolve()
        self._lock = threading.Lock()
        self._state: dict[str, Any] = {
            "status": "idle",
            "message": "尚未執行手動更新。",
            "startedAt": None,
            "finishedAt": None,
            "exitCode": None,
            "output": "",
        }

    def status(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._state)

    def start_update(self) -> bool:
        with self._lock:
            if self._state["status"] == "running":
                return False
            self._state = {
                "status": "running",
                "message": "正在下載、驗證並整合上一個月的官方資料…",
                "startedAt": _now(),
                "finishedAt": None,
                "exitCode": None,
                "output": "",
            }
        thread = threading.Thread(target=self._run_update, daemon=True)
        thread.start()
        return True

    def _run_update(self) -> None:
        command = [
            sys.executable,
            "scripts/update_traceability.py",
            "--verify-and-build",
        ]
        try:
            result = subprocess.run(
                command,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=30 * 60,
                check=False,
            )
            output = _redact_access_code(
                (result.stdout or "") + (result.stderr or ""), self.project_root
            )
            if result.returncode == 0:
                status = "succeeded"
                message = "本機資料更新完成，所有驗證均已通過。"
            elif result.returncode == 2:
                status = "pending"
                message = "官方資料尚未發布，既有資料已完整保留。"
            else:
                status = "failed"
                message = "更新失敗，既有有效資料未被取代。"
            self._finish(status, message, result.returncode, output)
        except subprocess.TimeoutExpired as exc:
            output = _redact_access_code(
                _timeout_output(exc), self.project_root
            )
            self._finish("failed", "更新超過 30 分鐘，已停止等待。", None, output)
        except OSError as exc:
            self._finish("failed", f"無法啟動更新程式：{exc}", None, "")

    def _finish(
        self,
        status: str,
        message: str,
        exit_code: int | None,
        output: str,
    ) -> None:
        with self._lock:
            self._state = {
                "status": status,
                "message": message,
                "startedAt": self._state.get("startedAt"),
                "finishedAt": _now(),
                "exitCode": exit_code,
                "output": output[-MAX_OUTPUT_CHARACTERS:],
            }


def _now() -> str:
    return datetime.now(TAIPEI).isoformat(timespec="seconds")


def _redact_access_code(output: str, project_root: Path) -> str:
    secret_path = project_root / ".secrets" / "fatrace_access_code"
    try:
        secret = secret_path.read_text(encoding="utf-8").strip()
    except OSError:
        secret = ""
    return output.replace(secret, "[REDACTED]") if secret else output


def _timeout_output(exc: subprocess.TimeoutExpired) -> str:
    stdout = exc.stdout.decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else exc.stdout
    stderr = exc.stderr.decode("utf-8", "replace") if isinstance(exc.stderr, bytes) else exc.stderr
    return (stdout or "") + (stderr or "")
