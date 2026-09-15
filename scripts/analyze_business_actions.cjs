const fs = require('fs');
const path = require('path');

const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'uncalled_routes.json'), 'utf8'));
const actions = list.filter(r => {
  const uri = r.uri;
  if (uri.includes('bulk-import') || uri.includes('generate-batch')) return false;
  if (uri.includes('webhooks/')) return false;
  if (uri.endsWith('.xml') || uri.endsWith('.txt') || uri.endsWith('.json')) return false;
  if (r.method === 'GET|HEAD' && (uri.endsWith('}') || uri.endsWith('show'))) return false;
  if (uri.startsWith('api/v1/platform/')) return false;
  return true;
});

console.log('Business actions count:', actions.length);
const byModule = {};
for (const a of actions) {
  const clean = a.uri.replace(/^\/?api\/v1\//, '');
  const mod = clean.split('/')[0];
  if (!byModule[mod]) byModule[mod] = [];
  byModule[mod].push(a);
}

for (const [m, items] of Object.entries(byModule)) {
  console.log(`\n### ${m.toUpperCase()} (${items.length} actions)`);
  items.forEach(i => console.log(`  - [${i.method}] ${i.uri} -> ${i.action}`));
}
