'use strict';

const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');

const DEFAULT_ADMIN_ORIGINS = new Set([
  'https://herencia90.shop',
  'https://www.herencia90.shop',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173'
]);

function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : '';
}

function parseAllowlist(value, normalize = (entry) => entry) {
  return new Set(String(value || '')
    .split(',')
    .map((entry) => normalize(entry.trim()))
    .filter(Boolean));
}

function hasAdminDatabaseGrant(user) {
  const role = String(user?.app_metadata?.role || '').trim().toLowerCase();
  const roles = Array.isArray(user?.app_metadata?.roles)
    ? user.app_metadata.roles.map((entry) => String(entry).trim().toLowerCase())
    : [];
  return role === 'admin' || roles.includes('admin');
}

function isAdminUser(user, env = process.env) {
  if (hasAdminDatabaseGrant(user)) return true;

  const allowedIds = parseAllowlist(env.ADMIN_USER_IDS);
  if (allowedIds.has(String(user?.id || '').trim())) return true;

  const allowedEmails = parseAllowlist(env.ADMIN_EMAILS, (entry) => entry.toLowerCase());
  return allowedEmails.has(String(user?.email || '').trim().toLowerCase());
}

async function authorizeAdminRequest(req, env = process.env, createClient) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Sesion de admin requerida.' };
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || typeof createClient !== 'function') {
    return { ok: false, status: 503, error: 'Servicio de autenticacion no configurado.' };
  }

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: 'Sesion invalida o expirada.' };
    }
    if (!isAdminUser(data.user, env)) {
      return { ok: false, status: 403, error: 'Permisos de administrador requeridos.' };
    }
    return { ok: true, user: data.user, supabase };
  } catch {
    return { ok: false, status: 503, error: 'No fue posible validar la sesion.' };
  }
}

function normalizeAllowedOrigins(value) {
  const origins = new Set(DEFAULT_ADMIN_ORIGINS);
  String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => origins.add(origin));
  return origins;
}

function applyAdminCors(req, res, env = process.env) {
  const origin = String(req?.headers?.origin || '').trim();
  const allowedOrigins = normalizeAllowedOrigins(env.ADMIN_ALLOWED_ORIGINS);
  const originAllowed = !origin || allowedOrigins.has(origin);

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  if (originAllowed && origin) res.setHeader('Access-Control-Allow-Origin', origin);
  return originAllowed;
}

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function parseIpv6Bytes(rawAddress) {
  let address = String(rawAddress || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!address) return null;

  if (address.includes('.')) {
    const separator = address.lastIndexOf(':');
    const ipv4 = address.slice(separator + 1);
    const octets = ipv4.split('.').map(Number);
    if (separator < 0 || octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return null;
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    address = `${address.slice(0, separator)}:${high}:${low}`;
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (value) => value
    ? value.split(':').map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN))
    : [];
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] || '');
  if ([...left, ...right].some(Number.isNaN)) return null;

  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill(0), ...right] : left;
  if (groups.length !== 8) return null;

  return Uint8Array.from(groups.flatMap((group) => [(group >> 8) & 0xff, group & 0xff]));
}

function matchesIpv6Prefix(address, prefix, bitLength) {
  const fullBytes = Math.floor(bitLength / 8);
  for (let index = 0; index < fullBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  const remainingBits = bitLength % 8;
  if (!remainingBits) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (address[fullBytes] & mask) === (prefix[fullBytes] & mask);
}

function isPublicIpv6(address) {
  const bytes = parseIpv6Bytes(address);
  if (!bytes) return false;

  // Only globally routable unicast space is accepted. This rejects mapped IPv4,
  // NAT64, loopback, link-local, unique-local and multicast addresses by default.
  if ((bytes[0] & 0xe0) !== 0x20) return false;

  const reservedPrefixes = [
    { bytes: [0x20, 0x01, 0x00], bits: 23 }, // IETF protocol assignments and transitions
    { bytes: [0x20, 0x01, 0x0d, 0xb8], bits: 32 }, // documentation
    { bytes: [0x20, 0x02], bits: 16 }, // 6to4 embeds an IPv4 destination
    { bytes: [0x3f, 0xff, 0x00], bits: 20 } // documentation
  ];
  return !reservedPrefixes.some((prefix) => matchesIpv6Prefix(bytes, prefix.bytes, prefix.bits));
}

function isPrivateAddress(rawAddress) {
  const address = String(rawAddress || '').trim().toLowerCase().split('%')[0];
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family !== 6) return true;
  return !isPublicIpv6(address);
}

