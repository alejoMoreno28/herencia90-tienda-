import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const security = require('../api/_lib/wompi-security.cjs');
const { handleWompiEvent } = require('../api/wompi-event.js');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
}

function validEnvironment() {
  return {
    WOMPI_ENABLED: 'true',
    WOMPI_ENVIRONMENT: 'sandbox',
    WOMPI_PUBLIC_KEY: 'pub_test_example',
    WOMPI_INTEGRITY_SECRET: 'test_integrity_example',
    WOMPI_EVENTS_SECRET: 'test_events_example',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_KEY: 'service-role-placeholder',
  };
}

function signedEvent() {
  const event = {
    event: 'transaction.updated',
    environment: 'test',
    timestamp: 1730000000,
    data: { transaction: { id: 'txn-123', reference: 'H90-ABC123', status: 'APPROVED', amount_in_cents: 11000000, currency: 'COP' } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  };
  event.signature.checksum = security.createEventChecksum(event, 'test_events_example');
  return event;
}

test('webhook is inert unless payments are explicitly enabled', async () => {
  const response = responseRecorder();
  let clientCreated = false;
  await handleWompiEvent({ method: 'POST', body: {} }, response, {
    env: { WOMPI_ENABLED: 'false' },
    createClient: () => { clientCreated = true; },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error, 'payments_disabled');
  assert.equal(clientCreated, false);
});

test('webhook rejects a forged checksum before database access', async () => {
  const response = responseRecorder();
  let clientCreated = false;
  await handleWompiEvent({ method: 'POST', body: signedEvent(), headers: { 'x-event-checksum': '0'.repeat(64) } }, response, {
    env: validEnvironment(),
    createClient: () => { clientCreated = true; },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'invalid_signature');
  assert.equal(clientCreated, false);
});

test('valid events are delegated to one idempotent database RPC', async () => {
  const event = signedEvent();
  const response = responseRecorder();
  let rpcCall = null;
  const createClient = () => ({
    rpc: async (name, payload) => {
      rpcCall = { name, payload };
      return { data: { applied: true }, error: null };
    },
  });

  await handleWompiEvent({ method: 'POST', body: event, headers: { 'x-event-checksum': event.signature.checksum } }, response, {
    env: validEnvironment(),
    createClient,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { received: true });
  assert.equal(rpcCall.name, 'h90_record_wompi_event');
  assert.equal(rpcCall.payload.p_reference, 'H90-ABC123');
  assert.equal(rpcCall.payload.p_amount_in_cents, 11000000);
  assert.doesNotMatch(JSON.stringify(response.body), /secret|service-role/i);
});
