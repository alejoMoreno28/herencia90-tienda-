import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wompi = require('../api/_lib/wompi-security.cjs');

test('integrity checksum matches the official Wompi example', () => {
  const checksum = wompi.createIntegrityChecksum({
    reference: 'sk8-438k4-xmxm392-sn2m',
    amountInCents: 2490000,
    currency: 'COP',
    integritySecret: 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
  });

  assert.equal(checksum, '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
});

test('event checksum follows the documented property order, timestamp, and event secret', () => {
  const event = {
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 } },
    timestamp: 1530291411,
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  };
  const secret = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';
  const checksum = wompi.createEventChecksum(event, secret);

  assert.equal(checksum, '5a18ec5e8fdb7df463e9f94774cba8f583ba21bd04a09ceff2ea68a4bc0aefbe');
  assert.equal(wompi.verifyEventChecksum(event, secret, checksum.toUpperCase()), true);
  assert.equal(wompi.verifyEventChecksum(event, secret, '0'.repeat(64)), false);
});

test('configuration cannot mix sandbox and production credentials', () => {
  assert.deepEqual(
    wompi.validateEnvironment({
      WOMPI_ENVIRONMENT: 'sandbox',
      WOMPI_PUBLIC_KEY: 'pub_test_example',
      WOMPI_INTEGRITY_SECRET: 'test_integrity_example',
      WOMPI_EVENTS_SECRET: 'test_events_example',
    }),
    { ok: true, environment: 'sandbox', errors: [] },
  );

  const mixed = wompi.validateEnvironment({
    WOMPI_ENVIRONMENT: 'production',
    WOMPI_PUBLIC_KEY: 'pub_test_example',
    WOMPI_INTEGRITY_SECRET: 'prod_integrity_example',
    WOMPI_EVENTS_SECRET: 'prod_events_example',
  });
  assert.equal(mixed.ok, false);
  assert.ok(mixed.errors.some((error) => /publica/i.test(error)));
});

test('transaction events are normalized without trusting arbitrary shapes', () => {
  const normalized = wompi.normalizeTransactionEvent({
    event: 'transaction.updated',
    timestamp: 1730000000,
    data: {
      transaction: {
        id: 'txn-123',
        reference: 'H90-ABC123',
        status: 'APPROVED',
        amount_in_cents: 11000000,
        currency: 'COP',
      },
    },
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.transaction.reference, 'H90-ABC123');
  assert.equal(normalized.transaction.status, 'APPROVED');

  assert.equal(wompi.normalizeTransactionEvent({ event: 'other.event' }).ok, false);
});
