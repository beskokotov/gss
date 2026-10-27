import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetRoot = new URL('../public/assets/', import.meta.url);
const mime = { png: 'image/png', webp: 'image/webp', ttf: 'font/ttf' };
const names = [
  'gss-logo.png', 'garant-logo.png', 'legal-art.webp',
  'research-art.webp', 'manrope-regular.ttf', 'manrope-bold.ttf'
];
const assets = Object.fromEntries(await Promise.all(names.map(async (name) => {
  const bytes = await readFile(new URL(name, assetRoot));
  return [name, `data:${mime[name.split('.').pop()]};base64,${bytes.toString('base64')}`];
})));
const imageAssets = Object.fromEntries(names.filter(name => !name.endsWith('.ttf')).map(name => [name, assets[name]]));

const result = await build({
  root,
  configFile: false,
  publicDir: false,
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'standalone-preview-assets',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/App.jsx')) {
        const original = 'const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}`;';
        if (!code.includes(original)) throw new Error('Asset helper has changed; update preview builder.');
        return code.replace(original, () => `const asset = name => (${JSON.stringify(imageAssets)})[name];`);
      }
      if (id.endsWith('/src/styles.css')) {
        return code.replace(/url\('\/assets\/([^']+)'\)/g, (_, name) => {
          if (!assets[name]) throw new Error(`Unknown stylesheet asset: ${name}`);
          return `url('${assets[name]}')`;
        });
      }
    }
  }],
  build: {
    write: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('../src/main.jsx', import.meta.url)),
      name: 'GarantServiceSamara',
      formats: ['iife'],
      fileName: 'preview'
    }
  }
});

const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const scripts = output.filter(item => item.type === 'chunk');
const styles = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Expected one script and one stylesheet.');

let html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
html = html.replace('href="./assets/gss-logo.png"', () => `href="${assets['gss-logo.png']}"`);
html = html.replace('</head>', () => `<style>${String(styles[0].source)}</style>\n</head>`);
html = html.replace(
  /<script type="module" src="\/src\/main\.jsx"><\/script>/,
  () => `<script>${scripts[0].code.replace(/<\/script/gi, '<\\/script')}</script>`
);
if (html.includes('src="/src/main.jsx"') || html.includes('type="module"')) throw new Error('Unresolved module entry.');
await writeFile(new URL('../preview.html', import.meta.url), html);
console.log('preview.html ready: open it directly in a browser, without Node.js or a server.');
