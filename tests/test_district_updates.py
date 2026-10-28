from __future__ import annotations

from argparse import Namespace
from contextlib import redirect_stdout
from copy import deepcopy
from datetime import date
import io
import json
from pathlib import Path
import tempfile
import unittest

from scripts.update_school_meals_by_district import run, run_lock
from src.fatrace_daily import candidate_fingerprint


class FakeClient:
    def __init__(self, states=None):
        self.states = states or {}
        self.calls = []

    def probe(self, school, meal_date):
        self.calls.append(school.fatrace_school_id)
        state = self.states.get(school.fatrace_school_id, 'no_meal')
        if state == 'failed':
            raise RuntimeError('測試來源連線失敗')
        candidate = {
            'schemaVersion': 1, 'recordType': 'official-daily-meal-record',
            'school': school.as_dict(), 'mealDate': meal_date.isoformat(),
            'status': state, 'services': [], 'noMealReasons': [{'reason': '例假日'}],
            'fetchedAt': '2026-10-27T11:00:00+08:00',
            'source': {'name': '官方測試來源', 'url':
                f'https://fatraceschool.k12ea.gov.tw/frontend/search.html?school={school.fatrace_school_id}&period={meal_date}'},
        }
        if state == 'wrong_date':
            candidate['mealDate'] = '2026-10-26'
        candidate['contentHash'] = candidate_fingerprint(candidate)
        return {}, candidate

    def collect(self, school, meal_date):
        _, candidate = self.probe(school, meal_date)
        candidate['services'] = [{'serviceId': 1, 'label': '午餐', 'meals': [{
            'batchDataId': 'batch-1', 'menuDate': meal_date.isoformat(),
            'menuType': '午餐', 'kitchenId': 'kitchen-1', 'kitchenName': '測試廚房',
            'uploadedAt': '2026-10-27T08:00:00+08:00', 'nutrition': {},
            'dishes': [{'dishId': 1, 'batchDataId': 'batch-1',
                        'dishBatchDataId': 'dish-1', 'name': '青菜',
                        'category': '蔬菜', 'ingredients': []}],
        }]}]
        candidate['noMealReasons'] = []
        candidate['contentHash'] = candidate_fingerprint(candidate)
        return {}, candidate


