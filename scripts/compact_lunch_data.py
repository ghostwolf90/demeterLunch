#!/usr/bin/env python3
"""Compact cold lunch sources without changing reviewed records or live readers."""
from pathlib import Path
import argparse
import json
import os
import sys
import tempfile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
from src.archive_storage import archive_file


def compact(root: Path, apply: bool = False) -> dict:
    sources = sorted((root / 'raw/fatrace-daily').glob('*/*/raw.json'))
    sources += sorted((root / 'raw/fatrace-openapi').glob('*/*.csv'))
    candidates = sorted((root / 'raw/fatrace-daily').glob('*/*/candidate.json'))
    before = sum(p.stat().st_size for p in sources + candidates)
    after = 0
    for path in sources:
        after += archive_file(path).stat().st_size if apply else path.stat().st_size
    changed = 0
    for path in candidates:
        original = path.read_bytes()
        payload = json.loads(original)
        content = (json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        after += len(content)
        if len(content) >= len(original):
            after += len(original) - len(content)
            continue
        changed += 1
        if not apply:
            continue
        stat = path.stat()
        fd, name = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
        staging = Path(name)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            assert json.loads(staging.read_bytes()) == payload
            if path.read_bytes() != original:
                raise ValueError(f'整理期間原檔已異動：{path}')
            os.chmod(staging, stat.st_mode & 0o777)
            os.utime(staging, ns=(stat.st_atime_ns, stat.st_mtime_ns))
            os.replace(staging, path)
        finally:
            staging.unlink(missing_ok=True)
    return {'applied': apply, 'archivedSources': len(sources), 'compactedCandidates': changed,
            'beforeBytes': before, 'afterBytes': after, 'savedBytes': before - after}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='確認壓縮內容完整後，替換原始封存檔；預設僅盤點')
    args = parser.parse_args()
    print(json.dumps(compact(PROJECT_ROOT / 'data', args.apply), ensure_ascii=False))
