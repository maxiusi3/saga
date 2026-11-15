"""Capture one uniquely named local command and its tested source graph."""
from pathlib import Path
import datetime
import gzip
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
base = root / 'docs/research/evidence/2026-11-06-g1-deletion-leases'
label, *command = sys.argv[1:]


def hashes():
    result = {}
    for folder in ['packages/web/src', 'packages/shared/src', 'packages/web/public/locales',
                   'scripts', 'supabase/migrations', 'experiments/pg17-deletion-leases']:
        for path in (root / folder).rglob('*'):
            if path.is_file() and path.suffix in ['.ts', '.tsx', '.js', '.cjs', '.mjs', '.sql', '.json']:
                result[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    for name in ['package.json', 'package-lock.json', 'eslint.config.cjs', 'packages/web/package.json',
                 'packages/web/tsconfig.json', 'packages/web/next.config.js', 'packages/web/jest.config.js']:
        result[name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
    return result


before = hashes()
record = {'command': command, 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'sourcesBefore': before}
log = base / f'{label}.log'
with log.open('xb') as handle:
    outcome = subprocess.run(command, cwd=root, stdout=handle, stderr=subprocess.STDOUT)
raw = log.read_bytes()
compressed = gzip.compress(raw)
with (base / f'{label}.log.gz').open('xb') as handle:
    handle.write(compressed)
log.unlink()
after = hashes()
record.update(exitCode=outcome.returncode, sourcesAfter=after,
              sourceDrift=[n for n in before.keys() | after.keys() if before.get(n) != after.get(n)],
              finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
              archive=f'{label}.log.gz', archiveSha256=hashlib.sha256(compressed).hexdigest(),
              rawSha256=hashlib.sha256(raw).hexdigest())
with (base / f'{label}.json').open('x') as handle:
    json.dump(record, handle, indent=2)
    handle.write('\n')
print(json.dumps({'label': label, 'exitCode': outcome.returncode, 'sourceDrift': record['sourceDrift']}))
print(raw.decode(errors='replace')[-2200:])
sys.exit(outcome.returncode)
