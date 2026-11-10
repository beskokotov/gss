import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = new URL('../_hosting/', import.meta.url);
const publicRoot = fileURLToPath(new URL('public/', output));
const manifest = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));
assert.equal(manifest.version, 1);
assert.ok(manifest.news.count > 0 && manifest.news.latestDate);
for (const entry of manifest.publicFiles) {
  const path = resolve(publicRoot, entry.path);
  assert.ok(path.startsWith(resolve(publicRoot) + sep), 'Manifest path escapes public directory');
  const bytes = await readFile(path);
  assert.equal(bytes.length, entry.bytes, `Changed size: ${entry.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Changed file: ${entry.path}`);
}
const html = await readFile(new URL('public/index.html', output), 'utf8');
assert.ok(!html.includes('/src/main.jsx'), 'Unbuilt application entry');
const localReferences = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(value => !/^[a-z]+:/i.test(value));
for (const reference of localReferences) {
  const file = resolve(publicRoot, reference);
  assert.ok(file.startsWith(resolve(publicRoot) + sep));
  await readFile(file);
}
const assetRoot = new URL('public/assets/', output);
for (const name of await readdir(assetRoot)) {
  if (!/\.(css|js)$/.test(name)) continue;
  const code = await readFile(new URL(name, assetRoot), 'utf8');
  const references = name.endsWith('.css')
    ? [...code.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(m => m[1])
    : [...code.matchAll(/(?:from|import)\s*["'](\.\/[^"']+)["']/g)].map(m => m[1]);
  for (const reference of references) if (!/^(data:|https?:)/i.test(reference)) await readFile(new URL(reference, assetRoot));
}
async function checkPublic(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!['gss-private', 'vendor', '.git', '.env', 'node_modules', 'server', 'src', 'backups', 'config.php', 'composer.json', 'composer.lock'].includes(entry.name), `Private file in public: ${entry.name}`);
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await checkPublic(url);
    else if (entry.name.endsWith('.php')) assert.equal(fileURLToPath(url), fileURLToPath(new URL('public/api/request.php', output)));
  }
}
await checkPublic(new URL('public/', output));
for (const file of ['gss-private/vendor/autoload.php', 'gss-private/vendor/phpmailer/phpmailer/src/PHPMailer.php', 'README.md', 'server-config/nginx.conf.example', 'public/.htaccess']) await readFile(new URL(file, output));
const example = await readFile(new URL('gss-private/config.example.php', output), 'utf8');
assert.match(example, /'enabled'\s*=>\s*false/);
assert.match(example, /'password'\s*=>\s*''/);
const preview = await readFile(new URL('public/preview.html', output), 'utf8');
assert.ok(!preview.includes('src="/src/main.jsx"'));
console.log(`Hosting package passed: ${manifest.publicFiles.length} public files, correct checksums, resolved assets, private SMTP dependencies outside web root. Latest news: ${manifest.news.latestDate}.`);
