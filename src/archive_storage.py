"""Lossless cold-source storage; reviewed JSON and serving paths stay uncompressed."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path


def archived_path(path: Path) -> Path:
    if path.is_file() or path.suffix == '.gz':
        return path
    return path.with_name(path.name + '.gz')


def open_archive(path: Path, mode: str = 'rb', **kwargs):
    resolved = archived_path(path)
    return gzip.open(resolved, mode, **kwargs) if resolved.suffix == '.gz' else resolved.open(mode, **kwargs)


def archive_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with open_archive(path) as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def archive_file(path: Path) -> Path:
    """Replace a cold source only after streaming decompression verifies every byte."""
    destination = path.with_name(path.name + '.gz')
    original_stat = path.stat()
    expected = archive_digest(path)
    if destination.exists():
        if archive_digest(destination) != expected:
            raise ValueError(f'壓縮封存與原檔不同：{destination}')
    else:
        fd, temporary = tempfile.mkstemp(prefix='.' + path.name, suffix='.gz', dir=path.parent)
        staging = Path(temporary)
        try:
            with os.fdopen(fd, 'wb') as output:
                with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0, compresslevel=6) as zipped:
                    with path.open('rb') as source:
                        shutil.copyfileobj(source, zipped, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            if archive_digest(staging) != expected:
                raise ValueError(f'壓縮驗證失敗：{path}')
            os.chmod(staging, original_stat.st_mode & 0o777)
            os.utime(staging, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
            os.replace(staging, destination)
        finally:
            staging.unlink(missing_ok=True)
    # A concurrent writer must never have its newly updated source removed.
    if archive_digest(path) != expected:
        raise ValueError(f'封存期間原檔已異動，保留兩份資料：{path}')
    path.unlink()
    return destination


def write_archived_json(path: Path, payload: dict) -> None:
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0, compresslevel=6) as stream:
        stream.write((json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8'))
