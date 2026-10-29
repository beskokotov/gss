import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
execFileSync(process.execPath, [fileURLToPath(new URL('./build-preview.mjs', import.meta.url))], {
  cwd: fileURLToPath(root),
  stdio: 'inherit'
});

const destination = new URL('_site/', root);
await mkdir(destination, { recursive: true });
await copyFile(new URL('preview.html', root), new URL('index.html', destination));
// Preserve existing links to the standalone preview.
await copyFile(new URL('preview.html', root), new URL('preview.html', destination));
await writeFile(new URL('.nojekyll', destination), '');
console.log('GitHub Pages artifact ready in _site/.');
