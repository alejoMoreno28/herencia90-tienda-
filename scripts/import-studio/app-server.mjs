import fs from 'node:fs/promises';
import fssync from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { approvedImagesFor, readApprovalManifest, validateApprovalManifest, writeApprovalManifest } from './lib/approval-manifest.mjs';
import { buildProductDraft } from './lib/ai-product-draft.mjs';
import { rankCandidatesForReview } from './lib/image-rank.mjs';
import { buildNormalizedFromMetadata, inferPreventaMetadata, slugifyReference } from './lib/preventa-row.mjs';
import { extractProviderAlbum } from './lib/provider-extract.mjs';
import { buildSupabaseDryRun, writeSupabaseDryRun } from './lib/supabase-dry-run.mjs';
import { buildApprovedJob, executeSupabaseImport, loadEnvFile } from './lib/supabase-import.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const appDir = path.join(__dirname, 'app');
const jobsDir = path.join(root, '.codex_tmp', 'import-studio', 'jobs');
const DEFAULT_PORT = 4892;

loadEnvFile(path.join(root, '.env'));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.IMPORT_STUDIO_PORT || DEFAULT_PORT);
  await fs.mkdir(jobsDir, { recursive: true });

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message || 'Error interno.' });
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`HERENCIA90 Import Studio local: http://127.0.0.1:${port}`);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, getConfig());
    return;
  }

  if (url.pathname.startsWith('/api/image-proxy') && req.method === 'GET') {
    await proxyImage(url.searchParams.get('url'), res, url.searchParams.get('ref'));
    return;
  }

  if (url.pathname === '/api/jobs' && req.method === 'POST') {
    const body = await readBody(req);
    const job = await createJob(body);
    sendJson(res, 200, { job });
    return;
  }

  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)(?:\/([^/]+))?$/);
  if (jobMatch) {
    const jobId = safePathSegment(jobMatch[1]);
    const action = jobMatch[2] || '';

    if (!action && req.method === 'GET') {
      sendJson(res, 200, await readJobBundle(jobId));
      return;
    }

    if (action === 'dry-run' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await saveApprovalAndDryRun(jobId, body.approval || body);
      sendJson(res, 200, result);
      return;
    }

    if (action === 'import' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await importJob(jobId, body);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: 'Accion no encontrada.' });
    return;
  }

  await serveStatic(url.pathname, res);
}

function getConfig() {
  const pythonPath = process.env.IMPORT_STUDIO_PYTHON || path.join(root, '.codex_tmp', 'bg-local', 'venv', 'Scripts', 'python.exe');
  return {
    appVersion: 'import-studio-local-v2',
    supabaseUrlReady: Boolean(process.env.SUPABASE_URL),
    supabaseServiceKeyReady: Boolean(process.env.SUPABASE_SERVICE_KEY),
    supabaseUrlHost: maskSupabaseUrl(process.env.SUPABASE_URL),
    backgroundRemovalReady: fssync.existsSync(pythonPath),
    pythonPath,
    jobsDir,
  };
}

