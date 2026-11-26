import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { soutDocuments, soutTitle } from '../../src/sout.js';

export function soutPage() {
  return {
    name: 'sout-page',
    async writeBundle({ dir }) {
      const folder = join(dir, 'sout');
      const links = [];
      for (const { title, file } of soutDocuments) {
        const pdf = await readFile(join(folder, file));
        if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`Invalid СОУТ PDF: ${file}`);
        links.push(`<li><a href="./sout/${encodeURIComponent(file)}">${title} (PDF)</a></li>`);
      }
      const html = await readFile(join(dir, 'index.html'), 'utf8');
      const entry = html
        .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <base href="../" />')
        .replace(/<title>[^<]+<\/title>/, `<title>${soutTitle} — Гарант-Сервис Самара</title>`)
        .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript><h1>${soutTitle}</h1><ul>${links.join('')}</ul><a href="./">На главную</a></noscript>`);
      await writeFile(join(folder, 'index.html'), entry);
    }
  };
}
