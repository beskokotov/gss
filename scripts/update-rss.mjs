import { readFile, writeFile } from 'node:fs/promises';

const feedUrl = 'https://rss.garant.ru/news/';
const outputUrl = new URL('../src/news-feed.json', import.meta.url);

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, code) => {
      const point = code[0].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: '\''
    })[entity])
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';
}

function attribute(block, name) {
  return block.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? '';
}

function allowedUrl(value, pathPrefix) {
  try {
    const url = new URL(decodeXml(value));
    if (url.protocol !== 'https:' || !['garant.ru', 'www.garant.ru'].includes(url.hostname)) return '';
    if (pathPrefix && !url.pathname.startsWith(pathPrefix)) return '';
    return url.href;
  } catch {
    return '';
  }
}

const response = await fetch(feedUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`RSS returned HTTP ${response.status}`);

const bytes = Buffer.from(await response.arrayBuffer());
const encoding = response.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1] ?? 'windows-1251';
const xml = new TextDecoder(encoding).decode(bytes);
if (!/<rss\b/i.test(xml)) throw new Error('The RSS response does not contain an RSS document.');

const news = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
  .map(([, item]) => {
    const enclosure = item.match(/<enclosure\b[^>]*\/?\s*>/i)?.[0] ?? '';
    const date = new Date(decodeXml(tag(item, 'pubDate')));
    const imageUrl = allowedUrl(attribute(enclosure, 'url'), '/files/');
    return {
      title: decodeXml(tag(item, 'title')),
      description: decodeXml(tag(item, 'description')),
      date: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
      category: decodeXml(tag(item, 'category')) || 'ГАРАНТ.РУ',
      image: imageUrl,
      href: allowedUrl(tag(item, 'link'), '/news/')
    };
  })
  .filter(item => item.title && item.description && item.date && item.href)
  .sort((first, second) => Date.parse(second.date) - Date.parse(first.date))
  .slice(0, 3);

if (news.length === 0) throw new Error('The RSS feed contained no usable news items; keeping the previous snapshot.');

const next = `${JSON.stringify(news, null, 2)}\n`;
let current = '';
try {
  current = await readFile(outputUrl, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (current !== next) {
  await writeFile(outputUrl, next, 'utf8');
  console.log(`Updated ${news.length} news items from ${feedUrl}.`);
} else {
  console.log('The RSS snapshot is already up to date.');
}
