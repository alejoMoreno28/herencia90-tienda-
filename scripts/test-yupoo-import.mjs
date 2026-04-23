/**
 * scripts/test-yupoo-import.mjs
 * Prueba el importador Yupoo localmente sin servidor HTTP.
 *
 * Uso:
 *   node scripts/test-yupoo-import.mjs <URL_ALBUM_YUPOO> [slug_hint] [max_imagenes]
 *
 * Ejemplos:
 *   node scripts/test-yupoo-import.mjs https://helen.x.yupoos.com/albums/12345678
 *   node scripts/test-yupoo-import.mjs https://helen.x.yupoos.com/albums/12345678 colombia-1990-local 3
 *
 * Requiere .env con:
 *   SUPABASE_URL=https://nlnrdtcgbdkzfzwnsffp.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role_key>
 *   ADMIN_TOKEN=herencia2026   (opcional)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));

// Cargar .env
const envPath = resolve(__dir, '..', '.env');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  console.log('✅  .env cargado');
} catch {
  console.warn('⚠️  No se encontró .env — verifica SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno');
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌  Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const [,, url, slugHint, maxStr] = process.argv;

if (!url) {
  console.error('\n❌  Uso: node scripts/test-yupoo-import.mjs <URL_ALBUM_YUPOO> [slug] [max_imagenes]');
  console.error('   Ejemplo: node scripts/test-yupoo-import.mjs https://helen.x.yupoos.com/albums/12345678 colombia-1990 3\n');
  process.exit(1);
}

const max = maxStr ? parseInt(maxStr, 10) : 3;
console.log(`\n🔍  Importando: ${url}`);
if (slugHint) console.log(`    slug_hint    : ${slugHint}`);
console.log(`    max_imagenes : ${max} (default 3 en modo test)\n`);

// Cargar el módulo CJS con require (compatible con ES module host)
const require = createRequire(import.meta.url);
const importerPath = resolve(__dir, '..', 'api', 'preventa-yupoo-import.js');
const { importFromYupoo } = require(importerPath);

try {
  const result = await importFromYupoo({ yupoo_album_url: url, slug_hint: slugHint, max_imagenes: max });
  console.log('\n✅  Importación exitosa\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Título detectado : ${result.titulo || '(sin título)'}`);
  console.log(`Imágenes subidas : ${result.imagenes.length}`);
  console.log(`Origen Yupoo     : ${result.yupoo_origen}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  result.imagenes.forEach((img, i) => console.log(`  [${i + 1}] ${img.url}`));
  console.log('\n📋  JSON completo:');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('\n❌  Error:', err.message);
  console.error('    Revisa la URL del álbum (debe ser /albums/<id>) y que el álbum sea público.\n');
  process.exit(1);
}
