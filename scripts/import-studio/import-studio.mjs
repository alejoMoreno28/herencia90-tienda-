import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { approvedImagesFor, readApprovalManifest, validateApprovalManifest } from './lib/approval-manifest.mjs';
import { buildProductDraft } from './lib/ai-product-draft.mjs';
import { normalizeImportRows, readInputRows } from './lib/intake.mjs';
import { candidatesFromSourceImages, extractProviderCandidates } from './lib/provider-extract.mjs';
import { writeReviewDashboard } from './lib/review-dashboard.mjs';
import { buildSupabaseDryRun, writeSupabaseDryRun } from './lib/supabase-dry-run.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const DEFAULT_JOBS_DIR = path.join(root, '.codex_tmp', 'import-studio', 'jobs');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (args.help || !command) {
    printHelp();
    return;
  }

  if (command === 'prepare') {
    await prepareJob(args);
    return;
  }

  if (command === 'dashboard') {
    await renderDashboard(args);
    return;
  }

  if (command === 'dry-run') {
    await dryRun(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function printHelp() {
  console.log(`HERENCIA90 Import Studio

Commands:
  prepare --input <csv-or-json> --job-id <id> [--skip-fetch]
  dashboard --job-id <id>
  dry-run --job-id <id> [--approval <path>]

Safety:
  This tool is local-first. It creates review and dry-run files only.
  It does not upload to Supabase and does not publish products.
`);
}

async function prepareJob(args) {
  const inputPath = requireArg(args, 'input');
  const jobId = args['job-id'] || timestampJobId();
  const jobDir = jobDirectory(args, jobId);
  const rawRows = await readInputRows(path.resolve(root, inputPath));
  const normalizedRows = normalizeImportRows(rawRows);
  const references = [];

  for (const normalized of normalizedRows) {
    const draft = buildProductDraft(normalized);
    const candidates = await candidatesFor(normalized, args);
    references.push({
      slug: normalized.slug,
      title: draft.title,
      normalized,
      draft,
      candidates,
    });
  }

  const job = {
    jobId,
    generatedAt: new Date().toISOString(),
    inputPath: path.relative(root, path.resolve(root, inputPath)).replaceAll('\\', '/'),
    references,
  };

  await writeJson(path.join(jobDir, 'job.json'), job);
  await writeReviewDashboard(job, path.join(jobDir, 'review', 'index.html'));
  await writeJson(path.join(jobDir, 'approval-manifest.example.json'), buildExampleApproval(job));

  console.log(`Import Studio job prepared: ${path.relative(root, jobDir)}`);
  console.log(`Review dashboard: ${path.relative(root, path.join(jobDir, 'review', 'index.html'))}`);
}

async function renderDashboard(args) {
  const jobId = requireArg(args, 'job-id');
  const jobDir = jobDirectory(args, jobId);
  const job = await readJson(path.join(jobDir, 'job.json'));
  const dashboardPath = path.join(jobDir, 'review', 'index.html');
  await writeReviewDashboard(job, dashboardPath);
  console.log(`Review dashboard written: ${path.relative(root, dashboardPath)}`);
}

async function dryRun(args) {
  const jobId = requireArg(args, 'job-id');
  const jobDir = jobDirectory(args, jobId);
  const job = await readJson(path.join(jobDir, 'job.json'));
  const approvalPath = args.approval ? path.resolve(root, args.approval) : path.join(jobDir, 'approval-manifest.json');

  if (!fssync.existsSync(approvalPath)) {
    throw new Error(`Approval manifest not found: ${approvalPath}`);
  }

  const approval = await readApprovalManifest(approvalPath);
  const approvalBySlug = new Map((approval.references || []).map((reference) => [reference.slug, reference]));
  const references = job.references.map((reference) => {
    const manifest = approvalBySlug.get(reference.slug) || { slug: reference.slug, images: [] };
    const validation = validateApprovalManifest(manifest);
    return {
      ...reference,
      validation,
      approvedImages: approvedImagesFor(reference, manifest),
    };
  });

  const dryRunReport = buildSupabaseDryRun({ ...job, references });
  const outputPath = path.join(jobDir, 'dry-run', 'supabase-dry-run.json');
  await writeSupabaseDryRun(outputPath, dryRunReport);

  console.log(`Dry-run written: ${path.relative(root, outputPath)}`);
  console.log(`References: ${dryRunReport.upserts.length}`);
  console.log(`Uploads planned: ${dryRunReport.uploads.length}`);
  console.log(`Warnings: ${dryRunReport.warnings.length}`);
}

async function candidatesFor(normalized, args) {
  if (normalized.sourceImages.length) {
    return candidatesFromSourceImages(normalized.sourceImages);
  }

  if (!normalized.providerUrl || flagEnabled(args, 'skip-fetch')) {
    return [];
  }

  try {
    return await extractProviderCandidates(normalized.providerUrl);
  } catch (error) {
    return [{
      id: 'fetch-error',
      url: '',
      sourceUrl: '',
      providerPageUrl: normalized.providerUrl,
      error: error.message,
    }];
  }
}

function buildExampleApproval(job) {
  return {
    jobId: job.jobId,
    references: job.references.map((reference) => ({
      slug: reference.slug,
      images: reference.candidates.map((candidate, index) => ({
        id: candidate.id,
        role: index === 0 ? 'front' : 'detail',
        sourceUrl: candidate.sourceUrl || candidate.url || '',
        localPath: candidate.localPath || '',
      })),
    })),
  };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function flagEnabled(args, key) {
  const value = args[key];
  if (value === true) return true;
  if (value === undefined) return false;
  return ['1', 'true', 'yes', 'si'].includes(String(value).toLowerCase());
}

function requireArg(args, key) {
  if (!args[key]) throw new Error(`Missing required --${key}`);
  return args[key];
}

function jobDirectory(args, jobId) {
  const jobsDir = args['jobs-dir'] ? path.resolve(root, args['jobs-dir']) : DEFAULT_JOBS_DIR;
  return path.join(jobsDir, safePathSegment(jobId));
}

function safePathSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'job';
}

function timestampJobId() {
  return `job-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
