#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { execSync } from "node:child_process";

/**
 * BURS max LOC standard.
 * Each rule matches a glob/path pattern and declares target + hard max.
 * Files matching an exempt pattern are skipped entirely.
 * Files matching no rule default to the generic fallback.
 */

type Rule = {
  id: string;
  match: (path: string) => boolean;
  target: [number, number];
  hardMax: number;
};

const EXEMPT = (path: string): boolean =>
  /^src\/i18n\/locales\//.test(path) ||
  /^src\/integrations\/supabase\/types\.ts$/.test(path) ||
  /\.generated\./.test(path) ||
  /^supabase\/migrations\//.test(path) ||
  /^public\//.test(path) ||
  /\.(json|md|sql|css|svg|png|jpg|jpeg|webp|ico)$/.test(path);

const RULES: Rule[] = [
  {
    id: "test",
    match: (p) => /\.test\.(ts|tsx)$/.test(p) || /__tests__\//.test(p),
    target: [100, 220],
    hardMax: 320,
  },
  {
    id: "edge-entry",
    match: (p) => /^supabase\/functions\/[^_/][^/]*\/index\.ts$/.test(p),
    target: [80, 160],
    hardMax: 220,
  },
  {
    id: "edge-shared",
    match: (p) => /^supabase\/functions\/(_shared|[^/]+)\/[^/]+\.ts$/.test(p),
    target: [100, 220],
    hardMax: 300,
  },
  {
    id: "page",
    match: (p) => /^src\/pages\//.test(p),
    target: [120, 220],
    hardMax: 300,
  },
  {
    id: "context",
    match: (p) => /^src\/contexts\//.test(p),
    target: [80, 180],
    hardMax: 220,
  },
  {
    id: "hook",
    match: (p) => /^src\/hooks\//.test(p) || /\/hooks\//.test(p),
    target: [50, 120],
    hardMax: 160,
  },
  {
    id: "component",
    match: (p) => /^src\/components\//.test(p),
    target: [60, 140],
    hardMax: 180,
  },
  {
    id: "lib-util",
    match: (p) => /^src\/lib\//.test(p) || /^src\/utils\//.test(p),
    target: [40, 120],
    hardMax: 180,
  },
  {
    id: "scripts",
    match: (p) => /^scripts\//.test(p),
    target: [40, 120],
    hardMax: 220,
  },
];

const FALLBACK: Rule = {
  id: "fallback",
  match: () => true,
  target: [40, 120],
  hardMax: 220,
};

function countLOC(path: string): number {
  try {
    const text = readFileSync(path, "utf8");
    return text.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

function listTrackedFiles(): string[] {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => /\.(ts|tsx|js|jsx)$/.test(p))
    .filter((p) => !EXEMPT(p));
}

function ruleFor(path: string): Rule {
  for (const r of RULES) if (r.match(path)) return r;
  return FALLBACK;
}

type Finding = {
  path: string;
  loc: number;
  rule: string;
  target: [number, number];
  hardMax: number;
  severity: "target" | "hardMax";
};

function scan(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const path of files) {
    try {
      const stat = statSync(path);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    const loc = countLOC(path);
    const rule = ruleFor(path);
    if (loc > rule.hardMax) {
      findings.push({
        path,
        loc,
        rule: rule.id,
        target: rule.target,
        hardMax: rule.hardMax,
        severity: "hardMax",
      });
    } else if (loc > rule.target[1]) {
      findings.push({
        path,
        loc,
        rule: rule.id,
        target: rule.target,
        hardMax: rule.hardMax,
        severity: "target",
      });
    }
  }
  return findings;
}

function main(): void {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const warnOnly = args.includes("--warn-only");
  const jsonOut = args.includes("--json");

  const all = listTrackedFiles();
  const files = args
    .filter((a) => !a.startsWith("--"))
    .map((a) => relative(process.cwd(), resolve(a)));
  const toScan = files.length > 0 ? files : all;

  const findings = scan(toScan);
  const hardMaxHits = findings.filter((f) => f.severity === "hardMax");

  if (jsonOut) {
    console.log(JSON.stringify({ findings, hardMaxHits }, null, 2));
  } else {
    if (findings.length === 0) {
      console.log("LOC check: clean.");
    } else {
      console.log(`LOC findings: ${findings.length} (hardMax: ${hardMaxHits.length})`);
      for (const f of findings.sort((a, b) => b.loc - a.loc)) {
        const tag = f.severity === "hardMax" ? "FAIL" : "WARN";
        console.log(
          `  ${tag} [${f.rule}] ${f.path} — ${f.loc} LOC (target ${f.target[1]}, max ${f.hardMax})`,
        );
      }
    }
  }

  if (warnOnly) {
    process.exit(0);
  }
  if (strict && findings.length > 0) {
    process.exit(1);
  }
  if (hardMaxHits.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
