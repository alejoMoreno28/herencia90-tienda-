import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const securityPath = resolve(root, 'api', '_lib', 'admin-security.cjs');

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

test('valid bearer session returns the verified user and service client', async () => {
  const { authorizeAdminRequest } = loadSecurity();
  const serviceClient = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === 'valid-session' ? { id: 'admin-1' } : null },
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

test('private address detection covers local, private and metadata ranges', () => {
  const { isPrivateAddress } = loadSecurity();
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.2', '192.168.1.5', '169.254.169.254', '::1', 'fc00::1', 'fe80::1']) {
    assert.equal(isPrivateAddress(address), true, `${address} debe rechazarse`);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
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

  for (const endpoint of ['optimize-product', 'search-provider-images', 'preventa-yupoo-import']) {
    const calls = source.split(`/api/${endpoint}`).slice(1);
    assert.ok(calls.length > 0, `debe existir una llamada a ${endpoint}`);
    for (const call of calls) {
      assert.match(call.slice(0, 500), /buildAdminApiHeaders\(\)/, `${endpoint} debe enviar sesion`);
    }
  }
});
