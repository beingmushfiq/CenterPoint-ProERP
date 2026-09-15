const fs = require('fs');
const path = require('path');

const frontendFiles = [];
function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') walk(full);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      frontendFiles.push(full);
    }
  }
}
walk(path.resolve(__dirname, '../frontend/src'));

const apiCalls = [];

// Match api.(get|post|put|patch|delete)(<generics>)?('url'|"url"|`url`)
// Generics can span multiple lines and contain nested brackets
for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Clean comments
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  
  // Find all api.method calls
  const methodRegex = /\bapi\s*\.\s*(get|post|patch|put|delete)\b/g;
  let m;
  while ((m = methodRegex.exec(cleanContent)) !== null) {
    const method = m[1].toUpperCase();
    const startIndex = m.index + m[0].length;
    let rest = cleanContent.slice(startIndex).trimStart();
    
    // Skip TypeScript generic <...> if present
    if (rest.startsWith('<')) {
      let depth = 0;
      let i = 0;
      for (; i < rest.length; i++) {
        if (rest[i] === '<') depth++;
        else if (rest[i] === '>') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      rest = rest.slice(i).trimStart();
    }
    
    // Now should start with (
    if (!rest.startsWith('(')) continue;
    rest = rest.slice(1).trimStart();
    
    // Find string delimiter `, ' or "
    const quote = rest[0];
    if (quote !== '`' && quote !== "'" && quote !== '"') continue;
    
    let urlStr = '';
    let escaped = false;
    for (let i = 1; i < rest.length; i++) {
      const char = rest[i];
      if (escaped) {
        urlStr += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        break;
      }
      urlStr += char;
    }
    
    let endpoint = urlStr.trim();
    // Strip query expressions or parameters inside template literals first
    endpoint = endpoint.replace(/\$\{[^}]*\?[^}]*\}/g, '');
    endpoint = endpoint.replace(/\$\{qs\}/g, '');
    endpoint = endpoint.replace(/\$\{[^}]*query[^}]*\}/g, '');
    endpoint = endpoint.split('?')[0].trim();
    let cleanEndpoint = endpoint.replace(/\$\{[^}]+\}/g, 'PLACEHOLDER');
    let routePath = cleanEndpoint.replace(/^\/+/, '').replace(/^(api\/v1\/|api\/)/, '');
    
    apiCalls.push({
      method,
      routePath,
      raw: urlStr,
      file: path.relative(path.resolve(__dirname, '..'), file),
    });
  }

  // Also find all apiEndpoint: '...' declarations (used in UniversalImportModal schemas)
  const endpointRegex = /apiEndpoint:\s*['"`]([^'"`]+)['"`]/g;
  let em;
  while ((em = endpointRegex.exec(cleanContent)) !== null) {
    let urlStr = em[1].trim();
    let cleanEndpoint = urlStr.replace(/^\/+/, '').replace(/^(api\/v1\/|api\/)/, '');
    apiCalls.push({
      method: 'POST',
      routePath: cleanEndpoint,
      raw: urlStr,
      file: path.relative(path.resolve(__dirname, '..'), file),
    });
  }
}

const backendRoutes = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'backend_routes.json'), 'utf8'));

// Filter to API routes under api/v1 or api/
const relevantRoutes = backendRoutes.filter(r => {
  return r.uri.startsWith('api/') || r.uri.startsWith('api/v1/');
});

console.log('Total relevant backend routes:', relevantRoutes.length);
console.log('Total frontend apiCalls captured:', apiCalls.length);

const uncalledRoutes = [];

for (const r of relevantRoutes) {
  const methods = r.method.split('|').filter(m => m !== 'HEAD');
  let rUri = r.uri.replace(/^\/?(api\/v1\/|api\/)?/, '');
  
  // Regex to match rUri against any frontend call
  const rRegexPattern = '^' + rUri.replace(/\{[^}]+\}/g, '[^/]+') + '$';
  const rRegex = new RegExp(rRegexPattern);

  // Check if any frontend call matches this backend route
  const called = apiCalls.some(call => {
    // Check method
    if (!methods.includes(call.method)) return false;
    // Replace PLACEHOLDER with dummy
    const testPath = call.routePath.replace(/PLACEHOLDER/g, 'dummy');
    return rRegex.test(testPath);
  });

  if (!called) {
    uncalledRoutes.push({
      method: r.method,
      uri: r.uri,
      name: r.name,
      action: r.action
    });
  }
}

console.log('Uncalled backend routes count:', uncalledRoutes.length);

// Group uncalled by prefix
const grouped = {};
for (const r of uncalledRoutes) {
  const cleanUri = r.uri.replace(/^\/?(api\/v1\/|api\/)?/, '');
  const prefix = cleanUri.split('/')[0] || 'root';
  if (!grouped[prefix]) grouped[prefix] = [];
  grouped[prefix].push(r);
}

for (const [prefix, list] of Object.entries(grouped)) {
  console.log(`\n### Domain / Module: ${prefix} (${list.length} routes)`);
  list.forEach(r => console.log(`  - [${r.method}] ${r.uri} (${r.action})`));
}

fs.writeFileSync(path.resolve(__dirname, 'uncalled_routes.json'), JSON.stringify(uncalledRoutes, null, 2));
