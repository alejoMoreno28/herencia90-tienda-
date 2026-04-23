import test from 'node:test';
import assert from 'node:assert/strict';

import { APPROVED_REFERENCES } from '../scripts/data/preventa-approved-references.mjs';

test('approved references include the initial 70 preventa picks', () => {
  assert.equal(APPROVED_REFERENCES.length, 70);
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'real-madrid-2006-2007-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'river-plate-1986-local'));
});