async function createJob(body) {
  const links = normalizeLinks(body.links || body.url || '');
  if (!links.length) throw new Error('Pega al menos un link de Yupoo.');

  const jobId = safePathSegment(body.jobId || `job-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const jobDir = path.join(jobsDir, jobId);
  const references = [];

  for (const link of links) {
    const album = await extractProviderAlbum(link);
    const metadata = inferPreventaMetadata({ title: album.title });
    const normalized = buildNormalizedFromMetadata(metadata, {
      providerUrl: link,
      price: Number(body.defaultPrice || 120000),
      notes: album.title ? `Titulo proveedor: ${album.title}` : '',
      sourceImages: album.imageUrls,
    });
    const slug = uniqueSlug(normalized.slug || slugifyReference(album.title), references);
    normalized.slug = slug;
    normalized.preventa = { ...(normalized.preventa || metadata), slug };
    const draft = buildProductDraft(normalized);
    const rankedCandidates = await rankCandidatesForReview(album.candidates, link, { limit: 16 });
    references.push({
      slug,
      title: draft.title,
      providerTitle: album.title,
      albumId: album.albumId,
      providerUsername: album.providerUsername,
      normalized,
      draft,
      candidates: rankedCandidates,
    });
  }

  const job = {
    jobId,
    generatedAt: new Date().toISOString(),
    source: 'local-app',
    references,
  };

  await writeJson(path.join(jobDir, 'job.json'), job);
  await writeJson(path.join(jobDir, 'approval-manifest.example.json'), buildExampleApproval(job));
  return job;
}

async function saveApprovalAndDryRun(jobId, approval) {
  const jobDir = path.join(jobsDir, jobId);
  const job = await readJson(path.join(jobDir, 'job.json'));
  const normalizedApproval = normalizeApproval(job, approval);
  await writeApprovalManifest(path.join(jobDir, 'approval-manifest.json'), normalizedApproval);

  const approvedJob = buildApprovedJob(job, normalizedApproval);
  const dryRunReport = buildSupabaseDryRun(approvedJob);
  const outputPath = path.join(jobDir, 'dry-run', 'supabase-dry-run.json');
  await writeSupabaseDryRun(outputPath, dryRunReport);

  return {
    approval: normalizedApproval,
    dryRun: dryRunReport,
    outputPath,
  };
}

async function importJob(jobId, body) {
  const confirmation = String(body.confirmation || '').trim().toUpperCase();
  const publish = Boolean(body.publicado);
  if (publish && confirmation !== 'PUBLICAR') {
    throw new Error('Para publicar directamente escribe PUBLICAR.');
  }
  if (!publish && confirmation !== 'IMPORTAR') {
    throw new Error('Para importar como borrador escribe IMPORTAR.');
  }

  const jobDir = path.join(jobsDir, jobId);
  const job = await readJson(path.join(jobDir, 'job.json'));
  const approvalPath = path.join(jobDir, 'approval-manifest.json');
  if (!fssync.existsSync(approvalPath)) {
    throw new Error('Primero genera el dry-run y guarda la aprobacion.');
  }

  const approval = await readApprovalManifest(approvalPath);
  const approvedJob = buildApprovedJob(job, approval);
  const result = await executeSupabaseImport(approvedJob, {
    root,
    jobDir,
    publicado: publish,
    removeBackground: Boolean(body.removeBackground),
    python: body.python || undefined,
  });

  return result;
}

async function readJobBundle(jobId) {
  const jobDir = path.join(jobsDir, jobId);
  const job = await readJson(path.join(jobDir, 'job.json'));
  const approvalPath = path.join(jobDir, 'approval-manifest.json');
  const dryRunPath = path.join(jobDir, 'dry-run', 'supabase-dry-run.json');
  const importPath = path.join(jobDir, 'import', 'supabase-import-report.json');
  return {
    job,
    approval: fssync.existsSync(approvalPath) ? await readJson(approvalPath) : null,
    dryRun: fssync.existsSync(dryRunPath) ? await readJson(dryRunPath) : null,
    importReport: fssync.existsSync(importPath) ? await readJson(importPath) : null,
  };
}

function normalizeApproval(job, approval) {
  const bySlug = new Map((approval.references || []).map((reference) => [reference.slug, reference]));
  return {
    jobId: job.jobId,
    references: (job.references || []).map((reference) => {
      const incoming = bySlug.get(reference.slug) || {};
      return {
        slug: reference.slug,
        fields: incoming.fields || {},
        images: (incoming.images || []).map((image) => ({
          id: image.id,
          role: image.role,
          sourceUrl: image.sourceUrl || '',
          localPath: image.localPath || '',
        })),
      };
    }),
  };
}

function buildExampleApproval(job) {
  return {
    jobId: job.jobId,
    references: (job.references || []).map((reference) => ({
      slug: reference.slug,
      fields: fieldsFromReference(reference),
      images: (reference.candidates || []).map((candidate, index) => ({
        id: candidate.id,
        role: index === 0 ? 'front' : 'detail',
        sourceUrl: candidate.sourceUrl || candidate.url || '',
        localPath: '',
      })),
    })),
  };
}

function fieldsFromReference(reference) {
  const preventa = reference.normalized?.preventa || {};
  return {
    slug: reference.slug,
    equipo: preventa.equipo || reference.normalized?.teamName || '',
    temporada: preventa.temporada || reference.normalized?.seasonLabel || '',
    tipo: preventa.tipo || 'retro',
    categoria: preventa.categoria || 'clubes',
    decada: preventa.decada || '',
    precio_aprox: reference.normalized?.price || 120000,
    descripcion: reference.draft?.description || '',
    destacado: false,
  };
}

async function serveStatic(pathname, res) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(appDir, requested));
  if (!filePath.startsWith(appDir)) {
    sendJson(res, 403, { error: 'Ruta no permitida.' });
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'Archivo no encontrado.' });
  }
}

async function proxyImage(rawUrl, res, referer) {
  let imageUrl;
  try {
    imageUrl = new URL(rawUrl || '');
  } catch {
    sendJson(res, 400, { error: 'URL de imagen invalida.' });
    return;
  }

  if (!['http:', 'https:'].includes(imageUrl.protocol)) {
    sendJson(res, 400, { error: 'Protocolo de imagen no permitido.' });
    return;
  }

  const response = await fetch(imageUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      Referer: referer || refererForImage(imageUrl),
    },
  });

  if (!response.ok) {
    sendJson(res, response.status, { error: `No se pudo cargar imagen: HTTP ${response.status}` });
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || 'image/jpeg',
    'Cache-Control': 'public, max-age=1800',
  });
  res.end(buffer);
}

function refererForImage(imageUrl) {
  if (/photo\.yupoo\.com$/i.test(imageUrl.hostname)) {
    const username = imageUrl.pathname.split('/').filter(Boolean)[0];
    if (username) return `https://${username}.x.yupoo.com/`;
  }
  return `${imageUrl.protocol}//${imageUrl.hostname}`;
}

function normalizeLinks(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueSlug(slug, references) {
  const used = new Set(references.map((reference) => reference.slug));
  if (!used.has(slug)) return slug;
  let counter = 2;
  while (used.has(`${slug}-${counter}`)) counter += 1;
  return `${slug}-${counter}`;
}

async function readBody(req) {
  let source = '';
  for await (const chunk of req) source += chunk.toString();
  if (!source.trim()) return {};
  return JSON.parse(source);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safePathSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'job';
}

function maskSupabaseUrl(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return 'configurada';
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

main().catch((error) => {
  console.error(`[import-studio-app] ${error.message}`);
  process.exitCode = 1;
});
