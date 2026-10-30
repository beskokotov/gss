import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));

export async function buildSite(target) {
  if (!['_site', '_hosting/public'].includes(target)) throw new Error('Unexpected build destination.');
  const destination = resolve(root, target);
  if (!destination.startsWith(resolve(root) + sep)) throw new Error('Build destination outside project.');

  await build({ root });
  execFileSync(process.execPath, [resolve(root, 'scripts/build-preview.mjs')], { cwd: root, stdio: 'inherit' });
  // Remove only the verified generated public directory after both builds succeed.
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(resolve(root, 'dist'), destination, { recursive: true });
  await copyFile(resolve(root, 'preview.html'), resolve(destination, 'preview.html'));
  await writeFile(resolve(destination, '.nojekyll'), '');
  return destination;
}
