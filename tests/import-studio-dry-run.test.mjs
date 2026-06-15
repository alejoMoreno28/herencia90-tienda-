import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSupabaseDryRun } from '../scripts/import-studio/lib/supabase-dry-run.mjs';

test('builds Supabase dry-run without upload side effects', () => {
  const dryRun = buildSupabaseDryRun({
    jobId: 'job-test',
    references: [
      {
        slug: 'inter-1997-local',
        title: 'Camiseta Inter 1997 Local',
        normalized: {
          price: 120000,
          seasonLabel: '1997/1998',
          shirtType: 'local',
          categoryPrimary: 'retro',
          providerUrl: 'https://supplier.test/inter',
        },
        approvedImages: [
          { id: '1', role: 'front', localPath: 'approved/front.webp', sourceUrl: 'https://img.test/1.webp' },
          { id: '2', role: 'detail', localPath: 'approved/detail.webp', sourceUrl: 'https://img.test/2.webp' },
        ],
      },
    ],
  });

  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(dryRun.uploads.length, 2);
  assert.equal(dryRun.upserts.length, 1);
  assert.equal(dryRun.upserts[0].slug, 'inter-1997-local');
  assert.equal(dryRun.upserts[0].publicado, false);
  assert.match(dryRun.uploads[0].storagePath, /import-studio\/job-test\/inter-1997-local/);
});
