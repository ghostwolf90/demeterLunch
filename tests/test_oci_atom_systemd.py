from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class OciAtomSystemdTests(unittest.TestCase):
    def test_service_only_runs_atom_collection(self) -> None:
        service = (
            PROJECT_ROOT / "ops/oci/demeter-menu-atom.service.in"
        ).read_text(encoding="utf-8")

        self.assertIn("scripts/fetch_latest.py", service)
        self.assertIn("--since 2026-09-01", service)
        self.assertIn("WorkingDirectory=@REPO_DIR@", service)
        self.assertNotIn('WorkingDirectory="@REPO_DIR@"', service)
        self.assertNotIn("--publish", service)
        self.assertNotIn("fetch_school_meals.py", service)

    def test_timer_runs_daily_in_taipei(self) -> None:
        timer = (PROJECT_ROOT / "ops/oci/demeter-menu-atom.timer").read_text(
            encoding="utf-8"
        )

        self.assertIn("OnCalendar=*-*-* 06:37:00 Asia/Taipei", timer)
        self.assertIn("Persistent=true", timer)

    def test_installer_does_not_require_publish_token(self) -> None:
        installer = (
            PROJECT_ROOT / "ops/oci/install-atom-systemd.sh"
        ).read_text(encoding="utf-8")

        self.assertIn("demeter-menu-atom.timer", installer)
        self.assertNotIn("site_publish_token", installer)


if __name__ == "__main__":
    unittest.main()

