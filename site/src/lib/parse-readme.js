/**
 * Parses README.md into structured model records at build time.
 *
 * README.md is the single source of truth. Contributors edit the markdown
 * tables and nothing else; this file derives every filter facet from them.
 *
 * Design rule: never guess. If a cell cannot be parsed confidently the facet
 * becomes "unknown" and the row still renders with its full prose intact.
 */

const MAIN_HEADING = 'Model Lists: shippable today';
const RESTRICTED_HEADING = 'Restricted-license models';

/** Split a markdown table row into trimmed cells. */
function splitRow(line) {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split('|').map((c) => c.trim());
}

function isSeparator(line) {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim()) && line.includes('-');
}

/** Collect every contiguous run of table lines, tagged with the heading above it. */
function findTables(markdown) {
  const lines = markdown.split('\n');
  const tables = [];
  let heading = '';
  let buffer = [];

  const flush = () => {
    if (buffer.length >= 3 && isSeparator(buffer[1])) {
      tables.push({
        heading,
        header: splitRow(buffer[0]),
        rows: buffer.slice(2).filter((l) => l.trim().startsWith('|')).map(splitRow),
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      buffer.push(line);
      continue;
    }
    flush();
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) heading = h[1].trim();
  }
  flush();
  return tables;
}

/**
 * `[label](url)` -> { label, url }. Returns the raw text when there is no link.
 * The url is scheme-checked and is null when unsafe, so callers render the name
 * without a link rather than emitting an untrusted href.
 */
function parseLink(cell) {
  const m = cell.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (m) return { label: m[1], url: safeUrl(m[2]) };
  return { label: stripMarkdown(cell), url: null };
}

/** Flatten markdown to readable text: links become their label, emphasis is dropped. */
export function stripMarkdown(s) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Scheme allowlist for link targets.
 *
 * This list takes community PRs, so a markdown link is untrusted input: a
 * contributor must not be able to land `[label](javascript:...)` and have it
 * execute for every visitor once merged. Anything not plainly http(s), mailto,
 * an anchor, or a relative path is refused. Protocol-relative `//host` is
 * refused too, so a link cannot silently point off-site.
 *
 * Returns null when the URL is not safe to emit, and callers render the label
 * as plain text instead of dropping the content.
 */
const SAFE_URL = /^(?:https?:\/\/|mailto:|#|\/(?!\/)|\.{1,2}\/)/i;

export function safeUrl(url) {
  if (typeof url !== 'string') return null;
  // Control characters and whitespace can smuggle a scheme past a naive check
  // (browsers strip them from URLs), so refuse them outright.
  const u = url.trim();
  if (!u || /[\u0000-\u0020\u007f]/.test(u)) return null;
  return SAFE_URL.test(u) ? u : null;
}

/**
 * Render a cell's markdown as safe HTML: links stay clickable, bold stays bold.
 *
 * Escaping happens first and the supported inline markup is re-introduced after,
 * so the only tags in the output are the ones produced here. Link targets are
 * additionally scheme-checked; escaping alone stops attribute breakout but not
 * a `javascript:` URI.
 */
export function cellHtml(s) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      const safe = safeUrl(url);
      return safe
        ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const UNKNOWN_PARAMS = /^(not published|under 1b|tens of)/i;

/**
 * Pull a parameter count out of a prose cell.
 *
 * Handles the shapes actually present in the table:
 *   "747,930,496 (safetensors.total)"      -> 747930496   exact
 *   "~9.0M (derived, ...)"                 -> 9000000     approx
 *   "0.45B diffusion transformer backbone" -> 450000000   approx
 *   "15M to 80M"                           -> 15000000    range
 *   "not published (87.4 MB ... near 22M)" -> null        unknown
 *
 * File sizes (MB / GB / MiB) are explicitly rejected so that a cell leading
 * with "not published (87.4 MB ...)" does not report 87.4M parameters.
 */
export function parseParams(raw) {
  const text = stripMarkdown(raw);
  const out = { value: null, display: text, exact: false, note: null };

  if (UNKNOWN_PARAMS.test(text)) {
    out.note = 'unknown';
    return out;
  }

  // Comma-grouped integers are exact counts straight from safetensors.total.
  const exact = text.match(/\b(\d{1,3}(?:,\d{3}){2,})\b/);
  if (exact) {
    out.value = Number(exact[1].replace(/,/g, ''));
    out.exact = true;
    return out;
  }

  // Scaled counts: 123M, 0.5B, ~9.0M. Reject byte units.
  const scaled = text.match(/(\d+(?:\.\d+)?)\s*(M|B)(?![Bi]|\w)/);
  if (scaled) {
    const n = parseFloat(scaled[1]);
    out.value = scaled[2] === 'B' ? n * 1e9 : n * 1e6;
    return out;
  }

  const plain = text.match(/^(\d{6,})\b/);
  if (plain) {
    out.value = Number(plain[1]);
    out.exact = true;
    return out;
  }

  out.note = 'unknown';
  return out;
}

/**
 * Licence patterns, scanned left to right. The README states the licence on the
 * WEIGHTS first and any code / codec / dependency licence after it, so the
 * earliest match in the cell is the one rule 3 asks us to report.
 *
 * Whole-cell matching does not work here: IndicF5 reads "MIT (HF card only; the
 * GitHub repo ships no LICENSE file)" and must classify as MIT, not as unstated.
 */
const LICENSE_PATTERNS = [
  [/none declared|noassertion|no license (?:key|grant|tag)|not stated|no rights granted/, 'unstated', 'No grant'],
  [/^none\b/, 'unstated', 'No grant'],
  [/non-?commercial|cc-?by-?nc|cc by-nc|nc-sa|noncommercial license/, 'noncommercial', 'Non-commercial'],
  [/coqui public model license|\bcpml\b/, 'noncommercial', 'Non-commercial'],
  [/lfm open license|neutts open license|revenue cap|annual revenue/, 'revenue-capped', 'Revenue-capped'],
  [/openrail|open rail/, 'use-restricted', 'OpenRAIL'],
  [/nvidia open model license/, 'use-restricted', 'NVIDIA OML'],
  [/agpl/, 'copyleft-network', 'AGPL'],
  [/\bgpl\b|gpl-3|gpl v3/, 'copyleft', 'GPL'],
  [/cc-?by-?sa/, 'copyleft', 'CC-BY-SA'],
  [/\bmpl\b|mozilla public/, 'weak-copyleft', 'MPL'],
  [/apache/, 'permissive', 'Apache 2.0'],
  [/\bmit\b/, 'permissive', 'MIT'],
  [/cc-?by-?4|cc by 4/, 'permissive', 'CC-BY-4.0'],
];

/** Statements that override position, because they disqualify an earlier mention. */
function licenseOverride(t) {
  // "Code Apache-2.0. Weights: no license key ..." leads with the code licence.
  if (/weights?\b[^.;]{0,60}\bno licen[cs]e/.test(t)) return { class: 'unstated', label: 'No grant' };
  if (/no licen[cs]e (?:grant(?:ed)?|stated)\b[^.]{0,30}(?:at all|anywhere|on the weights)/.test(t))
    return { class: 'unstated', label: 'No grant' };
  // "The declared MIT grant is invalid: derived from CC-BY-NC-SA-4.0 base weights"
  if (/invalid/.test(t) && /non-?commercial|cc-?by-?nc|nc-sa/.test(t))
    return { class: 'noncommercial', label: 'Non-commercial' };
  // "License unresolved upstream. Do not assert Apache 2.0 on the weights"
  if (/licen[cs]e unresolved|unresolved upstream|do not assert/.test(t))
    return { class: 'unstated', label: 'Unresolved' };
  return null;
}

/**
 * Bucket a model's licence.
 *
 * For restricted-table rows the Restriction column is authoritative: it is
 * written to state the restriction plainly, so it beats parsing the denser
 * Licence cell.
 */
export function parseLicense(raw, restriction) {
  const source = stripMarkdown(restriction || raw).toLowerCase();
  const licenseText = stripMarkdown(raw).toLowerCase();

  const override = licenseOverride(source) || licenseOverride(licenseText);
  if (override) return { ...override, caveat: true };

  const scan = (text) => {
    let best = null;
    for (const [re, cls, label] of LICENSE_PATTERNS) {
      const m = text.match(re);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, class: cls, label };
      }
    }
    return best;
  };

  // The Restriction column is authoritative when it names a licence, but it is
  // written as prose ("Copyleft, and commercial deployment needs ...") and does
  // not always contain a matchable token. Fall back to the Licence cell then.
  const best = scan(source) || scan(licenseText);

  if (!best) return { class: 'unstated', label: 'Check cell', caveat: true };

  // Flag rows where the primary grant is permissive but the cell also names a
  // stricter licence (a GPL dependency, a restricted codec) or undercuts itself
  // ("card only", "no LICENSE file", "contradict"). Rule 3 reports the weights
  // licence; this marker keeps the asterisk visible.
  const stricter =
    /gpl|non-?commercial|cc-?by-?nc|openrail|nvidia open model|revenue|nc-sa|\bmpl\b/.test(licenseText);
  const undercut = /card only|no licen[cs]e file|contradict|disputed|invalid|unresolved/.test(licenseText);
  const caveat =
    (best.class === 'permissive' && stricter) || undercut || Boolean(restriction && stricter && best.class === 'permissive');

  return { class: best.class, label: best.label, caveat };
}

