import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

const RESULTS = resolve(import.meta.dirname, ".results/findings.json");

export interface Finding {
  area: string;
  check: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export function record(finding: Finding): void {
  mkdirSync(resolve(import.meta.dirname, ".results"), { recursive: true });
  const all: Finding[] = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, "utf8")) : [];
  const idx = all.findIndex((f) => f.area === finding.area && f.check === finding.check);
  if (idx >= 0) all[idx] = finding;
  else all.push(finding);
  writeFileSync(RESULTS, JSON.stringify(all, null, 2));
}

export function resetFindings(): void {
  mkdirSync(resolve(import.meta.dirname, ".results"), { recursive: true });
  writeFileSync(RESULTS, "[]");
}

/** A blank secure-context page with no network access needed. */
export async function blankPage(page: Page): Promise<void> {
  await page.route("https://agentable.test/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>conformance</title><main></main>" }));
  await page.goto("https://agentable.test/");
}

export const CORE_DIST = resolve(import.meta.dirname, "../packages/core/dist/index.js");
