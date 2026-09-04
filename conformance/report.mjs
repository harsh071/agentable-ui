import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = new URL(".", import.meta.url).pathname;
const findingsPath = resolve(dir, ".results/findings.json");
if (!existsSync(findingsPath)) {
  console.error("No findings. Run `pnpm test:conformance` first.");
  process.exit(1);
}
const findings = JSON.parse(readFileSync(findingsPath, "utf8"));
const pw = existsSync(resolve(dir, ".results/playwright.json")) ? JSON.parse(readFileSync(resolve(dir, ".results/playwright.json"), "utf8")) : null;

const areas = [...new Set(findings.map((f) => f.area))];
const pass = findings.filter((f) => f.ok).length;
const lines = [];
lines.push("# WebMCP conformance report");
lines.push("");
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} against real Chrome with \`--enable-features=WebMCP\`. ${pass}/${findings.length} checks green.`);
lines.push("");
lines.push("Red rows are facts about the platform that differ from the documented spec, or library gates that failed. Every row is asserted in `conformance/tests`, never mocked.");
lines.push("");
for (const area of areas) {
  lines.push(`## ${area}`);
  lines.push("");
  lines.push("| | Check | Expected | Actual |");
  lines.push("|---|---|---|---|");
  for (const f of findings.filter((f) => f.area === area)) {
    const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${f.ok ? "🟢" : "🔴"} | ${esc(f.check)} | ${esc(f.expected)} | ${esc(f.actual)} |`);
  }
  lines.push("");
}
if (pw) {
  const specs = [];
  const walk = (s) => {
    for (const sp of s.specs ?? []) specs.push(sp);
    for (const c of s.suites ?? []) walk(c);
  };
  for (const s of pw.suites ?? []) walk(s);
  lines.push("## Playwright specs");
  lines.push("");
  for (const sp of specs) lines.push(`- ${sp.ok ? "🟢" : "🔴"} ${sp.title}`);
  lines.push("");
}
writeFileSync(resolve(dir, "REPORT.md"), lines.join("\n"));
console.log(`Wrote conformance/REPORT.md (${pass}/${findings.length} green).`);
if (pass !== findings.length) process.exit(1);
