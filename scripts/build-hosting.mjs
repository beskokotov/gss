import { copyFile, cp, mkdir } from 'node:fs/promises';
import { buildSite } from './lib/build-site.mjs';

const root = new URL('../', import.meta.url);
await buildSite('_hosting/public');
const output = new URL('_hosting/', root);
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
