const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(full, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const frontendFiles = walk(path.resolve(__dirname, '../frontend/src'));
const apiCalls = [];

// Matches api.get, api.post, etc., plus template literals and string literals
const regex = /api\.(get|post|patch|put|delete)\s*(?:<[^>]+>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;

for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let endpoint = match[3].trim();
    // take the first line if multi-line template string
    endpoint = endpoint.split('\n')[0].trim();
    apiCalls.push({
      method,
      endpoint,
      file: path.relative(path.resolve(__dirname, '../frontend'), file)
    });
  }
}

console.log(`Found ${apiCalls.length} API call sites across frontend.`);

// Get backend routes via artisan
let backendRoutes = [];
try {
  const stdout = execSync('php artisan route:list --json', {
    cwd: path.resolve(__dirname, '../backend'),
    maxBuffer: 10 * 1024 * 1024
  });
  backendRoutes = JSON.parse(stdout.toString());
  console.log(`Loaded ${backendRoutes.length} backend routes.`);
} catch (e) {
  console.error('Failed to run route:list:', e.message);
}

// Write out both for analysis
fs.writeFileSync(path.resolve(__dirname, 'frontend_api_calls.json'), JSON.stringify(apiCalls, null, 2));
fs.writeFileSync(path.resolve(__dirname, 'backend_routes.json'), JSON.stringify(backendRoutes, null, 2));

// Compare
const issues = [];
for (const call of apiCalls) {
  let endpoint = call.endpoint;
  
  // Replace query expressions like ${...?...:...} or ${qs}
  endpoint = endpoint.replace(/\$\{[^}]*\?[^}]*\}/g, '');
  endpoint = endpoint.replace(/\$\{qs\}/g, '');
  endpoint = endpoint.replace(/\$\{[^}]*query[^}]*\}/g, '');
  // Strip trailing query strings
  endpoint = endpoint.split('?')[0];

  // Now replace any remaining path params ${...} with a dummy ID '123'
  let cleanEndpoint = endpoint.replace(/\$\{[^}]+\}/g, '123');

  // Strip leading /api/v1/ or /api/ or /
  let routePath = cleanEndpoint.replace(/^\/?(api\/v1\/|api\/)?/, '');

  // Match against backend routes
  const matched = backendRoutes.some(r => {
    const methods = r.method.split('|');
    if (!methods.includes(call.method) && call.method !== 'GET') {
      return false;
    }
    let rUri = r.uri.replace(/^\/?(api\/v1\/|api\/)?/, '');

    // Turn backend uri params {param} or {param?} or {unit:uuid} into regex
    const rRegexPattern = '^' + rUri.replace(/\{[^}]+\}/g, '[^/]+') + '$';
    const rRegex = new RegExp(rRegexPattern);

    return rRegex.test(routePath);
  });

  if (!matched && !call.endpoint.startsWith('http')) {
    issues.push({
      call,
      cleanEndpoint
    });
  }
}

console.log(`Total unmatched endpoints (static + dynamic): ${issues.length}`);
fs.writeFileSync(path.resolve(__dirname, 'unmatched_endpoints.json'), JSON.stringify(issues, null, 2));
console.log('Analysis complete.');