export function parseCpu(raw) {
  const t = stripMarkdown(raw).toLowerCase();
  if (/^not published/.test(t)) return 'unknown';
  if (/^yes/.test(t)) return 'yes';
  if (/^borderline/.test(t)) return 'borderline';
  if (/^no\b/.test(t)) return 'no';
  if (/\byes\b/.test(t)) return 'yes';
  return 'unknown';
}

export function parseStreaming(raw) {
  const t = stripMarkdown(raw).toLowerCase();
  if (/^not published/.test(t)) return 'unknown';
  if (/dual/.test(t)) return 'dual';
  if (/no native streaming|no true incremental|^no\b/.test(t)) return 'none';
  if (/output-streaming/.test(t)) return 'output';
  if (/sentence-level/.test(t)) return 'sentence';
  if (/conversational/.test(t)) return 'other';
  return 'unknown';
}

/** A published latency figure is the single most decision-relevant fact for agents. */
export function hasTtfb(raw) {
  return !/^not published/i.test(stripMarkdown(raw));
}

const SIZE_BUCKETS = [
  { id: 'xs', label: 'Under 50M', test: (v) => v !== null && v < 50e6 },
  { id: 's', label: '50M to 200M', test: (v) => v !== null && v >= 50e6 && v < 200e6 },
  { id: 'm', label: '200M to 500M', test: (v) => v !== null && v >= 200e6 && v < 500e6 },
  { id: 'l', label: '500M to 1B', test: (v) => v !== null && v >= 500e6 },
  { id: 'unknown', label: 'Not published', test: (v) => v === null },
];

