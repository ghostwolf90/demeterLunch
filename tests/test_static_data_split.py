import unittest

from scripts.build_static_site import _seo_school_manifest


class SeoSchoolManifestTests(unittest.TestCase):
    def test_excludes_schools_without_public_records(self) -> None:
        schools = [
            {"fatraceSchoolId": 193609, "name": "忠信國小"},
            {"fatraceSchoolId": 193644, "name": "大勇國小"},
        ]

        manifest = _seo_school_manifest(
            schools,
            {"193609": {"2026-10-16": {"status": "available"}}, "193644": {}},
        )

        self.assertEqual(manifest, {"schemaVersion": 1, "schoolIds": [193609]})


if __name__ == "__main__":
    unittest.main()
