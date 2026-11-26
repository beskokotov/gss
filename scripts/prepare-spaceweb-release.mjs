import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hosting = resolve(root, '_hosting');
const publicRoot = resolve(hosting, 'public');
const assetPath = /^assets\/[A-Za-z0-9][A-Za-z0-9_-]*\.(?:css|js|png|webp|woff2)$/;
const commitHash = /^[0-9a-f]{40}$/;
const allowed = path => typeof path === 'string' && (path === 'index.html' || path.match(assetPath)?.[0] === path);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function inventory(entries) {
  assert.ok(Array.isArray(entries), 'Missing release inventory.');
  const files = new Map();
  for (const entry of entries) {
    assert.ok(allowed(entry?.path), 'Invalid path in release inventory.');
    const { path, bytes, sha256: hash } = entry;
    assert.ok(!files.has(path), `Duplicate release path: ${path}`);
    assert.ok(Number.isSafeInteger(bytes) && bytes >= 0 && typeof hash === 'string' && hash.length === 64
      && /^[0-9a-f]{64}$/.test(hash),
      `Invalid checksum or size: ${path}`);
    files.set(path, { path, bytes, sha256: hash });
  }
  assert.ok(files.has('index.html') && files.size > 1, 'Release needs index.html and assets.');
  return files;
}

function comparison(previous, current) {
  const added = [], changed = [], missing = [];
  let unchanged = 0;
  for (const [path, entry] of current) {
    const before = previous.get(path);
    if (!before) added.push(path);
    else if (before.sha256 !== entry.sha256 || before.bytes !== entry.bytes) changed.push(path);
    else unchanged++;
  }
  for (const path of previous.keys()) {
    if (!current.has(path)) missing.push(path);
  }
  const group = (title, files) => [`### ${title} (${files.length})`,
    ...[...files].sort().map(path => `- \`${path}\``), ''].join('\n');
  return group('Добавлены', added) + '\n'
    + group('Изменены', changed) + '\n'
    + group('Только в предыдущем манифесте', missing) + '\n'
    + `Совпадают по размеру и SHA-256: ${unchanged}.\n`;
}

const [outputArg, baselinePath] = process.argv.slice(2);
assert.ok(outputArg && process.argv.length <= 4,
  'Usage: node scripts/prepare-spaceweb-release.mjs OUTPUT_DIR [PREVIOUS_MANIFEST]');
const output = resolve(outputArg);
const commit = git('rev-parse', 'HEAD');
const workingTreeClean = git('status', '--porcelain=v1', '--untracked-files=all') === '';
assert.match(commit, commitHash);
if (process.env.GITHUB_ACTIONS === 'true') {
  assert.equal(commit, process.env.GITHUB_SHA, 'Checkout does not match the workflow SHA.');
  assert.ok(workingTreeClean, 'CI builds must come from a clean checkout.');
}

const baseline = baselinePath ? JSON.parse(await readFile(baselinePath, 'utf8')) : null;
let previous;
if (baselinePath) {
  assert.ok(baseline?.version === 1 && typeof baseline.commit === 'string' && baseline.commit.length === 40
    && commitHash.test(baseline.commit) && typeof baseline.workingTreeClean === 'boolean',
    'Invalid previous SpaceWeb release manifest.');
  previous = inventory(baseline.files);
}

const packageManifest = JSON.parse(await readFile(resolve(hosting, 'manifest.json'), 'utf8'));
assert.equal(packageManifest.version, 1);
assert.ok(Array.isArray(packageManifest.publicFiles));
const entries = packageManifest.publicFiles.filter(entry =>
  entry.path === 'index.html' || (typeof entry.path === 'string' && entry.path.startsWith('assets/')));
const current = inventory(entries);
for (const directory of [hosting, publicRoot, resolve(publicRoot, 'assets')]) {
  assert.ok((await lstat(directory)).isDirectory(), 'Expected a regular hosting directory.');
}

const payload = [];
for (const path of [...current.keys()].sort()) {
  const entry = current.get(path);
  const source = resolve(publicRoot, path);
  assert.ok((await lstat(source)).isFile(), `Expected a regular file: ${path}`);
  const data = await readFile(source);
  assert.ok(data.length === entry.bytes && sha256(data) === entry.sha256, `Hosting file changed: ${path}`);
  payload.push({ entry, data });
}

await mkdir(output);
const site = resolve(output, 'site');
await mkdir(site);
await mkdir(resolve(site, 'assets'));
for (const { entry, data } of payload) {
  await writeFile(resolve(site, entry.path), data, { flag: 'wx' });
}
const manifest = { version: 1, commit, workingTreeClean, files: payload.map(({ entry }) => entry) };
await writeFile(resolve(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });

console.log(`## Выпуск SpaceWeb \`${commit}\`\n`);
console.log(`Файлов в site/: ${current.size}. Исходники: ${workingTreeClean ? 'чистый checkout' : 'локальные изменения'}.`);
if (previous) {
  console.log(`\nСравнение с манифестом \`${baseline.commit}\`${baseline.workingTreeClean ? '' : ' (локальные изменения)'}.\n`);
  console.log(comparison(previous, current));
} else {
  console.log('\nПредыдущий манифест не передан. Сохраните манифест выпуска для сравнения.');
}
