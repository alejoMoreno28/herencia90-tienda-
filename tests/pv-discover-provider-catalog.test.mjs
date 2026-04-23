import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreApprovedMatches } from '../scripts/pv-discover-provider-catalog.mjs';

test('scoreApprovedMatches ranks likely approved references against provider albums', () => {
  const matches = scoreApprovedMatches(
    [{ title: '9 2006-07\u7687\u9a6c\u4e3b\u573a', url: 'https://huiliyuan.x.yupoo.com/albums/1?uid=1' }],
    [{
      slug: 'real-madrid-2006-2007-local',
      equipo: 'Real Madrid',
      temporada: '2006/2007',
      variante: 'local',
      teamAliases: ['real madrid', '\u7687\u9a6c'],
      seasonTokens: ['2006/2007', '2006-07'],
      variantAliases: ['local', '\u4e3b\u573a'],
      extraAliases: [],
      aliases: ['real madrid', '\u7687\u9a6c', '2006-07'],
      player: '',
    }]
  );

  assert.equal(matches[0].slug, 'real-madrid-2006-2007-local');
  assert.equal(matches[0].matches[0].url, 'https://huiliyuan.x.yupoo.com/albums/1?uid=1');
  assert.ok(matches[0].matches[0].score > 0);
});
