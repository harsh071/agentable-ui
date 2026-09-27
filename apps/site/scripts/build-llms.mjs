// Writes public/llms-full.txt: public/llms.txt followed by every package README,
// so the plain-text reference for LLMs can't drift from the packages.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const site = new URL("../", import.meta.url);
const PACKAGES = ["core", "react", "ui", "genui", "devtools"];
const npm = (pkg) => `https://www.npmjs.com/package/@agentable-ui/${pkg}`;

const readme = (pkg) =>
  readFileSync(new URL(`packages/${pkg}/README.md`, root), "utf8")
    // Relative links between packages only work on GitHub; point them at npm.
    .replace(/\]\(\.\.\/(\w+)\)/g, (_, p) => `](${npm(p)})`)
    // Nest each README one level under "Package reference".
    .replace(/^(#{1,5}) /gm, "#$1 ")
    .trim();

const out = [
  readFileSync(new URL("public/llms.txt", site), "utf8").trim(),
  "# Package reference",
  ...PACKAGES.map(readme),
].join("\n\n");

writeFileSync(new URL("public/llms-full.txt", site), out + "\n");
console.log(`llms-full.txt: ${out.length} chars from llms.txt + ${PACKAGES.length} READMEs`);
