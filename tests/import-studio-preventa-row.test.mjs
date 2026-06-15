import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApprovedJob, buildImportRows } from '../scripts/import-studio/lib/supabase-import.mjs';
import { buildPreventaCatalogRow } from '../scripts/import-studio/lib/preventa-row.mjs';

test('builds preventa catalog row with gallery and detail images', () => {
  const row = buildPreventaCatalogRow({
    jobId: 'job-row',
    slug: 'bayern-munich-2012-2013-local-retro',
    providerTitle: '2012-13拜仁主场',
    normalized: {
      providerUrl: 'https://huiliyuan.x.yupoo.com/albums/193589600',
      price: 120000,
      preventa: {
        equipo: 'Bayern Munich',
        temporada: '2012-2013',
        tipo: 'retro',
        categoria: 'clubes',
        decada: '2010s',
      },
    },
    draft: {
      description: 'Bayern Munich 2012-2013 local retro',
    },
  }, [
    { id: 'img-01', role: 'front', sourceUrl: 'https://img.test/front.jpeg', cardUrl: 'https://cdn.test/front-card.webp', cardPath: 'path/front-card.webp', masterUrl: 'https://cdn.test/front-1200.webp', masterPath: 'path/front-1200.webp' },
    { id: 'img-02', role: 'back', sourceUrl: 'https://img.test/back.jpeg', cardUrl: 'https://cdn.test/back-card.webp', cardPath: 'path/back-card.webp', masterUrl: 'https://cdn.test/back-1200.webp', masterPath: 'path/back-1200.webp' },
    { id: 'img-03', role: 'detail', sourceUrl: 'https://img.test/detail.jpeg', cardUrl: 'https://cdn.test/detail-card.webp', cardPath: 'path/detail-card.webp', masterUrl: 'https://cdn.test/detail-1200.webp', masterPath: 'path/detail-1200.webp' },
  ], {
    jobId: 'job-row',
    publicado: false,
    bucket: 'preventa-images',
    prefix: 'preventa-import/import-studio/job-row',
  });

  assert.equal(row.slug, 'bayern-munich-2012-2013-local-retro');
  assert.equal(row.equipo, 'Bayern Munich');
  assert.equal(row.tipo, 'retro');
  assert.equal(row.categoria, 'clubes');
  assert.equal(row.publicado, false);
  assert.equal(row.imagenes.length, 2);
  assert.equal(row.imagenes_detalle.length, 1);
  assert.equal(row.photo_count_gallery, 3);
  assert.equal(row.gallery_status.has_confirmed_back, true);
});

test('builds approved job and import rows from manifest field overrides', () => {
  const job = {
    jobId: 'job-approved',
    references: [{
      slug: 'initial-slug',
      title: 'Initial title',
      normalized: { providerUrl: 'https://supplier.test/album', price: 120000, preventa: {} },
      candidates: [
        { id: 'img-01', url: 'https://img.test/front.webp', sourceUrl: 'https://img.test/front.webp' },
        { id: 'img-02', url: 'https://img.test/detail.webp', sourceUrl: 'https://img.test/detail.webp' },
      ],
    }],
  };
  const approval = {
    jobId: 'job-approved',
    references: [{
      slug: 'initial-slug',
      fields: {
        slug: 'approved-slug',
        equipo: 'Inter de Milan',
        temporada: '1997-1998',
        tipo: 'retro',
        categoria: 'clubes',
        precio_aprox: 120000,
      },
      images: [
        { id: 'img-01', role: 'front', sourceUrl: 'https://img.test/front.webp' },
        { id: 'img-02', role: 'detail', sourceUrl: 'https://img.test/detail.webp' },
      ],
    }],
  };

  const approvedJob = buildApprovedJob(job, approval);
  const rows = buildImportRows(approvedJob, { jobId: 'job-approved', prefix: 'prefix', bucket: 'preventa-images' });

  assert.equal(approvedJob.references[0].validation.ok, true);
  assert.equal(rows[0].slug, 'approved-slug');
  assert.equal(rows[0].equipo, 'Inter de Milan');
  assert.equal(rows[0].imagenes.length, 1);
  assert.equal(rows[0].imagenes_detalle.length, 1);
  assert.deepEqual(rows[0].gallery_status.needs_review, ['no_confirmed_back']);
});
