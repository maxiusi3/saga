// Diagnostic only: the same synthetic executable/stdio boundary as the test.
// No decoder source, external media, or remote calls are involved.
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { performance } = require('node:perf_hooks');

(async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'saga-decoder-startup-probe-'));
  try {
    const samples = [];
    for (let index = 0; index < 5; index++) {
      const executable = join(directory, `decoder-${index}`);
      await fs.writeFile(executable, `#!${process.execPath}\nprocess.stdout.write(Buffer.alloc(3200)); setInterval(() => {}, 1000)\n`, { mode: 0o700 });
      const started = performance.now();
      const sample = { index: index + 1 };
      await new Promise((resolve, reject) => {
        const child = spawn(executable, [], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        sample.spawnReturnedMs = performance.now() - started;
        let bytes = 0;
        const timer = setTimeout(() => { sample.deadlineExceeded = true; child.kill('SIGKILL'); }, 10000);
        child.once('spawn', () => { sample.spawnEventMs = performance.now() - started; });
        child.once('error', reject);
        child.stdout.once('data', chunk => {
          bytes += chunk.length;
          sample.firstPcmMs = performance.now() - started;
          child.kill('SIGKILL');
        });
        child.once('exit', () => { sample.exitMs = performance.now() - started; });
        child.once('close', () => {
          clearTimeout(timer);
          sample.closeMs = performance.now() - started;
          sample.pcmBytes = bytes;
          try { process.kill(child.pid, 0); sample.pidGone = false; }
          catch { sample.pidGone = true; }
          resolve();
        });
      });
      samples.push(sample);
    }
    const evidence = { schemaVersion: 1, nodeVersion: process.version, executable: process.execPath,
      scope: 'Five newly written synthetic Node executables; same fresh-file boundary as Jest fixture', samples };
    await fs.writeFile(join(__dirname, 'decoder-startup-fresh-measurements.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(evidence, null, 2));
    if (samples.some(sample => sample.deadlineExceeded || !sample.pidGone || sample.pcmBytes !== 3200)) process.exitCode = 1;
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
