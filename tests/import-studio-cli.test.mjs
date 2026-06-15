import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('import studio help prints available commands', () => {
  const result = spawnSync(process.execPath, ['scripts/import-studio/import-studio.mjs', '--help'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /HERENCIA90 Import Studio/);
  assert.match(result.stdout, /prepare/);
  assert.match(result.stdout, /dashboard/);
  assert.match(result.stdout, /dry-run/);
});
