import unittest

from scripts.build_static_site import (
    _sample_variant,
    _sample_week_dates,
    _seo_school_manifest,
)


class StaticDataSplitTests(unittest.TestCase):
    def test_seo_manifest_excludes_schools_without_public_records(self) -> None:
        schools = [
            {"fatraceSchoolId": 193609, "name": "忠信國小"},
            {"fatraceSchoolId": 193644, "name": "大勇國小"},
        ]
        manifest = _seo_school_manifest(
            schools,
            {"193609": {"2026-10-16": {"status": "available"}}, "193644": {}},
        )
        self.assertEqual(manifest, {"schemaVersion": 1, "schoolIds": [193609]})

    def test_sample_week_prefers_latest_complete_past_week(self) -> None:
        days = [
            {
                "date": f"2026-10-{day:02d}",
                "weekId": "complete",
                "meal": {"mainDish": "主菜"},
            }
            for day in range(12, 17)
        ]
        days.extend(
            {
                "date": f"2026-10-{day:02d}",
                "weekId": "future",
                "meal": {"mainDish": "主菜"},
            }
            for day in range(19, 24)
        )

        self.assertEqual(
            _sample_week_dates(days, "2026-10-19"),
            [f"2026-10-{day:02d}" for day in range(12, 17)],
        )

    def test_sample_variant_keeps_only_selected_week_detail(self) -> None:
        selected = ["2026-10-12", "2026-10-13"]
        variant = {
            "days": [
                {"date": "2026-10-12", "weekId": "week-1", "meal": {}},
                {"date": "2026-10-13", "weekId": "week-1", "meal": {}},
                {"date": "2026-10-19", "weekId": "week-2", "meal": {}},
            ],
            "nutritionAssessments": {date: {"date": date} for date in selected + ["2026-10-19"]},
            "dinnerSuggestions": {date: {"date": date} for date in selected + ["2026-10-19"]},
            "foodEducation": {date: {"date": date} for date in selected + ["2026-10-19"]},
            "homeRecipes": {date: {"date": date} for date in selected + ["2026-10-19"]},
            "traceability": {date: {"date": date} for date in selected + ["2026-10-19"]},
            "insights": {"days": 3},
            "archive": [{"id": "week-1"}, {"id": "week-2"}],
            "dateRange": {"start": "2026-10-12", "end": "2026-10-19"},
            "totalDays": 3,
        }

        sample = _sample_variant(variant, selected)

        self.assertEqual([day["date"] for day in sample["days"]], selected)
        self.assertEqual(list(sample["dinnerSuggestions"]), selected)
        self.assertEqual(sample["archive"], [{"id": "week-1"}])
        self.assertEqual(sample["dateRange"], {"start": selected[0], "end": selected[-1]})
        self.assertEqual(sample["totalDays"], 2)


if __name__ == "__main__":
    unittest.main()
