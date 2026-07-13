'use strict';

const dns = require('node:dns').promises;
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

function isPrivateAddress(rawAddress) {
  const address = String(rawAddress || '').trim().toLowerCase().split('%')[0];
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family !== 6) return true;

  const mappedIpv4 = address.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4[1]);
  return (
    address === '::' ||
    address === '::1' ||
    /^f[cd]/.test(address) ||
    /^fe[89ab]/.test(address) ||
    address.startsWith('2001:db8:')
  );
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
  return url;
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
  getBearerToken,
  hasOversizedJsonBody,
  isPrivateAddress,
  validateExternalUrl
};
