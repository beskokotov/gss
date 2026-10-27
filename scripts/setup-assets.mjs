import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../public/assets/', import.meta.url);
await mkdir(root, { recursive: true });
const files = [
  ['gss-logo.png', 'https://gss.ru/wp-content/themes/gss/assets/images/logo.png'],
  ['garant-logo.png', 'https://gss.ru/wp-content/themes/gss/assets/images/logo_garant.png'],
  ['Hauora-Regular.woff2', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/fonts/webfonts/Hauora-Regular.woff2'],
  ['Hauora-Medium.woff2', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/fonts/webfonts/Hauora-Medium.woff2'],
  ['Hauora-SemiBold.woff2', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/fonts/webfonts/Hauora-SemiBold.woff2'],
  ['Hauora-Bold.woff2', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/fonts/webfonts/Hauora-Bold.woff2'],
  ['Hauora-ExtraBold.woff2', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/fonts/webfonts/Hauora-ExtraBold.woff2'],
  ['OFL-Hauora.txt', 'https://raw.githubusercontent.com/WCYS-Co/Hauora-Sans/master/OFL.txt'],
  ['ClearSans-Bold.woff', 'https://raw.githubusercontent.com/intel/clear-sans/main/WOFF/ClearSans-Bold.woff'],
  ['LICENSE-ClearSans.txt', 'https://raw.githubusercontent.com/intel/clear-sans/main/LICENSE.txt']
];
await Promise.all(files.map(async ([name, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(new URL(name, root), Buffer.from(await response.arrayBuffer()));
  console.log(`Сохранен ${name}`);
}));
console.log('Логотипы и шрифты готовы. Добавьте две иллюстрации из ответа в public/assets.');
