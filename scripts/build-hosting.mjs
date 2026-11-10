import { copyFile, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSite } from './lib/build-site.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('_hosting/', root);
const snapshot = new URL('build-inputs/news-feed.json', output);
if (process.argv.includes('--refresh-news')) {
  await mkdir(new URL('build-inputs/', output), { recursive: true });
  await copyFile(new URL('src/news-feed.json', root), snapshot);
  try {
    execFileSync(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('scripts/update-rss.mjs', root)), '--output', fileURLToPath(snapshot)], { stdio: 'inherit' });
  } catch {
    console.warn('RSS unavailable: using the saved news snapshot for this release.');
  }
  process.env.GSS_NEWS_SNAPSHOT = fileURLToPath(snapshot);
}
await buildSite('_hosting/public');
await mkdir(new URL('public/api/', output), { recursive: true });
await mkdir(new URL('gss-private/', output), { recursive: true });
await copyFile(new URL('server/public/request.php', root), new URL('public/api/request.php', output));
for (const name of ['config.example.php', 'composer.json', 'composer.lock', 'README.md']) {
  await copyFile(new URL(`server/${name}`, root), new URL(`gss-private/${name}`, output));
}
try {
  await cp(new URL('server/vendor/', root), new URL('gss-private/vendor/', output), { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.warn('SMTP dependencies are not installed. Run composer install in server/ before deploying the form.');
}
console.log('Hosting files ready: _hosting/public/ and _hosting/gss-private/. SMTP is disabled until configured.');
await mkdir(new URL('server-config/', output), { recursive: true });
await copyFile(new URL('server/hosting/README.md', root), new URL('README.md', output));
await copyFile(new URL('server/hosting/nginx.conf.example', root), new URL('server-config/nginx.conf.example', output));
await copyFile(new URL('server/hosting/apache.htaccess', root), new URL('server-config/apache.htaccess', output));
await copyFile(new URL('server/hosting/apache.htaccess', root), new URL('public/.htaccess', output));

async function inventory(directory, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await inventory(new URL(entry.name + '/', directory), name + '/'));
    else {
      const bytes = await readFile(new URL(entry.name, directory));
      files.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  return files;
}
const news = JSON.parse(await readFile(process.env.GSS_NEWS_SNAPSHOT || new URL('src/news-feed.json', root), 'utf8'));
await writeFile(new URL('manifest.json', output), JSON.stringify({
  version: 1,
  builtAt: new Date().toISOString(),
  node: process.version,
  news: { count: news.length, latestDate: news[0]?.date ?? null, source: 'https://rss.garant.ru/news/' },
  publicFiles: await inventory(new URL('public/', output))
}, null, 2) + '\n');
console.log('Deployment instructions, server templates and SHA-256 manifest ready.');
