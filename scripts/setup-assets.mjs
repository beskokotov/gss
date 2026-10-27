import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../public/assets/', import.meta.url);
await mkdir(root, { recursive: true });
const files = [
  ['gss-logo.png', 'https://gss.ru/wp-content/themes/gss/assets/images/logo.png'],
  ['garant-logo.png', 'https://gss.ru/wp-content/themes/gss/assets/images/logo_garant.png'],
  ['manrope-regular.ttf', 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf'],
  ['manrope-bold.ttf', 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE-_F.ttf'],
  ['OFL-Manrope.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt']
];
await Promise.all(files.map(async ([name, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(new URL(name, root), Buffer.from(await response.arrayBuffer()));
  console.log(`Сохранен ${name}`);
}));
console.log('Логотипы и шрифты готовы. Добавьте две иллюстрации из ответа в public/assets.');
