/**
 * i18n enforcement test — prevents hardcoded user-facing strings from
 * sneaking back into components and pages.
 *
 * How it works:
 *   1. Globs all .tsx files under src/pages and src/components
 *   2. Strips imports, comments, classNames, data-testid, console.*, etc.
 *   3. Detects raw English strings (single/double/template) inside JSX
 *   4. Fails if any are found, listing file + line + string
 *
 * If you INTENTIONALLY need a hardcoded string (rare), add an inline
 * comment: // i18n-ignore
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..');

// ── Files / directories to skip ──────────────────────────────────────
const SKIP_PATHS = [
  '__tests__',
  '.test.',
  '.spec.',
  'test/',
  'locales/',
  'Insights.tsx', // frozen file
  // UI primitives (shadcn etc.) use displayName, not user-facing text
  `${path.sep}ui${path.sep}`,
  '/ui/',
  // Pre-existing files with hardcoded strings — TODO: migrate these next
  'insights/', // Insights subsystem (frozen page + related components)
  'landing/',
  'onboarding/',
  'travel/',
  'settings/CalendarSection',
  'settings/ProfileCard',
  // Pages not yet migrated — TODO: i18n pass 2
  'AddGarment.tsx',
  'AIChat.tsx',
  'EditGarment.tsx',
  'LiveScan.tsx',
  'MoodOutfit.tsx',
  'OutfitGenerate.tsx',
  'Pricing.tsx',
  'PublicProfile.tsx',
  'ShareOutfit.tsx',
  'TravelCapsule.tsx',
  'UnusedOutfits.tsx',
  'marketing/',
  'settings/GenerateImages',
  // Components not yet migrated
  'add-garment/UploadStep',
  'weather/',
];

// ── Patterns that are NOT user-facing strings ────────────────────────
const IGNORED_LINE_PATTERNS = [
  /^\s*\/\//, // single-line comment
  /^\s*\*/, // block comment line
  /^\s*import\s/, // import statement
  /^\s*export\s+(type|interface)\s/, // type exports
  /console\.(log|warn|error|info|debug)/, // console calls
  /className[=:]/, // className props
  /data-testid/, // test ids
  /aria-label=\{t\(/, // already i18n'd aria-labels
  /strokeWidth/, // SVG attribute
  /viewBox/, // SVG attribute
  /^\s*\/\*/, // block comment open
  /i18n-ignore/, // intentional skip marker
  /\.displayName\s*=/, // React displayName
  /event\.key\s*===?\s*'/, // keyboard event checks
  /e\.key\s*===?\s*'/, // keyboard event checks (short var)
  /key:\s*['"]/, // object key literals
  /logger\./, // logger calls
  /throw new/, // error constructors
  /\.style\./, // inline style assignments
  /objectPosition/, // CSS property
  /backgroundPosition/, // CSS property
];

// ── What counts as a suspicious hardcoded English string ─────────────
// Matches quoted strings that contain at least 2 English words
const HARDCODED_STRING_RE =
  /(?:>|=\s*|:\s*|return\s+)['"]([A-Z][a-z]{2,}\s[a-z].{1,})['"`]/;

// Template literal with English words in JSX context
const TEMPLATE_WITH_ENGLISH_RE =
  /[{>=]\s*`[^`]*[A-Z][a-z]{2,}\s+[a-z]{2,}[^`]*`/;

// JSX text content (children) — line that's mostly English text between tags
const JSX_TEXT_RE = />\s*([A-Z][a-z]{2,}[\s\w,.!?'-]{3,})\s*</;

// ── Values that are NOT user-facing ──────────────────────────────────
const IGNORED_VALUES = [
  /^(true|false|null|undefined|none|auto|flex|grid|block|inline|absolute|relative|fixed|sticky)$/i,
  /^[a-z]+[A-Z]/, // camelCase identifiers
  /^\//, // paths
  /^(https?:|mailto:)/, // URLs
  /^#[0-9a-f]/i, // hex colors
  /^\d/, // starts with number
  /^(left|right|top|bottom|center)\s+(left|right|top|bottom|center)$/i, // CSS position
  /className/, // className references
  /::/, // CSS pseudo-elements
  /border|bg-|text-|rounded|shadow|flex |items-|justify-|gap-|px-|py-|p-|m-|w-|h-/i, // Tailwind classes
];

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function shouldSkip(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SKIP_PATHS.some((p) => normalized.includes(p));
}

function isIgnoredLine(line: string): boolean {
  return IGNORED_LINE_PATTERNS.some((re) => re.test(line));
}

function isIgnoredValue(val: string): boolean {
  return IGNORED_VALUES.some((re) => re.test(val));
}

interface Violation {
  file: string;
  line: number;
  text: string;
  match: string;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Only scan the return/JSX portion — skip pure logic/types at top
  let inJsx = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heuristic: JSX starts at "return (" or "return <"
    if (/return\s*[(<]/.test(trimmed)) inJsx = true;
    // Also catch arrow components: ) => ( or ) => <
    if (/=>\s*[(<]/.test(trimmed)) inJsx = true;

    if (!inJsx) continue;
    if (isIgnoredLine(line)) continue;

    // Skip lines that already use t() or translateOrFallback()
    if (/\bt\(/.test(line) || /translateOrFallback/.test(line)) continue;
    // Skip lines that are only JSX tags/props with no text
    if (/^\s*<[A-Z]/.test(trimmed) && !/>.*[A-Za-z]{3,}.*</.test(trimmed)) continue;
    // Skip cn() calls and className ternaries
    if (/cn\(/.test(trimmed)) continue;

    let match: RegExpMatchArray | null;

    // Check for JSX text content between tags
    match = line.match(JSX_TEXT_RE);
    if (match && match[1].length > 3) {
      const val = match[1].trim();
      if (isIgnoredValue(val)) continue;
      violations.push({
        file: path.relative(SRC, filePath),
        line: i + 1,
        text: trimmed,
        match: val,
      });
      continue;
    }

    // Check for hardcoded string props
    match = line.match(HARDCODED_STRING_RE);
    if (match && match[1].length > 3) {
      const val = match[1];
      if (isIgnoredValue(val)) continue;

      violations.push({
        file: path.relative(SRC, filePath),
        line: i + 1,
        text: trimmed,
        match: val,
      });
      continue;
    }

    // Check for template literals with English
    match = line.match(TEMPLATE_WITH_ENGLISH_RE);
    if (match) {
      const val = match[0].trim();
      if (isIgnoredValue(val)) continue;
      violations.push({
        file: path.relative(SRC, filePath),
        line: i + 1,
        text: trimmed,
        match: val,
      });
    }
  }

  return violations;
}

describe('i18n enforcement', () => {
  it('no hardcoded English strings in pages/', () => {
    const files = getAllTsxFiles(path.join(SRC, 'pages')).filter((f) => !shouldSkip(f));
    const allViolations: Violation[] = [];

    for (const file of files) {
      allViolations.push(...scanFile(file));
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map((v) => `  ${v.file}:${v.line} → "${v.match}"`)
        .join('\n');
      expect.fail(
        `Found ${allViolations.length} hardcoded string(s) in pages/:\n${report}\n\n` +
        'Use t(\'key\') instead, or add // i18n-ignore if intentional.',
      );
    }
  });

  it('no hardcoded English strings in components/', () => {
    const files = getAllTsxFiles(path.join(SRC, 'components')).filter((f) => !shouldSkip(f));
    const allViolations: Violation[] = [];

    for (const file of files) {
      allViolations.push(...scanFile(file));
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map((v) => `  ${v.file}:${v.line} → "${v.match}"`)
        .join('\n');
      expect.fail(
        `Found ${allViolations.length} hardcoded string(s) in components/:\n${report}\n\n` +
        'Use t(\'key\') instead, or add // i18n-ignore if intentional.',
      );
    }
  });

  it('no Swedish or other non-English strings in the codebase', () => {
    const dirs = [path.join(SRC, 'pages'), path.join(SRC, 'components')];
    const violations: { file: string; line: number; text: string }[] = [];

    // Common Swedish words that should never appear as hardcoded strings
    // Note: 'till' is excluded because it's too common in English contexts
    const SWEDISH_WORDS = /\b(Testa|denna|klicka|Visa|Stäng|Spara|Ändra|Radera|Lägg till|Skapa|Välj)\b/;

    for (const dir of dirs) {
      const files = getAllTsxFiles(dir).filter((f) => !shouldSkip(f));
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*import/.test(line)) continue;
          if (/i18n-ignore/.test(line)) continue;
          const match = line.match(SWEDISH_WORDS);
          if (match) {
            // Ignore if inside t() or locale files
            if (/\bt\(/.test(line)) continue;
            violations.push({
              file: path.relative(SRC, file),
              line: i + 1,
              text: line.trim(),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} non-English string(s):\n${report}\n\n` +
        'All user-facing text must go through t().',
      );
    }
  });
});
