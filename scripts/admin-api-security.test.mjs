import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const securityPath = resolve(root, 'api', '_lib', 'admin-security.cjs');
const storagePath = resolve(root, 'api', '_lib', 'storage-paths.cjs');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function loadSecurity() {
  assert.equal(existsSync(securityPath), true, 'admin-security.cjs debe existir');
  return require(securityPath);
}

test('admin security module exposes the shared request contract', () => {
  const security = loadSecurity();
  assert.equal(typeof security.authorizeAdminRequest, 'function');
  assert.equal(typeof security.validateExternalUrl, 'function');
  assert.equal(typeof security.applyAdminCors, 'function');
  assert.equal(typeof security.isPrivateAddress, 'function');
});
test('missing bearer session is rejected before creating a client', async () => {
  const { authorizeAdminRequest } = loadSecurity();
  let clientCreated = false;
  const result = await authorizeAdminRequest(
    { headers: {} },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'server-only' },
    () => {
      clientCreated = true;
      throw new Error('no debe crear el cliente');
    }
  );

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Sesion de admin requerida.'
  });
  assert.equal(clientCreated, false);
});

test('valid admin bearer session returns the verified user and service client', async () => {
  const { authorizeAdminRequest } = loadSecurity();
  const serviceClient = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === 'valid-session' ? { id: 'admin-1', app_metadata: { role: 'admin' } } : null },
        error: null
      })
    }
  };

  const result = await authorizeAdminRequest(
    { headers: { authorization: 'Bearer valid-session' } },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'server-only' },
    () => serviceClient
  );

  assert.equal(result.ok, true);
  assert.equal(result.user.id, 'admin-1');
  assert.equal(result.supabase, serviceClient);
});

test('authenticated users without an explicit admin grant receive 403', async () => {
  const { authorizeAdminRequest } = loadSecurity();
  const serviceClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'customer-1', email: 'cliente@example.com' } }, error: null })
    }
  };

  const result = await authorizeAdminRequest(
    { headers: { authorization: 'Bearer customer-session' } },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_KEY: 'server-only' },
    () => serviceClient
  );

  assert.deepEqual(result, { ok: false, status: 403, error: 'Permisos de administrador requeridos.' });
});

test('server-side id allowlist can grant an admin account without trusting user metadata', async () => {
  const { authorizeAdminRequest } = loadSecurity();
  const serviceClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'owner-1', user_metadata: { role: 'admin' } } }, error: null })
    }
  };

  const result = await authorizeAdminRequest(
    { headers: { authorization: 'Bearer owner-session' } },
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'server-only',
      ADMIN_USER_IDS: 'owner-1'
    },
    () => serviceClient
  );

  assert.equal(result.ok, true);
});

test('browser database access requires an app_metadata admin grant', () => {
  const { hasAdminDatabaseGrant } = loadSecurity();
  assert.equal(hasAdminDatabaseGrant({ app_metadata: { role: 'admin' } }), true);
  assert.equal(hasAdminDatabaseGrant({ app_metadata: { roles: ['editor', 'admin'] } }), true);
  assert.equal(hasAdminDatabaseGrant({ user_metadata: { role: 'admin' } }), false);
  assert.equal(hasAdminDatabaseGrant({ email: 'owner@example.com' }), false);

  const sessionEndpoint = read('api/admin-session.js');
  assert.match(sessionEndpoint, /hasAdminDatabaseGrant\(authorization\.user\)/);
});

test('external url validation rejects unsafe protocols, credentials and hosts', async () => {
  const { validateExternalUrl } = loadSecurity();
  const options = {
    allowedHosts: ['futboldeprimera.com.co'],
    lookup: async () => [{ address: '8.8.8.8', family: 4 }]
  };

  await assert.rejects(() => validateExternalUrl('http://futboldeprimera.com.co/producto/a', options));
  await assert.rejects(() => validateExternalUrl('https://user:pass@futboldeprimera.com.co/producto/a', options));
  await assert.rejects(() => validateExternalUrl('https://example.com/producto/a', options));
});

test('external url validation rejects private DNS results and accepts approved public hosts', async () => {
  const { validateExternalUrl } = loadSecurity();
  await assert.rejects(() => validateExternalUrl('https://futboldeprimera.com.co/producto/a', {
    allowedHosts: ['futboldeprimera.com.co'],
    lookup: async () => [{ address: '127.0.0.1', family: 4 }]
  }));

  const result = await validateExternalUrl('https://futboldeprimera.com.co/producto/a', {
    allowedHosts: ['futboldeprimera.com.co'],
    lookup: async () => [{ address: '8.8.8.8', family: 4 }]
  });
  assert.equal(result.href, 'https://futboldeprimera.com.co/producto/a');
});

