import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const admin = await readFile(new URL('../web/admin.html', import.meta.url), 'utf8');

test('admin loads the isolated inventory editor before its inline controller', () => {
  assert.match(admin, /<script src="js\/admin-inventory-editor\.js[^>]*><\/script>/i);
  assert.match(admin, /window\.AdminInventoryEditor/);
  assert.doesNotMatch(admin, /googletagmanager\.com|gtag\('config'/i);
});

test('admin keeps a single inventory renderer and stock editor', () => {
  assert.equal((admin.match(/function renderInventory\s*\(/g) || []).length, 1);
  assert.equal((admin.match(/function uS\s*\(/g) || []).length, 1);
});

test('inventory saves only a validated dirty payload', () => {
  assert.match(admin, /buildSavePlan\(productData,\s*inventoryBaseline/);
  assert.match(admin, /\.upsert\(plan\.payload\)/);
  assert.doesNotMatch(admin, /\.upsert\(productData\)/);
  assert.match(admin, /beforeunload/);
  assert.match(admin, /actualizarBotonesInventario/);
});

test('reservation saves are targeted to one product', () => {
  assert.match(admin, /saveInventory\(true,\s*\[result\.productId\]\)/);
  assert.doesNotMatch(admin, /renderInventory\(\);\s*saveInventory\(\);/);
});

test('admin inline controllers remain valid JavaScript', () => {
  const inlineScripts = Array.from(admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);
  assert.ok(inlineScripts.length > 0);
  for (const source of inlineScripts) {
    assert.doesNotThrow(() => new Function(source));
  }
});
