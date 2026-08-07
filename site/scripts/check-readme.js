#!/usr/bin/env node
/**
 * Validates that README.md still parses into clean model records.
 * Run with `npm run check` from site/, or in CI before building.
 *
 * Exits non-zero on: a malformed table row, a model with no name, a missing
 * table, or a restricted-table row that reads as permissive.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseReadme } from '../src/lib/parse-readme.js';

const path = fileURLToPath(new URL('../../README.md', import.meta.url));
const { models, warnings } = parseReadme(readFileSync(path, 'utf8'));

const main = models.filter((m) => m.table === 'main');
const restricted = models.filter((m) => m.table === 'restricted');

console.log(`README.md -> ${models.length} models (${main.length} shippable, ${restricted.length} restricted)`);

// Soft signals: not failures, but worth seeing when a row was added by hand.
const noParams = models.filter((m) => m.params.value === null);
if (noParams.length) {
  console.log(`\n  ${noParams.length} row(s) with no parseable parameter count (shown as "—"):`);
  for (const m of noParams) console.log(`    - ${m.name}: "${m.params.display.slice(0, 60)}"`);
}

const checkCell = models.filter((m) => m.license.label === 'Check cell');
if (checkCell.length) {
  console.log(`\n  ${checkCell.length} row(s) whose licence could not be classified:`);
  for (const m of checkCell) console.log(`    - ${m.name}: "${m.licenseRaw.slice(0, 60)}"`);
}

if (warnings.length) {
  console.error(`\nFAILED with ${warnings.length} error(s):`);
  for (const w of warnings) console.error('  ! ' + w);
  process.exit(1);
}

console.log('\nOK: all rows parsed cleanly.');
