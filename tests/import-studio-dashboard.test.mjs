import test from 'node:test';
import assert from 'node:assert/strict';

import { renderReviewDashboard } from '../scripts/import-studio/lib/review-dashboard.mjs';

test('renders review dashboard with candidate role controls', () => {
  const html = renderReviewDashboard({
    jobId: 'job-test',
    references: [
      {
        slug: 'inter-1997-local',
        title: 'Inter de Milan 1997 Local',
        draft: {
          description: 'Camiseta retro de Inter.',
          confidence: 0.71,
        },
        candidates: [
          { id: 'img-1', url: 'candidates/1.webp' },
          { id: 'img-2', url: 'candidates/2.webp' },
        ],
      },
    ],
  });

  assert.match(html, /Inter de Milan 1997 Local/);
  assert.match(html, /data-role="front"/);
  assert.match(html, /data-role="back"/);
  assert.match(html, /data-role="detail"/);
  assert.match(html, /data-role="rejected"/);
  assert.match(html, /approval-manifest/);
});
