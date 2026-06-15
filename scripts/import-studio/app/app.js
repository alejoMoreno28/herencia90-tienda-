const state = {
  job: null,
  approval: null,
  dryRun: null,
  config: null,
};

const els = {
  status: document.getElementById('system-status'),
  links: document.getElementById('links'),
  defaultPrice: document.getElementById('default-price'),
  createJob: document.getElementById('create-job'),
  emptyState: document.getElementById('empty-state'),
  jobShell: document.getElementById('job-shell'),
  jobTitle: document.getElementById('job-title'),
  references: document.getElementById('references'),
  manifest: document.getElementById('manifest-output'),
  summary: document.getElementById('summary-grid'),
  log: document.getElementById('log-output'),
  notice: document.getElementById('notice'),
  dryRun: document.getElementById('dry-run'),
  saveDraft: document.getElementById('save-draft'),
  publishNow: document.getElementById('publish-now'),
  confirmation: document.getElementById('confirmation'),
  removeBg: document.getElementById('remove-bg'),
};

init();

async function init() {
  bindEvents();
  await loadConfig();
}

function bindEvents() {
  els.createJob.addEventListener('click', createJob);
  els.dryRun.addEventListener('click', runDryRun);
  els.saveDraft.addEventListener('click', () => importCurrentJob(false));
  els.publishNow.addEventListener('click', () => importCurrentJob(true));
  els.manifest.addEventListener('input', () => {
    try {
      state.approval = JSON.parse(els.manifest.value);
      updateSummary();
    } catch {
      showNotice('El manifiesto tiene JSON invalido.', true);
    }
  });
}

async function loadConfig() {
  try {
    state.config = await api('/api/config');
    els.removeBg.checked = Boolean(state.config.backgroundRemovalReady);
    els.status.innerHTML = [
      pill(state.config.supabaseUrlReady, 'Supabase URL'),
      pill(state.config.supabaseServiceKeyReady, 'Service key'),
      pill(state.config.backgroundRemovalReady, 'BiRefNet local'),
    ].join('');
  } catch (error) {
    els.status.textContent = error.message;
  }
}

async function createJob() {
  setBusy(els.createJob, true, 'Analizando...');
  log('Extrayendo albumes de Yupoo...');
  try {
    const response = await api('/api/jobs', {
      method: 'POST',
      body: {
        links: els.links.value,
        defaultPrice: Number(els.defaultPrice.value || 120000),
      },
    });
    state.job = response.job;
    state.approval = buildApprovalFromJob(state.job);
    state.dryRun = null;
    renderJob();
    log(`Job creado: ${state.job.jobId}\nReferencias: ${state.job.references.length}`);
  } catch (error) {
    log(`Error: ${error.message}`);
  } finally {
    setBusy(els.createJob, false, 'Analizar referencias');
  }
}

function renderJob() {
  els.emptyState.classList.add('hidden');
  els.jobShell.classList.remove('hidden');
  els.jobTitle.textContent = state.job.jobId;
  els.references.innerHTML = state.job.references.map(renderReference).join('');
  els.references.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => setImageRole(button));
  });
  els.references.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', updateApprovalFromDom);
    input.addEventListener('change', updateApprovalFromDom);
  });
  writeManifest();
  updateSummary();
}