test('private address detection covers local, private, transition and metadata ranges', () => {
  const { isPrivateAddress } = loadSecurity();
  for (const address of [
    '127.0.0.1', '10.1.2.3', '172.16.0.2', '192.168.1.5', '169.254.169.254',
    '::1', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:7f00:1', '::ffff:0a00:1',
    '64:ff9b::7f00:1', '2001:db8::1', '2002:7f00:1::', '3fff::1'
  ]) {
    assert.equal(isPrivateAddress(address), true, `${address} debe rechazarse`);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('external URL validation rejects unsafe IPv6 DNS answers before pinning', async () => {
  const { validateExternalUrl } = loadSecurity();
  for (const address of ['::ffff:7f00:1', '::ffff:0a00:1', '64:ff9b::7f00:1', 'ff02::1', '2002:7f00:1::']) {
    await assert.rejects(() => validateExternalUrl('https://futboldeprimera.com.co/producto/a', {
      allowedHosts: ['futboldeprimera.com.co'],
      lookup: async () => [{ address, family: 6 }]
    }), undefined, `${address} no debe llegar a createPinnedLookup`);
  }
});

test('admin CORS never emits a wildcard and allows known origins only', () => {
  const { applyAdminCors } = loadSecurity();
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };

  assert.equal(applyAdminCors({ headers: { origin: 'https://www.herencia90.shop' } }, response), true);
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://www.herencia90.shop');

  const rejectedHeaders = {};
  const rejectedResponse = { setHeader: (name, value) => { rejectedHeaders[name] = value; } };
  assert.equal(applyAdminCors({ headers: { origin: 'https://attacker.example' } }, rejectedResponse), false);
  assert.equal(rejectedHeaders['Access-Control-Allow-Origin'], undefined);
});

test('every expensive admin endpoint uses shared authentication without fallback credentials', () => {
  for (const path of [
    'api/admin-session.js',
    'api/search-provider-images.js',
    'api/optimize-product.js',
    'api/preventa-yupoo-import.js',
    'api/admin-upload-image.js'
  ]) {
    const source = read(path);
    assert.match(source, /authorizeAdminRequest/);
    assert.doesNotMatch(source, /process\.env\.ADMIN_TOKEN\s*\|\|/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin['"],\s*['"]\*/);
  }
});

test('admin frontend sends the live session to every protected endpoint', () => {
  const source = read('web/admin.html');
  assert.doesNotMatch(source, /['"]Authorization['"]\s*:\s*['"]Bearer\s+[^$]/);
  assert.match(source, /async function buildAdminApiHeaders\(/);
  assert.match(source, /\/api\/admin-session/);
  assert.match(source, /signOut\(\)/);

  for (const endpoint of ['optimize-product', 'search-provider-images', 'preventa-yupoo-import']) {
    const calls = source.split(`/api/${endpoint}`).slice(1);
    assert.ok(calls.length > 0, `debe existir una llamada a ${endpoint}`);
    for (const call of calls) {
      assert.match(call.slice(0, 500), /buildAdminApiHeaders\(\)/, `${endpoint} debe enviar sesion`);
    }
  }
});

test('RLS guidance matches every browser-compatible app_metadata grant', () => {
  const guidance = read('docs/SEGURIDAD-RLS.md');
  assert.match(guidance, /app_metadata[^\n]+role[^\n]+admin/i);
  assert.match(guidance, /app_metadata[^\n]+roles/i);
  assert.match(guidance, /allowlist[^\n]+no reemplaza/i);
});

test('storage uploads use server-owned non-overwriting object paths', () => {
  const { createStoragePrefix } = require(storagePath);
  const prefix = createStoragePrefix('admin', '../../Mi Producto/../foto.webp', () => Buffer.from('a1b2c3d4', 'hex'));
  assert.equal(prefix, 'admin/mi-producto-foto-webp-a1b2c3d4');

  for (const path of ['api/admin-upload-image.js', 'api/preventa-yupoo-import.js']) {
    const source = read(path);
    assert.match(source, /createStoragePrefix/);
    assert.doesNotMatch(source, /upsert:\s*true/);
    assert.match(source, /upsert:\s*false/);
  }

  const upload = read('api/admin-upload-image.js');
  assert.doesNotMatch(upload, /json\(\{\s*error:\s*uploadError\.message/);
});

test('provider downloads use DNS-pinned requests after URL validation', () => {
  const security = loadSecurity();
  assert.equal(typeof security.fetchExternalResource, 'function');
  assert.equal(typeof security.createPinnedLookup, 'function');

  const lookup = security.createPinnedLookup([{ address: '8.8.8.8', family: 4 }]);
  lookup('provider.example', { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
  });

  for (const path of ['api/search-provider-images.js', 'api/preventa-yupoo-import.js']) {
    const source = read(path);
    assert.match(source, /fetchExternalResource/);
    assert.doesNotMatch(source, /fetch\(validatedUrl/);
  }

  const source = read('api/_lib/admin-security.cjs');
  assert.match(source, /response\.on\(['"]error['"],\s*reject\)/);
  assert.match(source, /response\.on\(['"]aborted['"],/);
});
