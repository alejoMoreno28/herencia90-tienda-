# Preventa Yupoo Root Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover album URLs from the provider's Yupoo root catalog, match them against the approved 70 preventa references, and prepare an importable batch for the existing preventa pipeline.

**Architecture:** Add a small Yupoo catalog parser for root listing pages, store the approved references with searchable aliases, and create a discovery script that crawls the provider catalog, scores matches, and exports a reviewable batch file that can be fed into the existing import script.

**Tech Stack:** Node.js, existing Yupoo import module, Cheerio, Node test runner

---

### Task 1: Add approved reference source data

**Files:**
- Create: `scripts/data/preventa-approved-references.mjs`
- Test: `tests/preventa-approved-references.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_REFERENCES } from '../scripts/data/preventa-approved-references.mjs';

test('approved references include the initial 70 preventa picks', () => {
  assert.equal(APPROVED_REFERENCES.length, 70);
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'real-madrid-2006-2007-local'));
  assert.ok(APPROVED_REFERENCES.some((item) => item.slug === 'alemania-2025-2026-local'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/preventa-approved-references.test.mjs`
Expected: FAIL because `preventa-approved-references.mjs` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a module exporting the 70 approved references with fields:

```js
export const APPROVED_REFERENCES = [
  {
    slug: 'real-madrid-2006-2007-local',
    equipo: 'Real Madrid',
    temporada: '2006/2007',
    variante: 'local',
    categoria: 'clubes',
    tipo: 'retro',
    aliases: ['real madrid', '皇马', '2006-07', '2006/07']
  }
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/preventa-approved-references.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/preventa-approved-references.test.mjs scripts/data/preventa-approved-references.mjs
git commit -m "feat: add approved preventa reference seed data"
```

### Task 2: Add Yupoo root catalog parser

**Files:**
- Create: `scripts/lib/yupoo-catalog.mjs`
- Test: `tests/yupoo-catalog.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYupooAlbumList } from '../scripts/lib/yupoo-catalog.mjs';

test('parseYupooAlbumList extracts album titles and urls from a root catalog page', () => {
  const html = `
    <a href="/albums/123?uid=1"> 9 2006-07皇马主场 </a>
    <a href="/albums/456?uid=1"> 10 2008-09巴塞主场 </a>
  `;
  const items = parseYupooAlbumList(html, 'https://huiliyuan.x.yupoo.com/albums/?page=1');
  assert.deepEqual(items, [
    { title: '9 2006-07皇马主场', url: 'https://huiliyuan.x.yupoo.com/albums/123?uid=1' },
    { title: '10 2008-09巴塞主场', url: 'https://huiliyuan.x.yupoo.com/albums/456?uid=1' }
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/yupoo-catalog.test.mjs`
Expected: FAIL because `yupoo-catalog.mjs` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

```js
export function parseYupooAlbumList(html, pageUrl) {
  // return unique album anchors for /albums/<id> links
}
```

Also include small helpers for normalized title scoring and page URL building.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/yupoo-catalog.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/yupoo-catalog.test.mjs scripts/lib/yupoo-catalog.mjs
git commit -m "feat: add yupoo root catalog parser"
```

### Task 3: Build provider discovery script

**Files:**
- Create: `scripts/pv-discover-provider-catalog.mjs`
- Modify: `package.json`
- Test: `tests/pv-discover-provider-catalog.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreApprovedMatches } from '../scripts/pv-discover-provider-catalog.mjs';

test('scoreApprovedMatches ranks likely approved references against provider albums', () => {
  const matches = scoreApprovedMatches(
    [{ title: '9 2006-07皇马主场', url: 'https://huiliyuan.x.yupoo.com/albums/1?uid=1' }],
    [{
      slug: 'real-madrid-2006-2007-local',
      equipo: 'Real Madrid',
      temporada: '2006/2007',
      variante: 'local',
      aliases: ['real madrid', '皇马', '2006-07']
    }]
  );

  assert.equal(matches[0].slug, 'real-madrid-2006-2007-local');
  assert.equal(matches[0].matches[0].url, 'https://huiliyuan.x.yupoo.com/albums/1?uid=1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pv-discover-provider-catalog.test.mjs`
Expected: FAIL because the discovery module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a script that:
- fetches Yupoo root catalog pages
- parses all album items
- scores them against `APPROVED_REFERENCES`
- writes a JSON review file to `docs/provider-catalog-matches-huiliyuan.json`
- optionally writes a lean import seed file with the top 1-3 candidate albums per approved reference

Expose:

```js
export function scoreApprovedMatches(albums, approvedReferences) {}
```

Add an npm script:

```json
"scripts": {
  "pv:discover:huiliyuan": "node scripts/pv-discover-provider-catalog.mjs https://huiliyuan.x.yupoo.com/"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pv-discover-provider-catalog.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/pv-discover-provider-catalog.test.mjs scripts/pv-discover-provider-catalog.mjs package.json
git commit -m "feat: add provider catalog discovery for preventa"
```

### Task 4: Verify the discovery flow end-to-end

**Files:**
- Modify: `docs/provider-catalog-matches-huiliyuan.json`
- Modify: `docs/DOCUMENTACION_PREVENTA.md`

- [ ] **Step 1: Run the discovery command**

Run: `node scripts/pv-discover-provider-catalog.mjs https://huiliyuan.x.yupoo.com/`
Expected: a review file listing the best album candidates for the 70 approved references.

- [ ] **Step 2: Review the match output**

Check that the output includes known references such as:

```text
real-madrid-2006-2007-local
barcelona-2008-2009-local
santos-2012-2013-local-neymar
alemania-2025-2026-local
```

- [ ] **Step 3: Document the operator flow**

Append a short section to `docs/DOCUMENTACION_PREVENTA.md` showing:
- how to run discovery from a Yupoo root URL
- where the output file lands
- how to use the matches to feed `scripts/pv-batch-import.mjs`

- [ ] **Step 4: Run verification**

Run: `node --test tests/*.test.mjs`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add docs/provider-catalog-matches-huiliyuan.json docs/DOCUMENTACION_PREVENTA.md
git commit -m "docs: add yupoo root discovery workflow"
```
