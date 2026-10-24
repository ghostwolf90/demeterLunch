#!/usr/bin/env python3
"""Prepare an idempotent release identity before a production build."""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RELEASE_PATH = Path('.openai/release.json')
GENERATED_FILES = {str(RELEASE_PATH), 'data/lunch.db'}
GENERATED_ROOTS = {'node_modules', 'dist', 'public', '.sites-runtime', '.next', '.vinext', '.wrangler', '.sites'}


def version_tuple(value: str) -> tuple[int, int, int]:
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', value):
        raise ValueError('Release version must contain three numeric components')
    return tuple(int(part) for part in value.split('.'))


def load_release_metadata(root: Path = PROJECT_ROOT) -> dict:
    release = json.loads((root / RELEASE_PATH).read_text(encoding='utf-8'))
    version_tuple(release['version'])
    if type(release.get('buildNumber')) is not int or release['buildNumber'] < 0:
        raise ValueError('Release buildNumber must be a non-negative integer')
    identity = release.get('releaseId')
    if identity is not None and not re.fullmatch(r'[0-9a-f]{64}', identity):
        raise ValueError('Release identity must be a SHA-256 digest')
    return release


def source_fingerprint(root: Path) -> str:
    files = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root
    ).decode().split('\0')
    digest = hashlib.sha256()
    for name in sorted(set(files) - {''}):
        relative = Path(name)
        if name in GENERATED_FILES or relative.parts[0] in GENERATED_ROOTS:
            continue
        path = root / relative
        if not path.exists() and not path.is_symlink():
            continue
        content = os.readlink(path).encode() if path.is_symlink() else path.read_bytes()
        digest.update(name.encode() + b'\0' + hashlib.sha256(content).digest())
    return digest.hexdigest()


def prepare_release(root: Path = PROJECT_ROOT) -> dict:
    runtime = root / '.sites-runtime'
    runtime.mkdir(exist_ok=True)
    with (runtime / 'release.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        release = load_release_metadata(root)
        fingerprint = source_fingerprint(root)
        if release.get('releaseId') == fingerprint:
            return release
        current = version_tuple(release['version'])
        package = version_tuple(json.loads((root / 'package.json').read_text())['version'])
        following = package if package > current else (current[0], current[1], current[2] + 1)
        result = {
            'schemaVersion': 1,
            'version': '.'.join(map(str, following)),
            'buildNumber': release['buildNumber'] + 1,
            'releaseId': fingerprint,
            'builtAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        }
        target = root / RELEASE_PATH
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        temporary.replace(target)
        return result


def public_release(release: dict) -> dict:
    return {key: release[key] for key in ('version', 'buildNumber', 'releaseId', 'builtAt')}


def render_release_html(html: str, release: dict) -> str:
    payload = json.dumps(public_release(release), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    html = re.sub(r'(<span\b[^>]*\bid="settingsAppVersion">)[^<]*(</span>)', lambda m: m[1] + release['version'] + m[2], html)
    html = re.sub(r'(<span\b[^>]*\bid="settingsBuildNumber">)[^<]*(</span>)', lambda m: m[1] + str(release['buildNumber']) + m[2], html)
    html = re.sub(r'(<script\b[^>]*\bid="siteReleaseMetadata"[^>]*>)[\s\S]*?(</script>)', lambda m: m[1] + payload + m[2], html)
    if release['releaseId']:
        tag = release['releaseId'][:16]
        html = re.sub(r'((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^\"]*)?"', lambda m: m[1] + '?v=' + tag + '"', html)
    return html


if __name__ == '__main__':
    print(json.dumps(prepare_release(), ensure_ascii=False))
