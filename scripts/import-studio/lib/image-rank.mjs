import sharp from 'sharp';

export async function rankCandidatesForReview(candidates, providerUrl, options = {}) {
  const scored = [];
  const limit = Math.max(1, Number(options.limit || candidates.length));

  for (const [index, candidate] of candidates.entries()) {
    if (index >= limit) {
      scored.push({ ...candidate, originalIndex: index, fullShirtScore: 0 });
      continue;
    }

    try {
      const score = await scoreFullShirtCandidate(candidate.url || candidate.sourceUrl, providerUrl);
      scored.push({ ...candidate, originalIndex: index, fullShirtScore: score });
    } catch {
      scored.push({ ...candidate, originalIndex: index, fullShirtScore: 0 });
    }
  }

  const likelyFull = scored
    .filter((candidate) => candidate.fullShirtScore >= 0.85)
    .sort((a, b) => b.fullShirtScore - a.fullShirtScore)
    .slice(0, 2);

  const promoted = likelyFull.length >= 2
    ? likelyFull
    : scored.slice().sort((a, b) => b.fullShirtScore - a.fullShirtScore).slice(0, Math.min(2, scored.length));
  const promotedIds = new Set(promoted.map((candidate) => candidate.id));
  const rest = scored.filter((candidate) => !promotedIds.has(candidate.id)).sort((a, b) => a.originalIndex - b.originalIndex);

  return [...promoted, ...rest].map((candidate, index) => ({
    ...candidate,
    id: `img-${String(index + 1).padStart(2, '0')}`,
    originalId: candidate.id,
    rank: index + 1,
  }));
}

export async function scoreFullShirtCandidate(url, providerUrl) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      Referer: providerUrl || new URL(url).origin,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return scoreFullShirtBuffer(buffer);
}

export async function scoreFullShirtBuffer(buffer) {
  const { data, info } = await sharp(buffer, { limitInputPixels: false })
    .resize(80, 80, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let light = 0;
  let edgeLight = 0;
  let edgePixels = 0;
  let redDominant = 0;
  const total = info.width * info.height;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = ((y * info.width) + x) * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isLight = r > 205 && g > 205 && b > 205 && max - min < 45;
      const isRedDominant = r > 120 && r > g * 1.25 && r > b * 1.25;
      const isEdge = x < 8 || y < 8 || x >= info.width - 8 || y >= info.height - 8;

      if (isLight) light += 1;
      if (isRedDominant) redDominant += 1;
      if (isEdge) {
        edgePixels += 1;
        if (isLight) edgeLight += 1;
      }
    }
  }

  const lightRatio = light / total;
  const edgeLightRatio = edgePixels ? edgeLight / edgePixels : 0;
  const redRatio = redDominant / total;
  return Number((edgeLightRatio + lightRatio - (redRatio * 0.3)).toFixed(4));
}
