import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../src/news-feed.json', import.meta.url)).replaceAll('\\', '/');

// Hosting releases can use fresh RSS without modifying the tracked snapshot.
export function newsSnapshot() {
  return {
    name: 'hosting-news-snapshot',
    enforce: 'pre',
    async load(id) {
      if (process.env.GSS_NEWS_SNAPSHOT && id.replaceAll('\\', '/') === source) {
        return readFile(process.env.GSS_NEWS_SNAPSHOT, 'utf8');
      }
    }
  };
}
