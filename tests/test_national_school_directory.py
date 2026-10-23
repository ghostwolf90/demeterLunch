import unittest

from scripts.fetch_national_school_directory import normalize


class NationalSchoolDirectoryTests(unittest.TestCase):
    def test_filters_historical_years_and_preserves_leading_zero(self):
        rows = [{"學年度": year, "代碼": "011601", "學校名稱": "測試學校",
                 "縣市名稱": "[01]新北市"} for year in (114, "115")]
        schools = normalize(rows, year=115, level="國小", attached=False,
                            source_id="6087")
        self.assertEqual(len(schools), 1)
        self.assertEqual(schools[0]["moeSchoolCode"], "011601")
        self.assertEqual(schools[0]["city"], "新北市")
        self.assertFalse(schools[0]["enabled"])
        self.assertEqual(schools[0]["mealDataStatus"], "not_checked")

    def test_rejects_empty_target_year_and_duplicate_units(self):
        row = {"學年度": 115, "代碼": "011601", "學校名稱": "測試學校",
               "縣市名稱": "新北市"}
        for rows in ([], [row, row]):
            with self.assertRaises(ValueError):
                normalize(rows, year=115, level="國小", attached=False,
                          source_id="6087")

    def test_attached_department_retains_distinct_identity(self):
        row = {"學年度": 115, "代碼": "011601", "學校名稱": "測試學校",
               "縣市名稱": "新北市"}
        main = normalize([row], year=115, level="高中職", attached=False,
                         source_id="6089")[0]
        attached = normalize([row], year=115, level="國中", attached=True,
                             source_id="28590")[0]
        self.assertNotEqual(main["directoryId"], attached["directoryId"])
        self.assertEqual(main["moeSchoolCode"], attached["moeSchoolCode"])

    def test_official_alphanumeric_code_is_preserved(self):
        row = {"學年度": 115, "代碼": "011C71", "學校名稱": "測試進修學校",
               "縣市名稱": "新北市"}
        school = normalize([row], year=115, level="高中職", attached=False,
                           source_id="6089")[0]
        self.assertEqual(school["moeSchoolCode"], "011C71")
