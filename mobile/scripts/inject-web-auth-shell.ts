import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectWebAuthShell } from "../utils/webAuthShell.ts";
import {
  assertJoinShellDocument,
  injectWebJoinShell,
  WEB_JOIN_SHELL_ID,
  WEB_JOIN_SHELL_TAGLINE,
} from "../utils/webJoinShell.ts";
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
const joinHtmlPath = path.join(distDir, "join.html");
const html = readFileSync(htmlPath, "utf8");
const logoSrc = findExportedLogo(distDir) ?? undefined;
const base = injectWebProfileShell(injectWebAuthShell(html, { logoSrc }));
const indexHtml = injectWebJoinShell(base, { logoSrc });
const joinHtml = injectWebJoinShell(base, { logoSrc, standalone: true });
assertJoinShellDocument(joinHtml);
if (!indexHtml.includes(`id="${WEB_JOIN_SHELL_ID}"`) || !indexHtml.includes(WEB_JOIN_SHELL_TAGLINE)) {
  throw new Error("index.html is missing the invite join shell");
}
assertJoinRewrite(path.resolve(distDir, "../../../vercel.json"));
writeFileSync(htmlPath, indexHtml);
writeFileSync(joinHtmlPath, joinHtml);
console.log(
  `Injected /app login shell, profile hero, and invite join shell into ${htmlPath}` +
    (logoSrc ? ` (mark ${logoSrc})` : " (inline mark)"),
);
console.log(`Wrote invite join document ${joinHtmlPath}`);

function assertJoinRewrite(vercelPath: string): void {
  const vercel = JSON.parse(readFileSync(vercelPath, "utf8")) as {
    rewrites?: Array<{ source?: string; destination?: string }>;
  };
  const rewrites = vercel.rewrites ?? [];
  const joinAt = rewrites.findIndex((rewrite) => rewrite.source === "/app/join/:token");
  const spaAt = rewrites.findIndex(
    (rewrite) =>
      rewrite.destination === "/app/index.html" &&
      typeof rewrite.source === "string" &&
      rewrite.source.includes(":path"),
  );
  if (joinAt === -1 || rewrites[joinAt]?.destination !== "/app/join.html") {
    throw new Error("vercel.json must rewrite /app/join/:token to /app/join.html");
  }
  if (spaAt !== -1 && joinAt > spaAt) {
    throw new Error("The /app/join/:token rewrite must be listed before the /app SPA fallback");
  }
}
