import { buildSite } from './lib/build-site.mjs';

await buildSite('_site');
console.log('GitHub Pages artifact ready in _site/.');
