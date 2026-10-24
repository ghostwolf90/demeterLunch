from __future__ import annotations
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from scripts.prepare_release import prepare_release, render_release_html


class ReleaseVersionTests(unittest.TestCase):
    def project(self, root):
        subprocess.run(['git', 'init', '-q', str(root)], check=True)
        (root / '.openai').mkdir()
        (root / '.openai/release.json').write_text(json.dumps({'schemaVersion': 1, 'version': '0.1.0', 'buildNumber': 0, 'releaseId': None, 'builtAt': None}))
        (root / 'package.json').write_text('{"version":"0.1.0"}')
        (root / 'page.html').write_text('first release')

    def test_new_source_increments_while_identical_build_retries_reuse_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.project(root)
            first = prepare_release(root)
            self.assertEqual(first['version'], '0.1.1')
            self.assertEqual(first['buildNumber'], 1)
            self.assertEqual(prepare_release(root), first)
            (root / 'page.html').write_text('updated source')
            second = prepare_release(root)
            self.assertEqual(second['version'], '0.1.2')
            self.assertEqual(second['buildNumber'], 2)
            self.assertNotEqual(second['releaseId'], first['releaseId'])
            self.assertEqual(prepare_release(root), second)

    def test_generated_output_and_database_do_not_create_another_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.project(root)
            first = prepare_release(root)
            (root / 'data').mkdir(); (root / 'data/lunch.db').write_bytes(b'generated database')
            (root / 'dist').mkdir(); (root / 'dist/index.html').write_text('generated output')
            (root / 'public').mkdir(); (root / 'public/index.html').write_text('copied output')
            self.assertEqual(prepare_release(root), first)

    def test_package_major_or_minor_upgrade_is_respected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.project(root)
            prepare_release(root)
            (root / 'package.json').write_text('{"version":"0.2.0"}')
            result = prepare_release(root)
            self.assertEqual(result['version'], '0.2.0')
            self.assertEqual(result['buildNumber'], 2)

    def test_corrupt_metadata_cannot_silently_reset_the_counter(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.project(root)
            target = root / '.openai/release.json'; target.write_text('{broken')
            with self.assertRaises(ValueError): prepare_release(root)
            self.assertEqual(target.read_text(), '{broken')

    def test_rendered_document_and_assets_share_the_release_identity(self):
        release = {'version': '0.1.4', 'buildNumber': 4, 'releaseId': 'a' * 64, 'builtAt': '2026-10-23T15:00:00Z'}
        html = '<span id="settingsAppVersion">old</span><span id="settingsBuildNumber">old</span><script type="application/json" id="siteReleaseMetadata">{}</script><link href="/styles.css?v=old"><script src="/app.js"></script>'
        rendered = render_release_html(html, release)
        self.assertIn('id="settingsAppVersion">0.1.4</span>', rendered)
        self.assertIn('id="settingsBuildNumber">4</span>', rendered)
        self.assertIn('"releaseId":"' + 'a' * 64 + '"', rendered)
        self.assertIn('/styles.css?v=' + 'a' * 16, rendered)
        self.assertIn('/app.js?v=' + 'a' * 16, rendered)
        self.assertNotIn('v=old', rendered)


if __name__ == '__main__': unittest.main()