function renderReference(reference) {
  const fields = fieldsFor(reference);
  return `
    <article class="reference-card" data-reference="${esc(reference.slug)}">
      <div class="reference-header">
        <div>
          <p class="eyebrow">${esc(reference.slug)}</p>
          <h3>${esc(fields.equipo || reference.title)}</h3>
          <p class="provider-title">${esc(reference.providerTitle || 'Sin titulo de proveedor')}</p>
        </div>
        <span class="status-pill ${reference.candidates.length ? 'ok' : 'warn'}">${reference.candidates.length} fotos</span>
      </div>
      <div class="metadata-grid">
        ${inputField('Equipo', 'equipo', fields.equipo)}
        ${inputField('Temporada', 'temporada', fields.temporada)}
        ${selectField('Tipo', 'tipo', fields.tipo, ['retro', 'fan', 'player', 'manga-larga', 'portero', 'local', 'visitante', 'tercera'])}
        ${selectField('Categoria', 'categoria', fields.categoria, ['clubes', 'selecciones', 'ligas-nba', 'otros'])}
        ${inputField('Slug', 'slug', fields.slug, 'wide')}
        ${inputField('Precio', 'precio_aprox', fields.precio_aprox)}
        ${selectField('Decada', 'decada', fields.decada, ['', '70s', '80s', '90s', '2000s', '2010s', '2020s'])}
        ${textareaField('Descripcion', 'descripcion', fields.descripcion)}
      </div>
      <div class="image-grid">
        ${reference.candidates.map((image, index) => renderImage(reference.slug, image, index)).join('')}
      </div>
    </article>
  `;
}

function renderImage(slug, image, index) {
  const role = index === 0 ? 'front' : 'detail';
  return `
    <figure class="image-card" data-slug="${esc(slug)}" data-image="${esc(image.id)}">
      <img src="${esc(proxyImageUrl(image.url, image.providerPageUrl))}" alt="${esc(slug)} ${esc(image.id)}">
      <figcaption class="role-grid">
        ${roleButton('front', 'Frente', role)}
        ${roleButton('back', 'Espalda', role)}
        ${roleButton('detail', 'Detalle', role)}
        ${roleButton('rejected', 'Rechazar', role)}
      </figcaption>
    </figure>
  `;
}

function roleButton(role, label, activeRole) {
  return `<button class="role-button ${role === activeRole ? 'active' : ''}" type="button" data-role="${role}">${label}</button>`;
}

function inputField(label, field, value, className = '') {
  return `
    <label class="field ${className}">
      <span>${label}</span>
      <input data-field="${field}" value="${esc(value || '')}">
    </label>
  `;
}

function textareaField(label, field, value) {
  return `
    <label class="field wide">
      <span>${label}</span>
      <textarea data-field="${field}">${esc(value || '')}</textarea>
    </label>
  `;
}

