import test from 'node:test';
import assert from 'node:assert/strict';

import { APPROVED_REFERENCES } from '../scripts/data/preventa-approved-references.mjs';

test('approved references include the Colombia and Barcelona expansion for preventa', () => {
  assert.equal(APPROVED_REFERENCES.length, 101);
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'real-madrid-2006-2007-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'river-plate-1986-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2001-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2024-centenary-blanca'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-1990-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2014-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-edicion-classic-retro'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2024-visitante-azul'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2025-2026-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'colombia-2024-2025-100-aniversario-negra'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-125-aniversario'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2024-2025-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2024-2025-visitante-player'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2024-2025-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-1999-2000-local-centenario'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2008-2009-local-manga-larga'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2010-2011-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-2001-2003-visitante'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'barcelona-1998-1999-local'));
});
