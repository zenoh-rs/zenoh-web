import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../public/", import.meta.url).pathname;
const forbidden = [
  "SERVER_ID",
  "CHANNEL_ID",
  "localhost:1313",
  "livereload",
  "0001-01-01",
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

const failures = [];
let htmlCount = 0;

for await (const file of walk(root)) {
  const info = await stat(file);
  if (info.size > 10 * 1024 * 1024) {
    failures.push(`${file}: file exceeds 10 MB`);
  }

  if (!file.endsWith(".html")) continue;
  htmlCount += 1;
  const html = await readFile(file, "utf8");

  for (const token of forbidden) {
    if (html.includes(token)) failures.push(`${file}: contains ${token}`);
  }

  // Hugo's --minify strips attribute quotes, so match quoted and unquoted forms.
  if (!/rel=(?:"canonical"|'canonical'|canonical(?=[\s/>]))/.test(html)) {
    failures.push(`${file}: missing canonical link`);
  }

  if (/target=(?:"_blank"|'_blank'|_blank(?=[\s/>]))(?![^>]*rel=)/s.test(html)) {
    failures.push(`${file}: target=_blank without rel`);
  }

  const h1Count = (html.match(/<h1\b/g) || []).length;
  if (h1Count > 1) {
    failures.push(`${file}: contains ${h1Count} h1 elements`);
  }
}

if (htmlCount === 0) failures.push("public/: no HTML files found");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${htmlCount} HTML files in public/`);
