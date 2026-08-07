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
import { parseReadme, cellHtml } from '../src/lib/parse-readme.js';

// Markdown in README.md is untrusted: this list takes community PRs, so a
// contributor could submit a link that executes for every visitor once merged.
// These run on every build so the escaping cannot silently regress.
const XSS_VECTORS = [
  '[x](" onmouseover="alert(1))',
  '[x](javascript:alert(1))',
  '[x](JaVaScRiPt:alert(1))',
  '[x](java\tscript:alert(1))',
  '[x]( javascript:alert(1))',
  '[x](data:text/html,payload)',
  '[x](vbscript:msgbox(1))',
  '[x](//evil.example.com)',
  "[x](' onfocus='alert(1))",
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[<img src=x onerror=alert(1)>](https://ok.example)',
];

const ALLOWED_TAGS = ['a', '/a', 'strong', '/strong', 'code', '/code'];
const SAFE_HREF = /^(https?:\/\/|mailto:|#|\/(?!\/)|\.{1,2}\/)/i;

const xssFailures = [];
for (const vector of XSS_VECTORS) {
  const html = cellHtml(vector);
  const tag = [...html.matchAll(/<\/?([a-zA-Z][^\s>]*)/g)]
    .map((m) => m[1].toLowerCase())
    .find((t) => !ALLOWED_TAGS.includes(t));
  const href = [...html.matchAll(/href="([^"]*)"/g)]
    .map((m) => m[1])
    .find((h) => !SAFE_HREF.test(h));
  if (tag) xssFailures.push(`${vector} -> emitted <${tag}>`);
  else if (href) xssFailures.push(`${vector} -> emitted href="${href}"`);
}

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

if (xssFailures.length) {
  console.error(`\nFAILED: ${xssFailures.length} XSS vector(s) not neutralised:`);
  for (const f of xssFailures) console.error('  ! ' + f);
  process.exit(1);
}

if (warnings.length) {
  console.error(`\nFAILED with ${warnings.length} error(s):`);
  for (const w of warnings) console.error('  ! ' + w);
  process.exit(1);
}

console.log(`\nOK: all rows parsed cleanly. ${XSS_VECTORS.length} XSS vectors neutralised.`);
