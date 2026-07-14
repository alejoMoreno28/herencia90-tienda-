'use strict';

const crypto = require('node:crypto');

function safeSegment(value, fallback) {
  const segment = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return segment || fallback;
}

function createStoragePrefix(namespace, hint, randomBytes = crypto.randomBytes) {
  const safeNamespace = safeSegment(namespace, 'uploads');
  const safeHint = safeSegment(hint, 'image');
  const nonce = randomBytes(8).toString('hex');
  return `${safeNamespace}/${safeHint}-${nonce}`;
}

module.exports = { createStoragePrefix, safeSegment };
