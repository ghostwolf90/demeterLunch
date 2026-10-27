from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from src.dashboard import load_site_dashboard


class RequestedDailyRecordTests(TestCase):
    def test_official_lookup_uses_requested_date_when_weekly_plan_falls_back(self):
        old = {'mealDate': '2026-10-23'}
        actual = {'mealDate': '2026-10-27', 'status': 'available'}
        catalog = {'schools': [{'fatraceSchoolId': 193609}],
                   'records': {'193609': {'2026-10-23': old, '2026-10-27': actual}}}
        with patch('src.dashboard.load_school_meal_catalog', return_value=catalog), patch(
            'src.dashboard.load_dashboard', return_value={'selected': {'date': '2026-10-23'}}
        ):
            result = load_site_dashboard(Path('unused.db'), '2026-10-27')
        self.assertEqual(result['officialRecord']['mealDate'], '2026-10-27')

    def test_missing_requested_date_never_uses_older_official_record(self):
        catalog = {'schools': [{'fatraceSchoolId': 193609}],
                   'records': {'193609': {'2026-10-23': {'mealDate': '2026-10-23'}}}}
        with patch('src.dashboard.load_school_meal_catalog', return_value=catalog), patch(
            'src.dashboard.load_dashboard', return_value={'selected': {'date': '2026-10-23'}}
        ):
            result = load_site_dashboard(Path('unused.db'), '2026-10-27')
        self.assertIsNone(result['officialRecord'])