class DistrictUpdateTests(unittest.TestCase):
    def setup_run(self, root, **overrides):
        registry = root / 'registry.json'
        registry.write_text(json.dumps({'schemaVersion': 1, 'schools': [
            {'city': '臺中市', 'district': district, 'level': '國小',
             'name': name, 'fullName': '臺中市' + name, 'fatraceSchoolId': sid}
            for sid, district, name in [(1, '西區', '甲國小'), (2, '西區', '乙國小'),
                                        (3, '北區', '丙國小')]
        ]}), encoding='utf-8')
        args = Namespace(date=date(2026, 10, 27), registry=registry, district=None,
                         no_publish=False, skip_ingredients=False, refresh_all=False,
                         timeout=20, interval=1.2, retries=2)
        for key, value in overrides.items():
            setattr(args, key, value)
        return args

    def execute(self, root, args, client, publisher):
        output = io.StringIO()
        with redirect_stdout(output):
            status = run(args, root=root, client=client, publisher=publisher, token='test', rebuild=lambda _: True)
        return status, output.getvalue()

    def test_partial_district_publishes_success_and_continues_then_resumes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root)
            batches = []
            def publish(bundle, *_):
                batches.append(deepcopy(bundle))
                return {'status': 'published'}
            status, output = self.execute(root, args, FakeClient({2: 'failed'}), publish)
            self.assertEqual(status, 1)
            self.assertEqual([[r['schoolId'] for r in b['records']] for b in batches], [[1], [3]])
            self.assertIn('西區處理總結', output)
            self.assertIn('北區處理總結', output)
            self.assertIn('本次全程總結', output)
            self.assertIn('乙國小', output)
            retry = FakeClient()
            status, _ = self.execute(root, args, retry, publish)
            self.assertEqual(status, 0)
            self.assertEqual(retry.calls, [2])
            self.assertEqual([r['schoolId'] for r in batches[-1]['records']], [2])
            retry = FakeClient()
            before = len(batches)
            self.execute(root, args, retry, publish)
            self.assertEqual(retry.calls, [])
            self.assertEqual(len(batches), before)

    def test_upload_failure_retries_upload_without_downloading(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root)
            def fail(*_):
                raise RuntimeError('測試上傳中斷')
            status, output = self.execute(root, args, FakeClient(), fail)
            self.assertEqual(status, 1)
            self.assertIn('下次直接補傳', output)
            client = FakeClient()
            batches = []
            def publish(bundle, *_):
                batches.append(bundle)
                return {'status': 'published'}
            status, _ = self.execute(root, args, client, publish)
            self.assertEqual(status, 0)
            self.assertEqual(client.calls, [])
            self.assertEqual(len(batches), 2)

    def test_resume_visits_pending_first_and_labels_reused_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, no_publish=True)
            self.execute(root, args, FakeClient({3: 'not_published'}), None)
            path = root / 'data/monitor/district-updates/2026-10-27/with-ingredients.json'
            before = json.loads(path.read_text())['schools']['1']
            client = FakeClient()
            status, output = self.execute(root, args, client, None)
            self.assertEqual(status, 0)
            self.assertEqual(client.calls, [3])
            self.assertLess(output.index('開始處理 北區'), output.index('開始處理 西區'))
            self.assertIn('沿用已成功資料，未重新抓取', output)
            after = json.loads(path.read_text())['schools']['1']
            self.assertEqual(before['checkedAt'], after['checkedAt'])
            self.assertEqual(before['attempts'], after['attempts'])

    def test_resume_pending_school_precedes_cached_school_in_same_district(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, no_publish=True)
            self.execute(root, args, FakeClient({2: 'failed'}), None)
            status, output = self.execute(root, args, FakeClient(), None)
            self.assertEqual(status, 0)
            self.assertLess(output.index('乙國小：'), output.index('甲國小：'))

    def test_pending_and_invalid_date_never_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root)
            batches = []
            def publish(bundle, *_):
                batches.append(bundle)
                return {'status': 'published'}
            status, _ = self.execute(root, args,
                FakeClient({1: 'not_published', 2: 'wrong_date'}), publish)
            self.assertEqual(status, 1)
            self.assertEqual([r['schoolId'] for r in batches[0]['records']], [3])
            self.assertFalse((root / 'data/parsed/schools/fatrace/2').exists())
            client = FakeClient({1: 'not_published'})
            status, _ = self.execute(root, args, client, publish)
            self.assertEqual(status, 2)
            self.assertEqual(client.calls, [1, 2])

    def test_no_publish_then_publish_and_refresh_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, no_publish=True)
            batches = []
            def publish(bundle, *_):
                batches.append(bundle)
                return {'status': 'published'}
            status, _ = self.execute(root, args, FakeClient(), publish)
            self.assertEqual(status, 0)
            self.assertEqual(batches, [])
            args.no_publish = False
            client = FakeClient()
            self.execute(root, args, client, publish)
            self.assertEqual(client.calls, [])
            self.assertEqual(len(batches), 2)
            args.refresh_all = True
            client = FakeClient()
            self.execute(root, args, client, publish)
            self.assertEqual(client.calls, [1, 2, 3])
            self.assertEqual(len(batches), 2)

    def test_modes_and_districts_and_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, no_publish=True, district=['西區'])
            client = FakeClient()
            self.execute(root, args, client, None)
            self.assertEqual(client.calls, [1, 2])
            args.skip_ingredients = True
            client = FakeClient()
            self.execute(root, args, client, None)
            self.assertEqual(client.calls, [1, 2])
            with run_lock(root / 'data/monitor/district-updates/.lock'):
                with self.assertRaisesRegex(ValueError, '已有逐區更新'):
                    self.execute(root, args, FakeClient(), None)

    def test_interruption_prints_final_and_saves_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root)
            client = FakeClient()
            def interrupt(*_):
                raise KeyboardInterrupt
            client.probe = interrupt
            status, output = self.execute(root, args, client, None)
            self.assertEqual(status, 130)
            self.assertIn('本次全程總結', output)
            self.assertTrue((root / 'data/monitor/district-updates/2026-10-27/with-ingredients.json').exists())

    def test_available_records_checked_and_missing_candidate_refetched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, district=['北區'])
            batches = []
            def publish(bundle, *_):
                batches.append(bundle)
                return {'status': 'published'}
            status, _ = self.execute(root, args, FakeClient({3: 'available'}), publish)
            self.assertEqual(status, 0)
            record = json.loads(batches[0]['records'][0]['recordJson'])
            self.assertEqual(record['status'], 'available')
            self.assertEqual(record['services'][0]['meals'][0]['dishes'][0]['name'], '青菜')
            (root / 'data/raw/fatrace-daily/2026-10-27/3/candidate.json').unlink()
            client = FakeClient({3: 'available'})
            self.execute(root, args, client, publish)
            self.assertEqual(client.calls, [3, 3])
            self.assertEqual(len(batches), 1)

    def test_wrong_date_refresh_preserves_previously_valid_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            args = self.setup_run(root, district=['北區'])
            def publish(*_):
                return {'status': 'published'}
            self.execute(root, args, FakeClient(), publish)
            raw = root / 'data/raw/fatrace-daily/2026-10-27/3/candidate.json'
            reviewed = root / 'data/parsed/schools/fatrace/3/2026-10-27.json'
            before = (raw.read_bytes(), reviewed.read_bytes())
            args.refresh_all = True
            status, _ = self.execute(root, args, FakeClient({3: 'wrong_date'}), publish)
            self.assertEqual(status, 1)
            self.assertEqual(before, (raw.read_bytes(), reviewed.read_bytes()))
