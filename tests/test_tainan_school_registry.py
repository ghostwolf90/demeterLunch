from __future__ import annotations

from datetime import date
import unittest

from scripts.fetch_tainan_school_registry import (
    extract_school_ids,
    lunch_page_urls,
    normalize_name,
    parse_tainan_directory,
    resolve_verified_school,
    school_name_matches,
    tainan_candidates,
)


class TainanSchoolRegistryTests(unittest.TestCase):
    def test_filters_national_directory_to_tainan_elementary_units(self):
        payload = {"schools": [
            {"directoryId": "a", "city": "臺南市", "level": "國小", "name": "甲國小"},
            {"directoryId": "b", "city": "臺南市", "level": "國中", "name": "乙國中"},
            {"directoryId": "c", "city": "臺中市", "level": "國小", "name": "丙國小"},
        ]}
        self.assertEqual([row["name"] for row in tainan_candidates(payload)], ["甲國小"])

    def test_city_directory_prefers_elementary_row_for_duplicate_code(self):
        raw = (
            '{"success":true,"data":['
            '{"Edu_code":"110328","Stage":"高中","District":"新市區"},'
            '{"Edu_code":"110328","Stage":"國小","District":"新市區"}'
            ']}'
        ).encode()
        _, rows = parse_tainan_directory(raw)
        self.assertEqual(rows["110328"]["Stage"], "國小")

    def test_lunch_page_urls_check_homepage_then_module_and_prefer_https(self):
        urls = lunch_page_urls(
            "http://schoolweb.tn.edu.tw/~demo/",
            meal_date=date(2026, 10, 30),
        )
        self.assertEqual(
            urls[0],
            "https://schoolweb.tn.edu.tw/~demo/",
        )
        self.assertEqual(
            urls[1],
            "https://schoolweb.tn.edu.tw/~demo/modules/tad_lunch3/index.php?period=2026-10-30",
        )
        self.assertTrue(urls[2].startswith("http://"))

    def test_extracts_only_positive_public_school_ids(self):
        html = '''
          <a href="https://fatraceschool.k12ea.gov.tw/frontend/search.html?school=64736619&period=2026-10-30">來源</a>
          <a href="?op=re_get&SchoolId=64736619&period=2026-10-30">更新</a>
        '''
        self.assertEqual(extract_school_ids(html), {64736619})

    def test_ignores_unrelated_local_school_routes(self):
        html = '<a href="/school/92">校內處室</a>'
        self.assertEqual(extract_school_ids(html), set())

    def test_multiple_public_ids_keep_the_one_that_passes_full_verification(self):
        verified = {64730001: {"name": "其他國小"}, 64730002: {"name": "目標國小"}}

        def verify(school_id):
            if school_id == 64730001:
                raise ValueError("校名不一致")
            return verified[school_id]

        school_id, school = resolve_verified_school(
            {64730001, 64730002}, verify, set()
        )
        self.assertEqual(school_id, 64730002)
        self.assertEqual(school["name"], "目標國小")

    def test_multiple_public_ids_stay_excluded_when_verification_is_ambiguous(self):
        with self.assertRaisesRegex(ValueError, "有 2 個通過核對"):
            resolve_verified_school(
                {64730001, 64730002},
                lambda school_id: {"id": school_id},
                set(),
            )

    def test_name_matching_accepts_official_long_form(self):
        candidate = {"name": "市立安平國小", "district": "安平區"}
        self.assertTrue(
            school_name_matches(candidate, "臺南市安平區安平國民小學")
        )
        self.assertEqual(normalize_name("台南市立安平國民小學"), "臺南市立安平國小")

    def test_name_matching_treats_experimental_school_forms_as_equivalent(self):
        candidate = {"name": "市立虎山實驗小學", "district": "仁德區"}
        self.assertTrue(
            school_name_matches(candidate, "臺南市仁德區虎山實驗國小")
        )

    def test_name_matching_treats_private_primary_school_forms_as_equivalent(self):
        candidate = {"name": "私立寶仁小學", "district": "北區"}
        self.assertTrue(
            school_name_matches(candidate, "臺南市北區私立寶仁國小")
        )


if __name__ == "__main__":
    unittest.main()
