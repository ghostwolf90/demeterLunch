import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from src.archive_storage import archive_file, archive_digest, open_archive
from src.fatrace_openapi import validate_csv_file, build_traceability_package
from src.fatrace_daily import DailyMealStorage
from scripts.update_traceability import _check_archive_collisions
from src.fatrace_openapi import DownloadedCsv, FatraceError
from scripts.compact_lunch_data import compact


class ArchiveStorageTests(unittest.TestCase):
    def test_archive_preserves_exact_bytes_and_original_logical_path_still_reads(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'sample.csv'
            content = ('名稱,產地\r\n空心菜,臺灣\r\n' * 100).encode('utf-8-sig')
            path.write_bytes(content)
            archived = archive_file(path)
            self.assertFalse(path.exists())
            self.assertEqual(gzip.decompress(archived.read_bytes()), content)
            self.assertEqual(archive_digest(path), hashlib.sha256(content).hexdigest())
            self.assertEqual(validate_csv_file(path), ('名稱', '產地'))

    def test_conflicting_or_corrupt_archive_never_removes_original(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'source.csv'
            path.write_bytes(b'original')
            zipped = path.with_name('source.csv.gz')
            zipped.write_bytes(gzip.compress(b'different'))
            with self.assertRaises(ValueError): archive_file(path)
            self.assertEqual(path.read_bytes(), b'original')
            zipped.write_bytes(b'broken')
            with self.assertRaises(OSError): archive_file(path)
            self.assertEqual(path.read_bytes(), b'original')

    def test_reviewed_package_is_identical_for_plain_and_compressed_csv(self):
        sample = Path(__file__).resolve().parents[1] / '校園登入食材平台_營養午餐/202608_臺中市國中小午餐菜色及食材資料集20261002101610.csv'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / sample.name
            path.write_bytes(sample.read_bytes())
            args = dict(source_month='2026-08', source_file='original.csv', school_name='臺中市西區忠信國小', county='臺中市', available_dates={'2026-08-31'})
            plain = build_traceability_package(path, **args)
            self.assertIsNotNone(plain)
            zipped = archive_file(path)
            self.assertEqual(build_traceability_package(path, **args), plain)
            self.assertEqual(build_traceability_package(zipped, **args), plain)

    def test_archive_collision_checks_use_uncompressed_source_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp);path = root / 'test.csv';data=b'a,b\n1,2\n';path.write_bytes(data)
            archive_file(path)
            item = DownloadedCsv(path=path, filename=path.name, byte_count=len(data), sha256=hashlib.sha256(data).hexdigest(), headers=('a','b'))
            _check_archive_collisions(root, [{'downloaded':item}])
            item = DownloadedCsv(path=path, filename=path.name, byte_count=0, sha256='wrong', headers=('a','b'))
            with self.assertRaises(FatraceError): _check_archive_collisions(root, [{'downloaded':item}])

    def test_compaction_is_repeatable_and_leaves_reviewed_records_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'raw/fatrace-daily/2026-10-22/193609';folder.mkdir(parents=True)
            original={'菜色':'炒空心菜','details':[{'name':'青菜'}]*20}
            (folder/'raw.json').write_text(json.dumps(original,indent=2,ensure_ascii=False))
            (folder/'candidate.json').write_text(json.dumps(original,indent=2,ensure_ascii=False))
            reviewed=root/'parsed/reviewed.json';reviewed.parent.mkdir();reviewed.write_text('unchanged')
            compact(root)
            self.assertTrue((folder/'raw.json').exists())
            result=compact(root,True)
            self.assertGreater(result['savedBytes'],0)
            with open_archive(folder/'raw.json','rt',encoding='utf-8') as stream:self.assertEqual(json.load(stream),original)
            self.assertEqual(json.loads((folder/'candidate.json').read_text()),original)
            self.assertEqual(reviewed.read_text(),'unchanged')
            self.assertEqual(compact(root,True)['savedBytes'],0)
