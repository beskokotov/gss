import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../public/assets/', import.meta.url);
await mkdir(root, { recursive: true });
const files = [
  ['gss-logo.png', 'https://gss.ru/wp-content/themes/gss/assets/images/logo.png'],
  ['OmegaUI-Regular-VF.woff2', 'https://www.vtb.ru/fonts/OmegaUI-Regular-VF.woff2']
];
await Promise.all(files.map(async ([name, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(new URL(name, root), Buffer.from(await response.arrayBuffer()));
  console.log(`Сохранен ${name}`);
}));
console.log('Основной логотип и шрифт Omega UI готовы.');
