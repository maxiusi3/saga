"""Package this batch relative to its takeover files, preserving inherited edits."""
from pathlib import Path
import datetime
import difflib
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[3]
work = Path(__file__).resolve().parent
base = root / 'docs/research/evidence/2026-11-06-g1-deletion-leases'
baseline = json.loads((base / 'baseline.json').read_text())
label = sys.argv[1]
allowed = {
    'supabase/migrations/20261106000004_media_deletion_leases.sql',
    'scripts/__tests__/deployment-config.test.js',
    'packages/web/src/lib/server/media-deletion-lease.ts',
    'packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts',
    'docs/research/2026-11-06-g1-deletion-leases.md',
    'docs/superpowers/specs/2026-11-06-g1-deletion-leases-design.md',
    'docs/superpowers/plans/2026-11-06-upgrade-g1-deletion-leases.md',
    'docs/HANDOFF-2026-10-13-upgrade.md',
    'docs/README.md',
    'docs/research/2026-11-02-g1-gap-register.md',
}
allowed.update(str(p.relative_to(root)) for p in
               (root / 'experiments/pg17-deletion-leases').glob('*') if p.is_file())


def digest(data):
    return hashlib.sha256(data).hexdigest()


changed_inherited = [n for n, h in baseline['files'].items()
                     if not (root / n).is_file() or digest((root / n).read_bytes()) != h]
assert not set(changed_inherited) - allowed, set(changed_inherited) - allowed
patch = []
files = {}
for name in sorted(allowed):
    current = root / name
    assert current.is_file(), name
    before_path = work / 'before' / name
    before = before_path.read_bytes() if before_path.is_file() else b''
    after = current.read_bytes()
    if name in baseline['files']:
        assert digest(before) == baseline['files'][name], name
    files[name] = {'beforeSha256': digest(before) if before_path.is_file() else None,
                   'afterSha256': digest(after), 'changed': before != after}
    if before != after:
        patch.append('diff --git a/' + name + ' b/' + name + '\n')
        if not before_path.is_file():
            patch.append('new file mode 100644\n')
        patch.extend(difflib.unified_diff(before.decode().splitlines(keepends=True),
                                          after.decode().splitlines(keepends=True),
                                          fromfile='a/' + name if before_path.is_file() else '/dev/null',
                                          tofile='b/' + name, n=10))
patch_bytes = ''.join(patch).encode()
with (work / f'{label}.patch').open('xb') as f:
    f.write(patch_bytes)
record = {'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'baseline': str((base / 'baseline.json').relative_to(root)),
          'head': baseline['head'], 'files': files, 'patchSha256': digest(patch_bytes)}
with (work / f'{label}-hashes.json').open('x') as f:
    json.dump(record, f, indent=2)
    f.write('\n')
print(json.dumps({'files': len(files), 'changed': sum(v['changed'] for v in files.values()),
                  'patch': str((work / f'{label}.patch').relative_to(root)),
                  'patchSha256': record['patchSha256']}))
