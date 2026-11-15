"""Freeze accepted local inputs and verify inherited work after the final gate."""
from pathlib import Path
import datetime
import gzip
import hashlib
import json
import subprocess
import sys
import tarfile

root = Path(__file__).resolve().parents[3]
work = Path(__file__).resolve().parent
base = root / 'docs/research/evidence/2026-11-06-g1-deletion-leases'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text())


def save(name, value):
    with (base / name).open('x') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


label, *native_paths = sys.argv[1:]
gate = load(base / f'{label}.json')
assert gate['exitCode'] == 0 and not gate['sourceDrift']
compressed = (base / gate['archive']).read_bytes()
assert hashlib.sha256(compressed).hexdigest() == gate['archiveSha256']
assert hashlib.sha256(gzip.decompress(compressed)).hexdigest() == gate['rawSha256']
sources = dict(gate['sourcesAfter'])
runs = []
for name in native_paths:
    result = load(root / name)
    assert result['status'] == 'passed', name
    assert all(s['status'] == 'passed' for s in result.get('scenarios', [])), name
    assert not result.get('sourceDrift', []), name
    for rel, expected in result['sources'].items():
        assert digest(root / rel) == expected, rel
        assert rel not in sources or sources[rel] == expected, rel
        sources[rel] = expected
    cleanup = result['cleanup']
    assert cleanup['clusterStopped'] and cleanup['tempDirectoryRemoved']
    assert cleanup['clientsRemaining'] == 0 and not cleanup['errors']
    if result.get('scratch'):
        assert not Path(result['scratch']).exists()
    runs.append({'path': name, 'sha256': digest(root / name),
                 'assertions': result.get('assertions'), 'scenarios': result.get('scenarios'),
                 'cleanup': cleanup})
changed_sources = load(work / 'final-source-hashes.json')
for rel, expected in changed_sources.items():
    assert rel not in sources or sources[rel] == expected, rel
    sources[rel] = expected
for rel, expected in sources.items():
    assert digest(root / rel) == expected, rel
baseline = load(base / 'baseline.json')
changed = [n for n, h in baseline['files'].items() if not (root / n).exists() or digest(root / n) != h]
unexpected = [n for n in changed if n not in changed_sources]
old_drift = [n for n, h in baseline['priorEvidence'].items() if not (root / n).exists() or digest(root / n) != h]
assert not unexpected and not old_drift, (unexpected, old_drift)
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
index = subprocess.check_output(['git', 'diff', '--cached', '--binary'], cwd=root, text=True)
assert head == baseline['head'] and index == baseline['index'] == ''
subprocess.run(['git', 'diff', '--check'], cwd=root, check=True)
archive = base / f'{label}-source.tar.gz'
with archive.open('xb') as raw:
    with tarfile.open(fileobj=raw, mode='w:gz') as tar:
        for rel in sorted(sources):
            tar.add(root / rel, arcname=rel, recursive=False)
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    assert len(members) == len(sources)
    for member in members:
        assert member.isfile()
        assert hashlib.sha256(tar.extractfile(member).read()).hexdigest() == sources[member.name]
save(f'{label}-source-lock.json', {'sources': sources, 'sourceCount': len(sources),
                                 'archive': archive.name, 'archiveSha256': digest(archive)})
save(f'{label}-integrity.json', {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'head': head, 'headUnchanged': True, 'indexUnchanged': True, 'stagedEmpty': True,
     'diffCheckPassed': True, 'measuredSources': len(sources), 'sourceDrift': [],
     'priorEvidenceFiles': len(baseline['priorEvidence']), 'priorEvidenceDrift': [],
     'takeoverFiles': len(baseline['files']), 'authorizedChanges': changed, 'unexpectedChanges': []})
save(f'{label}-native.json', {'runs': runs, 'sourceDrift': []})
print(json.dumps({'sources': len(sources), 'priorEvidenceUnchanged': len(baseline['priorEvidence']),
                  'takeoverFiles': len(baseline['files']), 'nativeRuns': len(runs), 'integrity': 'passed'}))
