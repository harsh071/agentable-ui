// Type-check complete examples so the getting-started guides stay copyable.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../../../", import.meta.url);
const site = new URL("../", import.meta.url);
const examples = [];
for (const path of ["README.md", "packages/core/README.md", "packages/react/README.md", "packages/ui/README.md", "packages/genui/README.md", "packages/lang/README.md"]) {
  const markdown = readFileSync(new URL(path, root), "utf8");
  for (const match of markdown.matchAll(/```(tsx?|typescript)\n([\s\S]*?)\n```/g)) {
    const code = match[2];
    if (code.includes("export default") || ((path.includes("/core/") || path.includes("/lang/")) && code.startsWith("import "))) examples.push({ path, code, extension: match[1] === "tsx" ? "tsx" : "ts" });
  }
}
const source = ts.createSourceFile("docs-content.tsx", readFileSync(new URL("src/pages/docs-content.tsx", site), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const visit = (node) => {
  if (ts.isNoSubstitutionTemplateLiteral(node) && node.text.includes("export default function App()")) examples.push({ path: "Docs quick start", code: node.text, extension: "tsx" });
  ts.forEachChild(node, visit);
};
visit(source);
const folder = mkdtempSync(fileURLToPath(new URL(".docs-check-", site)));
try {
  const files = examples.map((example, index) => {
    const file = `${folder}/example-${index}.${example.extension}`;
    writeFileSync(file, example.code);
    return file;
  });
  const config = ts.readConfigFile(fileURLToPath(new URL("tsconfig.json", site)), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(site));
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  for (const diagnostic of diagnostics) {
    const index = diagnostic.file ? files.indexOf(diagnostic.file.fileName) : -1;
    const label = examples[index]?.path ?? "TypeScript configuration";
    console.error(`${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
  }
  if (diagnostics.length) process.exitCode = 1;
  else console.log(`${examples.length} complete documentation examples type-check.`);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
