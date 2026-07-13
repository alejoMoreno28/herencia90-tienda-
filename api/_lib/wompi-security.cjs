'use strict';

const crypto = require('crypto');

const FINAL_STATUSES = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function createIntegrityChecksum({ reference, amountInCents, currency = 'COP', expirationTime, integritySecret }) {
  const amount = Number(amountInCents);
  if (!String(reference || '').trim()) throw new Error('Wompi reference is required.');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Wompi amount must be a positive integer.');
  if (currency !== 'COP') throw new Error('Wompi currency must be COP.');
  if (!String(integritySecret || '').trim()) throw new Error('Wompi integrity secret is required.');
  const expiration = expirationTime ? String(expirationTime) : '';
  return sha256(`${reference}${amount}${currency}${expiration}${integritySecret}`);
}

function valueAtPath(root, path) {
  return String(path || '').split('.').reduce((value, key) => (
    value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
  ), root);
}

function createEventChecksum(event, eventsSecret) {
  const properties = event && event.signature && event.signature.properties;
  if (!Array.isArray(properties) || properties.length === 0) throw new Error('Wompi event signature properties are required.');
  if (!Number.isInteger(Number(event.timestamp))) throw new Error('Wompi event timestamp is invalid.');
  if (!String(eventsSecret || '').trim()) throw new Error('Wompi events secret is required.');
  const values = properties.map((property) => {
    const value = valueAtPath(event.data, property);
    if (value === undefined || value === null) throw new Error(`Wompi event property is missing: ${property}`);
    return String(value);
  });
  return sha256(`${values.join('')}${event.timestamp}${eventsSecret}`);
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || '').toLowerCase(), 'utf8');
  const rightBuffer = Buffer.from(String(right || '').toLowerCase(), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyEventChecksum(event, eventsSecret, providedChecksum) {
  if (!/^[a-f0-9]{64}$/i.test(String(providedChecksum || ''))) return false;
  try {
    return secureEqual(createEventChecksum(event, eventsSecret), providedChecksum);
  } catch (error) {
    return false;
  }
}

function validateEnvironment(env) {
  const environment = env && env.WOMPI_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const prefix = environment === 'production' ? 'prod' : 'test';
  const errors = [];
  if (!String(env && env.WOMPI_PUBLIC_KEY || '').startsWith(`pub_${prefix}_`)) errors.push('La llave publica no corresponde al ambiente Wompi.');
  if (!String(env && env.WOMPI_INTEGRITY_SECRET || '').startsWith(`${prefix}_integrity_`)) errors.push('El secreto de integridad no corresponde al ambiente Wompi.');
  if (!String(env && env.WOMPI_EVENTS_SECRET || '').startsWith(`${prefix}_events_`)) errors.push('El secreto de eventos no corresponde al ambiente Wompi.');
  return { ok: errors.length === 0, environment, errors };
}

function normalizeTransactionEvent(event) {
  if (!event || event.event !== 'transaction.updated') return { ok: false, error: 'Unsupported Wompi event.' };
  const transaction = event.data && event.data.transaction;
  if (!transaction || typeof transaction !== 'object') return { ok: false, error: 'Missing Wompi transaction.' };
  const normalized = {
    id: String(transaction.id || '').trim().slice(0, 255),
    reference: String(transaction.reference || '').trim().slice(0, 255),
    status: String(transaction.status || '').trim().toUpperCase(),
    amountInCents: Number(transaction.amount_in_cents),
    currency: String(transaction.currency || '').trim().toUpperCase(),
  };
  if (!normalized.id || !/^H90-[A-Z0-9_-]+$/i.test(normalized.reference)) return { ok: false, error: 'Invalid Wompi transaction identifiers.' };
  if (!FINAL_STATUSES.has(normalized.status)) return { ok: false, error: 'Invalid Wompi transaction status.' };
  if (!Number.isInteger(normalized.amountInCents) || normalized.amountInCents <= 0 || normalized.currency !== 'COP') {
    return { ok: false, error: 'Invalid Wompi transaction amount.' };
  }
  return { ok: true, transaction: normalized, error: '' };
}

module.exports = {
  FINAL_STATUSES,
  createEventChecksum,
  createIntegrityChecksum,
  normalizeTransactionEvent,
  secureEqual,
  validateEnvironment,
  verifyEventChecksum,
};
