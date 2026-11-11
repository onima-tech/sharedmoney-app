import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectWebAuthShell } from "../utils/webAuthShell.ts";
import { injectWebProfileShell } from "../utils/webProfileShell.ts";

const distDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist/app",
);

function findExportedLogo(directory: string): string | null {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findExportedLogo(entryPath);
      if (nested) return nested;
      continue;
    }
    if (/^logo\.[a-f0-9]+\.png$/.test(entry.name)) {
      const relative = path.relative(distDir, entryPath).split(path.sep).join("/");
      return `/app/${relative}`;
    }
  }
  return null;
}

const htmlPath = path.join(distDir, "index.html");
const html = readFileSync(htmlPath, "utf8");
const logoSrc = findExportedLogo(distDir) ?? undefined;
writeFileSync(
  htmlPath,
  injectWebProfileShell(injectWebAuthShell(html, { logoSrc })),
);
console.log(
  `Injected /app login shell and profile hero into ${htmlPath}` +
    (logoSrc ? ` (mark ${logoSrc})` : " (inline mark)"),
);
