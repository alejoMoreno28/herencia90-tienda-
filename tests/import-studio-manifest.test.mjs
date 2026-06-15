import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApprovalSummary, validateApprovalManifest } from '../scripts/import-studio/lib/approval-manifest.mjs';

test('requires exactly one front image before publish', () => {
  const result = validateApprovalManifest({
    slug: 'inter-1997-local',
    images: [
      { id: '1', role: 'front', sourceUrl: 'https://x.test/1.webp' },
      { id: '2', role: 'detail', sourceUrl: 'https://x.test/2.webp' },
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects manifest without front image', () => {
  const result = validateApprovalManifest({
    slug: 'inter-1997-local',
    images: [{ id: '1', role: 'detail', sourceUrl: 'https://x.test/1.webp' }],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /front/);
});

test('builds approval summary counts', () => {
  const summary = buildApprovalSummary({
    slug: 'inter-1997-local',
    images: [
      { id: '1', role: 'front' },
      { id: '2', role: 'back' },
      { id: '3', role: 'detail' },
      { id: '4', role: 'rejected' },
    ],
  });

  assert.deepEqual(summary.roles, { front: 1, back: 1, detail: 1, rejected: 1 });
});
