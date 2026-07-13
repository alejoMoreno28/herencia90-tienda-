'use strict';

const { createClient } = require('@supabase/supabase-js');
const {
  normalizeTransactionEvent,
  validateEnvironment,
  verifyEventChecksum,
} = require('./_lib/wompi-security.cjs');

const MAX_EVENT_BYTES = 64 * 1024;

function parseBody(body) {
  if (typeof body === 'string') return JSON.parse(body);
  return body && typeof body === 'object' ? body : {};
}

async function handleWompiEvent(req, res, dependencies = {}) {
  const env = dependencies.env || process.env;
  const makeClient = dependencies.createClient || createClient;
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (env.WOMPI_ENABLED !== 'true') return res.status(503).json({ error: 'payments_disabled' });

  const config = validateEnvironment(env);
  if (!config.ok || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'payments_not_configured' });
  }

  let event;
  try {
    const rawSize = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');
    if (rawSize > MAX_EVENT_BYTES) return res.status(413).json({ error: 'payload_too_large' });
    event = parseBody(req.body);
  } catch (error) {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const providedChecksum = (req.headers && (req.headers['x-event-checksum'] || req.headers['X-Event-Checksum']))
    || (event.signature && event.signature.checksum);
  if (!verifyEventChecksum(event, env.WOMPI_EVENTS_SECRET, providedChecksum)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const expectedEventEnvironment = config.environment === 'production' ? 'prod' : 'test';
  if (event.environment !== expectedEventEnvironment) return res.status(400).json({ error: 'environment_mismatch' });

  const normalized = normalizeTransactionEvent(event);
  if (!normalized.ok) return res.status(400).json({ error: 'invalid_event' });
  const transaction = normalized.transaction;
  const eventKey = `${transaction.id}:${transaction.status}:${event.timestamp}`;

  const db = makeClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.rpc('h90_record_wompi_event', {
    p_event_key: eventKey,
    p_reference: transaction.reference,
    p_transaction_id: transaction.id,
    p_status: transaction.status,
    p_amount_in_cents: transaction.amountInCents,
    p_currency: transaction.currency,
    p_payload: event,
    p_checksum: String(providedChecksum).toLowerCase(),
  });
  if (error) {
    console.error('Wompi event persistence failed:', error.message);
    return res.status(500).json({ error: 'event_persistence_failed' });
  }
  return res.status(200).json({ received: true });
}

module.exports = async function wompiEventHandler(req, res) {
  return handleWompiEvent(req, res);
};
module.exports.handleWompiEvent = handleWompiEvent;