function selectField(label, field, value, options) {
  return `
    <label class="field">
      <span>${label}</span>
      <select data-field="${field}">
        ${options.map((option) => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(option || 'sin definir')}</option>`).join('')}
      </select>
    </label>
  `;
}

function setImageRole(button) {
  const card = button.closest('.image-card');
  card.querySelectorAll('[data-role]').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  updateApprovalFromDom();
}

function updateApprovalFromDom() {
  if (!state.job) return;
  state.approval = {
    jobId: state.job.jobId,
    references: state.job.references.map((reference) => {
      const card = els.references.querySelector(`[data-reference="${cssEscape(reference.slug)}"]`);
      return {
        slug: reference.slug,
        fields: readFields(card),
        images: reference.candidates.map((candidate) => {
          const imageCard = card.querySelector(`[data-image="${cssEscape(candidate.id)}"]`);
          return {
            id: candidate.id,
            role: imageCard.querySelector('.role-button.active')?.dataset.role || 'detail',
            sourceUrl: candidate.sourceUrl || candidate.url,
            localPath: '',
          };
        }),
      };
    }),
  };
  writeManifest();
  updateSummary();
}

function buildApprovalFromJob(job) {
  return {
    jobId: job.jobId,
    references: job.references.map((reference) => ({
      slug: reference.slug,
      fields: fieldsFor(reference),
      images: reference.candidates.map((candidate, index) => ({
        id: candidate.id,
        role: index === 0 ? 'front' : 'detail',
        sourceUrl: candidate.sourceUrl || candidate.url,
        localPath: '',
      })),
    })),
  };
}

function fieldsFor(reference) {
  const meta = reference.normalized?.preventa || {};
  return {
    slug: reference.slug,
    equipo: meta.equipo || reference.normalized?.teamName || '',
    temporada: meta.temporada || reference.normalized?.seasonLabel || '',
    tipo: meta.tipo || 'retro',
    categoria: meta.categoria || 'clubes',
    decada: meta.decada || '',
    precio_aprox: reference.normalized?.price || 120000,
    descripcion: reference.draft?.description || '',
    destacado: false,
  };
}

function readFields(card) {
  const fields = {};
  card.querySelectorAll('[data-field]').forEach((input) => {
    fields[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
  });
  fields.precio_aprox = Number(fields.precio_aprox || 0);
  return fields;
}

async function runDryRun(options = {}) {
  if (!state.job) return;
  updateApprovalFromDom();
  setBusy(els.dryRun, true, 'Generando...');
  log('Generando dry-run local...');
  try {
    const response = await api(`/api/jobs/${state.job.jobId}/dry-run`, {
      method: 'POST',
      body: { approval: state.approval },
    });
    state.approval = response.approval;
    state.dryRun = response.dryRun;
    writeManifest();
    updateSummary();
    log(JSON.stringify({
      references: state.dryRun.upserts.length,
      uploads: state.dryRun.uploads.length,
      warnings: state.dryRun.warnings,
      publicado: state.dryRun.upserts.every((item) => item.publicado === false) ? false : 'mixed',
    }, null, 2));
  } catch (error) {
    log(`Error dry-run: ${error.message}`);
    if (options.throwOnError) throw error;
  } finally {
    setBusy(els.dryRun, false, 'Dry-run');
  }
}

async function importCurrentJob(publicado) {
  if (!state.job) return;
  updateApprovalFromDom();
  const expected = publicado ? 'PUBLICAR' : 'IMPORTAR';
  if (els.confirmation.value.trim().toUpperCase() !== expected) {
    showNotice(`Escribe ${expected} para confirmar esta accion.`, true);
    return;
  }

  const button = publicado ? els.publishNow : els.saveDraft;
  setBusy(button, true, publicado ? 'Publicando...' : 'Importando...');
  log(publicado ? 'Publicando en Supabase...' : 'Importando como borrador en Supabase...');
  try {
    await runDryRun({ throwOnError: true });
    const response = await api(`/api/jobs/${state.job.jobId}/import`, {
      method: 'POST',
      body: {
        confirmation: expected,
        publicado,
        removeBackground: els.removeBg.checked,
      },
    });
    log(JSON.stringify(response.report, null, 2));
  } catch (error) {
    log(`Error importando: ${error.message}`);
  } finally {
    setBusy(button, false, publicado ? 'Publicar' : 'Importar borrador');
  }
}

function writeManifest() {
  els.manifest.value = JSON.stringify(state.approval || {}, null, 2);
}

function updateSummary() {
  const references = state.approval?.references || [];
  const images = references.flatMap((reference) => reference.images || []);
  const warnings = state.dryRun?.warnings?.length || 0;
  els.summary.innerHTML = `
    <div><strong>${references.length}</strong><span>Referencias</span></div>
    <div><strong>${images.filter((image) => image.role !== 'rejected').length}</strong><span>Imagenes</span></div>
    <div><strong>${warnings}</strong><span>Warnings</span></div>
  `;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function pill(ok, label) {
  return `<span class="status-pill ${ok ? 'ok' : 'warn'}">${label}: ${ok ? 'OK' : 'Falta'}</span>`;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function showNotice(message, isError = false) {
  els.notice.textContent = message;
  els.notice.style.borderColor = isError ? 'var(--red)' : 'var(--line)';
  els.notice.classList.add('active');
}

function log(message) {
  els.log.textContent = message;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function proxyImageUrl(value, referer) {
  return `/api/image-proxy?url=${encodeURIComponent(value || '')}&ref=${encodeURIComponent(referer || '')}`;
}
