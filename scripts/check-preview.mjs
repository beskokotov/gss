import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = await readFile(new URL('../preview.html', import.meta.url), 'utf8');
const errors = [];
const console = new VirtualConsole();
console.on('jsdomError', error => errors.push(error));
const dom = new JSDOM(html, {
  url: 'file:///garant-service-samara/preview.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: console,
  beforeParse(window) {
    window.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    window.fetch = () => { throw new Error('Unexpected network request'); };
  }
});
const pause = () => new Promise(resolve => setTimeout(resolve, 30));

try {
  const { document, Event } = dom.window;
  for (let i = 0; i < 50 && !document.querySelector('h1'); i++) await pause();
  assert.equal(document.querySelectorAll('h1').length, 1);
  assert.equal(document.querySelectorAll('script[src],script[type="module"],link[rel="stylesheet"]').length, 0);
  for (const script of document.scripts) new vm.Script(script.textContent);
  for (const image of document.images) {
    const isNewsImage = image.closest('.rss-card');
    assert.ok(isNewsImage
      ? image.src.startsWith('https://www.garant.ru/files/')
      : image.src.startsWith('data:image/'));
  }
  assert.ok(document.querySelector('link[rel="icon"]').href.startsWith('data:image/'));
  const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(match[1].replace(/["']/g, '').startsWith('data:'));

  const menu = document.querySelector('[aria-controls="main-navigation"]');
  menu.click(); await pause();
  assert.equal(menu.getAttribute('aria-expanded'), 'true');

  assert.equal(document.querySelectorAll('.product-tile-button').length, 17);
  document.getElementById('tab-product-17').click(); await pause();
  assert.equal(document.getElementById('tab-product-17').getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('product-panel').getAttribute('aria-labelledby'), 'tab-product-17');
  assert.equal(document.querySelectorAll('#product-panel button').length, 0);
  document.querySelector('.header-request').click(); await pause();
  const dialog = document.querySelector('dialog[open]');
  assert.ok(dialog);
  dialog.querySelector('[name="name"]').value = 'Проверка';
  dialog.querySelector('[name="contact"]').value = 'demo@example.com';
  dialog.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await pause();
  assert.ok(dialog.querySelector('.draft a').href.startsWith('mailto:info@gss.ru?'));
  assert.equal(errors.length, 0, errors.map(error => error.message).join('\n'));
  process.stdout.write('Standalone preview passed: classic JavaScript, embedded assets, file URL, menu, tabs, dialog and mail preparation.\n');
} finally {
  dom.window.close();
}
