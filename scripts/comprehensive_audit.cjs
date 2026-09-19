const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
let routesRaw = fs.readFileSync(path.join(rootDir, 'backend/routes.json'), 'utf8');
if (routesRaw.charCodeAt(0) === 0xFEFF) {
  routesRaw = routesRaw.slice(1);
}
const backendRoutes = JSON.parse(routesRaw);

// Recursive file walker
function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.vscode', '.agents'].includes(file)) {
        walk(full, fileList);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const frontendFiles = walk(path.join(rootDir, 'frontend/src'));

const frontendCalls = [];
// Regex for api.get, api.post, etc.
// Also capture line numbers
for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Match: api.(get|post|patch|put|delete)(<...>)?('...', "...", `...`)
  const callRegex = /\bapi\s*\.\s*(get|post|patch|put|delete)\s*(?:<[^>]+>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;
  let match;
  while ((match = callRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let rawEndpoint = match[3].trim().split('\n')[0].trim();
    
    // Calculate line number
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    frontendCalls.push({
      method,
      rawEndpoint,
      file: path.relative(rootDir, file).replace(/\\/g, '/'),
      line: lineNum
    });
  }

  // Also check for apiEndpoint in configurations / import schemas
  const endpointRegex = /apiEndpoint:\s*['"`]([^'"`]+)['"`]/g;
  while ((match = endpointRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    frontendCalls.push({
      method: 'POST',
      rawEndpoint: match[1].trim(),
      file: path.relative(rootDir, file).replace(/\\/g, '/'),
      line: lineNum,
      isConfigEndpoint: true
    });
  }
}

console.log(`Extracted ${frontendCalls.length} frontend API calls.`);

// Normalize backend routes
const backendMap = backendRoutes.map(r => {
  const cleanUri = r.uri.replace(/^\/?(api\/v1\/|api\/)?/, '').replace(/\/$/, '');
  const methods = r.method.split('|').map(m => m.trim().toUpperCase());
  return {
    rawUri: r.uri,
    cleanUri,
    methods,
    action: r.action,
    middleware: r.middleware || [],
    name: r.name || null,
    controller: r.action.split('@')[0],
    controllerMethod: r.action.split('@')[1] || null
  };
});

// Matcher function
function matchRoute(method, endpoint) {
  // Normalize frontend endpoint
  let clean = endpoint.trim();
  // Strip expressions like ${...?...:...} or ${qs}
  clean = clean.replace(/\$\{[^}]*\?[^}]*\}/g, '');
  clean = clean.replace(/\$\{qs\}/g, '');
  clean = clean.replace(/\$\{[^}]*query[^}]*\}/g, '');
  // Strip query string
  clean = clean.split('?')[0].trim();
  // Replace template literals with :param placeholder
  clean = clean.replace(/\$\{[^}]+\}/g, 'PARAM_VAL');
  clean = clean.replace(/^\/?(index\.php\/)?(api\/v1\/|api\/)?/, '').replace(/\/$/, '');

  const matchingUriRoutes = [];
  const fullMatches = [];

  for (const b of backendMap) {
    // Convert backend cleanUri with parameters {param} into regex
    const pattern = '^' + b.cleanUri.replace(/\{[^}]+\}/g, '[^/]+') + '$';
    const regex = new RegExp(pattern);
    if (regex.test(clean)) {
      matchingUriRoutes.push(b);
      // Check method
      if (b.methods.includes(method) || (method === 'GET' && b.methods.includes('HEAD'))) {
        fullMatches.push(b);
      }
    }
  }

  return {
    cleanPath: clean,
    matchingUriRoutes,
    fullMatches
  };
}

const unmatchedCalls = [];
const methodMismatches = [];
const matchedCalls = [];

for (const call of frontendCalls) {
  if (call.rawEndpoint.startsWith('http://') || call.rawEndpoint.startsWith('https://')) {
    continue;
  }
  const result = matchRoute(call.method, call.rawEndpoint);
  if (result.fullMatches.length > 0) {
    matchedCalls.push({
      call,
      matchedBackend: result.fullMatches.map(m => ({ uri: m.rawUri, action: m.action, methods: m.methods }))
    });
  } else if (result.matchingUriRoutes.length > 0) {
    methodMismatches.push({
      call,
      cleanPath: result.cleanPath,
      availableMethods: result.matchingUriRoutes.flatMap(r => r.methods),
      matchingRoutes: result.matchingUriRoutes.map(m => ({ uri: m.rawUri, methods: m.methods, action: m.action }))
    });
  } else {
    unmatchedCalls.push({
      call,
      cleanPath: result.cleanPath
    });
  }
}

// Check uncalled backend routes
const calledBackendUris = new Set();
for (const m of matchedCalls) {
  for (const b of m.matchedBackend) {
    calledBackendUris.add(b.methods.join('|') + '::' + b.uri);
  }
}

const uncalledBackendRoutes = backendMap.filter(b => {
  // Check if any matched call touched this route
  return !matchedCalls.some(m => m.matchedBackend.some(mb => mb.uri === b.rawUri && (b.methods.includes(m.call.method) || (m.call.method === 'GET' && b.methods.includes('HEAD')))));
});

// Group backend duplicate actions
const actionToRoutes = {};
for (const b of backendMap) {
  const key = b.methods.sort().join('|') + ' ==> ' + b.action;
  if (!actionToRoutes[key]) actionToRoutes[key] = [];
  actionToRoutes[key].push(b.rawUri);
}
const duplicateActions = Object.entries(actionToRoutes)
  .filter(([_, uris]) => uris.length > 1)
  .map(([action, uris]) => ({ action, uris }));

const report = {
  summary: {
    totalBackendRoutes: backendRoutes.length,
    totalFrontendApiCalls: frontendCalls.length,
    matchedCallsCount: matchedCalls.length,
    unmatchedCallsCount: unmatchedCalls.length,
    methodMismatchesCount: methodMismatches.length,
    uncalledBackendRoutesCount: uncalledBackendRoutes.length,
    duplicateActionsCount: duplicateActions.length,
  },
  unmatchedCalls,
  methodMismatches,
  duplicateActions,
  uncalledBackendRoutes: uncalledBackendRoutes.map(r => ({
    uri: r.rawUri,
    methods: r.methods,
    action: r.action,
    middleware: r.middleware
  }))
};

fs.writeFileSync(path.join(rootDir, 'scripts/detailed_api_audit.json'), JSON.stringify(report, null, 2));
console.log('=== AUDIT COMPLETE ===');
console.log(JSON.stringify(report.summary, null, 2));
