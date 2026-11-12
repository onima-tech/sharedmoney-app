const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("invite join rewrite is served before the /app SPA fallback", () => {
  const vercelPath = path.join(__dirname, "../../vercel.json");
  const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  const rewrites = vercel.rewrites;
  const joinAt = rewrites.findIndex((rewrite) => rewrite.source === "/app/join/:token");
  const spaAt = rewrites.findIndex(
    (rewrite) =>
      rewrite.destination === "/app/index.html" &&
      String(rewrite.source).includes(":path"),
  );

  assert.notEqual(joinAt, -1);
  assert.equal(rewrites[joinAt].destination, "/app/join.html");
  assert.ok(spaAt === -1 || joinAt < spaAt);
});

test("built join document keeps the no-JS invite shell when the export exists", () => {
  const joinPath = path.join(__dirname, "../../web/dist/app/join.html");
  if (!fs.existsSync(joinPath)) return;

  const html = fs.readFileSync(joinPath, "utf8");
  assert.match(html, /<title>You're invited to a SharedMoney group<\/title>/);
  assert.match(html, /No daily limits, no ads, no bank link\./);
  assert.match(html, /<noscript>[\s\S]*play\.google\.com\/store\/apps\/details\?id=com\.vaibhavarora\.sharemoney/);
  assert.match(html, /<noscript>[\s\S]*apps\.apple\.com\/app\/id6755923591/);
  assert.match(html, /data-invite-cta="open_app"/);
  assert.match(html, /data-invite-cta="web_app"/);
});