function isAllowedHostname(hostname, allowedHosts, allowedSuffixes) {
  if (!allowedHosts.length && !allowedSuffixes.length) return true;
  if (allowedHosts.includes(hostname)) return true;
  return allowedSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

async function validateExternalUrl(rawUrl, options = {}) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    throw new Error('URL externa invalida.');
  }

  if (url.protocol !== 'https:') throw new Error('La URL externa debe usar HTTPS.');
  if (url.username || url.password) throw new Error('La URL externa no puede incluir credenciales.');
  if (url.port && url.port !== '443') throw new Error('La URL externa usa un puerto no permitido.');

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const allowedHosts = (options.allowedHosts || []).map((host) => String(host).toLowerCase());
  const allowedSuffixes = (options.allowedSuffixes || []).map((host) => String(host).toLowerCase());
  if (!isAllowedHostname(hostname, allowedHosts, allowedSuffixes)) {
    throw new Error('Proveedor externo no permitido.');
  }

  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error('La URL externa apunta a una red no permitida.');
  }

  const lookup = options.lookup || dns.lookup;
  let addresses;
  try {
    const result = await lookup(hostname, { all: true, verbatim: true });
    addresses = Array.isArray(result) ? result : [result];
  } catch {
    throw new Error('No fue posible resolver el proveedor externo.');
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('La URL externa apunta a una red no permitida.');
  }

  url.hostname = hostname;
  Object.defineProperty(url, 'validatedAddresses', {
    value: addresses.map(({ address, family }) => ({ address, family: Number(family) || net.isIP(address) })),
    enumerable: false
  });
  return url;
}

function createPinnedLookup(addresses) {
  const safeAddresses = (Array.isArray(addresses) ? addresses : [])
    .map(({ address, family }) => ({ address: String(address || ''), family: Number(family) || net.isIP(address) }))
    .filter(({ address, family }) => family && !isPrivateAddress(address));
  if (!safeAddresses.length) throw new Error('No hay direcciones externas validadas.');
  let cursor = 0;
  return (_hostname, options, callback) => {
    if (options && options.all) return callback(null, safeAddresses.map((entry) => ({ ...entry })));
    const entry = safeAddresses[cursor % safeAddresses.length];
    cursor += 1;
    return callback(null, entry.address, entry.family);
  };
}

async function fetchExternalResource(rawUrl, options = {}) {
  const validatedUrl = await validateExternalUrl(rawUrl, options);
  const maxBytes = Math.max(1, Number(options.maxBytes) || 12 * 1024 * 1024);
  const requestImpl = options.request || https.request;

  return new Promise((resolve, reject) => {
    const request = requestImpl(validatedUrl, {
      method: 'GET',
      headers: options.headers || {},
      lookup: createPinnedLookup(validatedUrl.validatedAddresses),
      servername: validatedUrl.hostname
    }, (response) => {
      const status = Number(response.statusCode) || 0;
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('La respuesta externa fue interrumpida.')));
      if (status >= 300 && status < 400) {
        response.resume();
        reject(new Error('Las redirecciones externas no estan permitidas.'));
        return;
      }

      const declaredBytes = Number(response.headers?.['content-length'] || 0);
      if (declaredBytes > maxBytes) {
        response.resume();
        reject(new Error('Recurso externo demasiado pesado.'));
        return;
      }

      const chunks = [];
      let received = 0;
      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          request.destroy(new Error('Recurso externo demasiado pesado.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers = {
          get(name) { return response.headers?.[String(name).toLowerCase()] || null; }
        };
        resolve({
          ok: status >= 200 && status < 300,
          status,
          headers,
          arrayBuffer: async () => body,
          text: async () => body.toString('utf8'),
          json: async () => JSON.parse(body.toString('utf8'))
        });
      });
    });
    request.setTimeout(Math.max(1000, Number(options.timeoutMs) || 15000), () => {
      request.destroy(new Error('Tiempo de espera externo agotado.'));
    });
    request.on('error', reject);
    request.end();
  });
}

function hasOversizedJsonBody(body, maxBytes = 32 * 1024) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > maxBytes;
  } catch {
    return true;
  }
}

module.exports = {
  applyAdminCors,
  authorizeAdminRequest,
  createPinnedLookup,
  fetchExternalResource,
  getBearerToken,
  hasAdminDatabaseGrant,
  hasOversizedJsonBody,
  isAdminUser,
  isPrivateAddress,
  validateExternalUrl
};
