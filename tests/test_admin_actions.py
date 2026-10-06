import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from src.admin_actions import AdminActionRunner


class AdminActionRunnerTests(unittest.TestCase):
    def _wait(self, runner: AdminActionRunner) -> dict[str, object]:
        for _ in range(100):
            state = runner.status()
            if state["status"] != "running":
                return state
            time.sleep(0.01)
        self.fail("admin action did not finish")

    def test_successful_update_records_completion(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            runner = AdminActionRunner(Path(directory))
            result = subprocess.CompletedProcess([], 0, stdout='{"status":"updated"}\n', stderr="")
            with patch("src.admin_actions.subprocess.run", return_value=result):
                self.assertTrue(runner.start_update())
                self.assertFalse(runner.start_update())
                state = self._wait(runner)

            self.assertEqual(state["status"], "succeeded")
            self.assertEqual(state["exitCode"], 0)
            self.assertIn("updated", state["output"])

    def test_pending_update_preserves_a_safe_result(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            secret_root = root / ".secrets"
            secret_root.mkdir()
            (secret_root / "fatrace_access_code").write_text(
                "do-not-show", encoding="utf-8"
            )
            runner = AdminActionRunner(root)
            result = subprocess.CompletedProcess(
                [], 2, stdout="pending do-not-show", stderr=""
            )
            with patch("src.admin_actions.subprocess.run", return_value=result):
                self.assertTrue(runner.start_update())
                state = self._wait(runner)

            self.assertEqual(state["status"], "pending")
            self.assertNotIn("do-not-show", state["output"])
            self.assertIn("[REDACTED]", state["output"])


if __name__ == "__main__":
    unittest.main()
