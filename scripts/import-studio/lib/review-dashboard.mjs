import fs from 'node:fs/promises';
import path from 'node:path';

export function renderReviewDashboard(job) {
  const references = (job.references || []).map(renderReference).join('\n');
  const manifestSeed = buildManifestSeed(job);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HERENCIA90 Import Studio - ${escapeHtml(job.jobId)}</title>
  <style>
    :root { --ink:#101010; --muted:#6d6a62; --line:#dad6cd; --gold:#9d7a2d; --bg:#f7f5ef; --panel:#fff; --ok:#0f7a41; --bad:#a33a2b; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Arial,sans-serif; color:var(--ink); background:var(--bg); }
    header { padding:18px 22px; background:#111; color:#fff; display:flex; justify-content:space-between; gap:16px; align-items:center; }
    header h1 { margin:0; font-size:1.1rem; letter-spacing:.04em; }
    header p { margin:.25rem 0 0; color:#cfc8b8; }
    main { padding:22px; display:grid; gap:18px; }
    section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    h2 { margin:0 0 6px; font-size:1.05rem; }
    .meta { margin:0 0 14px; color:var(--muted); font-size:.9rem; line-height:1.45; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
    figure { margin:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:#fafafa; }
    img { width:100%; aspect-ratio:1/1; object-fit:contain; display:block; background:#f2f2f2; }
    figcaption { padding:8px; }
    .roles { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; }
    button { min-height:34px; border:1px solid #bbb; background:#fff; border-radius:6px; cursor:pointer; font-weight:700; }
    button.active { background:var(--gold); border-color:var(--gold); color:#fff; }
    button[data-role="rejected"].active { background:var(--bad); border-color:var(--bad); }
    button[data-role="front"].active, button[data-role="back"].active { background:var(--ok); border-color:var(--ok); }
    textarea { width:100%; min-height:260px; font-family:Consolas,monospace; font-size:.82rem; border:1px solid var(--line); border-radius:8px; padding:12px; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .toolbar button { padding:0 14px; }
    .hint { color:var(--muted); font-size:.86rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>HERENCIA90 Import Studio</h1>
      <p>Job ${escapeHtml(job.jobId)} - revision local, sin publicar</p>
    </div>
    <strong>${escapeHtml(String((job.references || []).length))} referencias</strong>
  </header>
  <main>
    ${references}
    <section>
      <h2>approval-manifest.json</h2>
      <p class="hint">Marca roles y copia este JSON a <code>approval-manifest.json</code> dentro del job para generar dry-run.</p>
      <div class="toolbar">
        <button type="button" id="refreshManifest">Actualizar manifiesto</button>
        <button type="button" id="downloadManifest">Descargar JSON</button>
      </div>
      <textarea id="approval-manifest">${escapeHtml(JSON.stringify(manifestSeed, null, 2))}</textarea>
    </section>
  </main>
  <script>
    const job = ${JSON.stringify(manifestSeed)};
    const selected = new Map(job.references.flatMap((reference) => reference.images.map((image) => [reference.slug + ':' + image.id, image.role])));

    document.querySelectorAll('[data-image-id]').forEach((figure) => {
      const slug = figure.closest('[data-reference-slug]').dataset.referenceSlug;
      const id = figure.dataset.imageId;
      figure.querySelectorAll('button[data-role]').forEach((button) => {
        const key = slug + ':' + id;
        if (selected.get(key) === button.dataset.role) button.classList.add('active');
        button.addEventListener('click', () => {
          selected.set(key, button.dataset.role);
          figure.querySelectorAll('button[data-role]').forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
          updateManifest();
        });
      });
    });

    document.getElementById('refreshManifest').addEventListener('click', updateManifest);
    document.getElementById('downloadManifest').addEventListener('click', () => {
      updateManifest();
      const blob = new Blob([document.getElementById('approval-manifest').value], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'approval-manifest.json';
      link.click();
      URL.revokeObjectURL(link.href);
    });

    function updateManifest() {
      const manifest = {
        jobId: job.jobId,
        references: job.references.map((reference) => ({
          slug: reference.slug,
          images: reference.images.map((image) => ({
            id: image.id,
            role: selected.get(reference.slug + ':' + image.id) || image.role,
            sourceUrl: image.sourceUrl,
            localPath: image.localPath || ''
          }))
        }))
      };
      document.getElementById('approval-manifest').value = JSON.stringify(manifest, null, 2);
    }
  </script>
</body>
</html>`;
}

export async function writeReviewDashboard(job, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderReviewDashboard(job), 'utf8');
}

function renderReference(reference) {
  const candidates = (reference.candidates || []).map((candidate) => `
    <figure data-image-id="${escapeHtml(candidate.id)}">
      <img src="${escapeHtml(candidate.url)}" alt="${escapeHtml(reference.title)} candidato ${escapeHtml(candidate.id)}">
      <figcaption>
        <div class="roles">
          <button type="button" data-role="front">Frente</button>
          <button type="button" data-role="back">Espalda</button>
          <button type="button" data-role="detail">Detalle</button>
          <button type="button" data-role="rejected">Rechazar</button>
        </div>
      </figcaption>
    </figure>`).join('\n');
  const warnings = (reference.draft?.warnings || []).map((warning) => escapeHtml(warning)).join(' | ');

  return `<section data-reference-slug="${escapeHtml(reference.slug)}">
    <h2>${escapeHtml(reference.title)}</h2>
    <p class="meta">${escapeHtml(reference.slug)}${warnings ? ` - ${warnings}` : ''}</p>
    <p class="meta">${escapeHtml(reference.draft?.description || '')}</p>
    <div class="grid">${candidates || '<p class="hint">Sin imagenes candidatas. Revisa la URL o agrega imagenes al CSV.</p>'}</div>
  </section>`;
}

function buildManifestSeed(job) {
  return {
    jobId: job.jobId,
    references: (job.references || []).map((reference) => ({
      slug: reference.slug,
      images: (reference.candidates || []).map((candidate, index) => ({
        id: candidate.id,
        role: index === 0 ? 'front' : 'detail',
        sourceUrl: candidate.sourceUrl || candidate.url || '',
        localPath: candidate.localPath || '',
      })),
    })),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
