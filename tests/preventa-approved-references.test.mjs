import test from 'node:test';
import assert from 'node:assert/strict';

import { APPROVED_REFERENCES } from '../scripts/data/preventa-approved-references.mjs';

test('approved references include the Colombia expansion for preventa', () => {
  assert.equal(APPROVED_REFERENCES.length, 90);
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'real-madrid-2006-2007-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'river-plate-1986-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2001-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2024-centenary-blanca'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-1990-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2014-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-edicion-classic-retro'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2024-visitante-azul'));
});
