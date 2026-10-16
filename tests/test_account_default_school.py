import unittest
from pathlib import Path


class AccountDefaultSchoolTests(unittest.TestCase):
    def test_default_school_is_an_account_database_preference(self) -> None:
        project_root = Path(__file__).resolve().parents[1]
        schema = (project_root / "db" / "schema.ts").read_text(encoding="utf-8")
        account_route = (project_root / "app" / "api" / "account" / "route.ts").read_text(
            encoding="utf-8"
        )
        preference_route = (
            project_root / "app" / "api" / "account" / "default-school" / "route.ts"
        ).read_text(encoding="utf-8")

        self.assertIn('defaultSchoolId: integer("default_school_id")', schema)
        self.assertIn("defaultSchoolId:", account_route)
        self.assertIn("UPDATE parent_accounts SET default_school_id = ?", preference_route)
        self.assertIn("UPDATE parent_accounts SET default_school_id = NULL", preference_route)
        self.assertIn("findSchool(schoolId)", preference_route)


if __name__ == "__main__":
    unittest.main()