export function sizeBucket(value) {
  return (SIZE_BUCKETS.find((b) => b.test(value)) || { id: 'unknown' }).id;
}

export { SIZE_BUCKETS };

/** Turn one table row into a model record. */
function toModel(cells, header, table) {
  const col = (name) => {
    const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i === -1 ? '' : (cells[i] ?? '');
  };

  const link = parseLink(cells[0]);
  const params = parseParams(col('Params'));
  const license = parseLicense(col('License'), col('Restriction'));
  const integration = col('Integration path');

  const detail = header
    .map((h, i) => ({ label: h, raw: cells[i] ?? '' }))
    .filter((d) => d.label !== 'Model');

  return {
    name: link.label,
    url: link.url,
    table,
    restriction: col('Restriction') || null,
    params,
    sizeBucket: sizeBucket(params.value),
    license,
    licenseRaw: col('License'),
    languages: stripMarkdown(col('Languages')),
    streaming: parseStreaming(col('Streaming')),
    streamingRaw: col('Streaming'),
    ttfbRaw: col('TTFB / first-chunk'),
    hasTtfb: hasTtfb(col('TTFB / first-chunk')),
    cpu: parseCpu(col('CPU real-time')),
    cpuRaw: col('CPU real-time'),
    quantRaw: col('Quantized formats'),
    integrationRaw: integration,
    gated: /gated \(auto\)/i.test(integration),
    detail,
    // One flat string powering the search box.
    haystack: stripMarkdown(cells.join(' ')).toLowerCase(),
  };
}

/**
 * Parse the whole README. Returns models plus any warnings, so a malformed
 * contribution surfaces in the build log instead of silently vanishing.
 */
export function parseReadme(markdown) {
  const tables = findTables(markdown);
  const models = [];
  const warnings = [];

  for (const t of tables) {
    const isMain = t.heading.startsWith(MAIN_HEADING);
    const isRestricted = t.heading.startsWith(RESTRICTED_HEADING);
    if (!isMain && !isRestricted) continue;

    const kind = isMain ? 'main' : 'restricted';
    for (const cells of t.rows) {
      if (cells.length !== t.header.length) {
        warnings.push(
          `[${kind}] column count ${cells.length} != ${t.header.length}: ${cells[0]?.slice(0, 60)}`
        );
        continue;
      }
      const m = toModel(cells, t.header, kind);
      if (!m.name) {
        warnings.push(`[${kind}] row with no model name`);
        continue;
      }
      // Structural invariant: a row in the restricted table is restricted by
      // definition. If the prose parsed as permissive the classifier misread it,
      // so fail safe rather than advertise a licence the row does not have.
      if (kind === 'restricted' && m.license.class === 'permissive') {
        warnings.push(`[restricted] "${m.name}" parsed as permissive; forced to unstated. Check the Restriction cell.`);
        m.license = { class: 'unstated', label: 'Check cell', caveat: true };
      }
      models.push(m);
    }
  }

  if (!models.some((m) => m.table === 'main')) warnings.push('main table not found');
  if (!models.some((m) => m.table === 'restricted')) warnings.push('restricted table not found');

  models.sort((a, b) => {
    if (a.params.value === null) return 1;
    if (b.params.value === null) return -1;
    return a.params.value - b.params.value;
  });

  return { models, warnings };
}

/** Pull the two intro paragraphs so the site and README never drift. */
export function parseIntro(markdown) {
  const tagline = markdown.match(/\*\*(Every open-weight TTS model[^*]+)\*\*/);
  const lede = markdown
    .split('\n')
    .find((l) => l.startsWith('Small open TTS models have crossed a line'));
  return {
    tagline: tagline ? tagline[1].replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim() : '',
    lede: lede ? stripMarkdown(lede) : '',
  };
}
