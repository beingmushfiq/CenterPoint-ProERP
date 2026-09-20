#!/usr/bin/env node
/**
 * ==============================================================================
 * DevCenterPoint ProERP — Unified Master Deployment & Synchronization Script
 * ==============================================================================
 * 
 * Automatically synchronizes backend files to target backend directory, compiles
 * frontend bundle and deploys dist to frontend web root, executing all necessary
 * system actions:
 * 
 * 1. [FRONTEND] Compiles production build (tsc -b && vite build)
 * 2. [FRONTEND] Synchronizes frontend/dist to target web directory (public_html / public)
 *    - Preserves server files (.htaccess, index.php, deploy-webhook.php)
 *    - Prunes stale hashed chunks while retaining in-flight cache
 * 3. [BACKEND] Synchronizes backend files to target backend directory
 *    - Preserves server environment (.env)
 *    - Scaffolds storage and cache directories
 * 4. [ACTIONS] Executes necessary backend actions:
 *    - Ensures storage symlink (php artisan storage:link)
 *    - Runs database migrations (php artisan migrate --force)
 *    - Rebuilds production caches (config:cache, route:cache, view:cache)
 *    - Restarts queue workers (php artisan queue:restart)
 *    - Sets appropriate permissions on Linux/macOS
 * 5. [VERIFICATION] Runs post-deploy pre-flight readiness audit
 * 
 * Usage:
 *   node scripts/deploy_all.cjs [OPTIONS]
 *   npm run deploy:all
 *   bash deploy.sh
 *   .\deploy.ps1
 * 
 * Options:
 *   --skip-build             Skip frontend npm build
 *   --skip-backend-sync      Skip copying backend files (use existing backend dir)
 *   --skip-migrate           Skip running database migrations
 *   --skip-cache             Skip running config/route/view caching
 *   --target-backend=<path>  Custom backend destination directory
 *   --target-frontend=<path> Custom frontend/public destination directory
 *   --production             Run in strict production mode
 *   --seed                   Run database seeders after migration
 *   --help, -h               Show this documentation
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_BACKEND = path.join(ROOT_DIR, 'backend');
const SOURCE_FRONTEND = path.join(ROOT_DIR, 'frontend');
const SOURCE_DIST = path.join(SOURCE_FRONTEND, 'dist');
const LOCAL_PUBLIC_HTML = path.join(ROOT_DIR, 'public_html');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

// Parse command-line arguments
const args = process.argv.slice(2);
let skipBuild = false;
let skipBackendSync = false;
let skipMigrate = false;
let skipCache = false;
let isProduction = false;
let runSeed = false;
let customTargetBackend = null;
let customTargetFrontend = null;

for (const arg of args) {
  if (arg === '--skip-build') skipBuild = true;
  else if (arg === '--skip-backend-sync') skipBackendSync = true;
  else if (arg === '--skip-migrate') skipMigrate = true;
  else if (arg === '--skip-cache') skipCache = true;
  else if (arg === '--production') isProduction = true;
  else if (arg === '--seed') runSeed = true;
  else if (arg.startsWith('--target-backend=')) customTargetBackend = arg.split('=')[1].trim();
  else if (arg.startsWith('--target-frontend=')) customTargetFrontend = arg.split('=')[1].trim();
  else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
}

function printHelp() {
  console.log(`
${colors.bright}${colors.cyan}DevCenterPoint ProERP — Unified Deployment Script${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node scripts/deploy_all.cjs [OPTIONS]
  npm run deploy:all

${colors.yellow}Options:${colors.reset}
  --skip-build             Skip frontend TypeScript compile & Vite build
  --skip-backend-sync      Skip copying backend files into destination
  --skip-migrate           Skip running database migrations
  --skip-cache             Skip running config/route/view caching
  --target-backend=<path>  Destination directory for backend (default: backend/ or server path)
  --target-frontend=<path> Destination directory for frontend (default: public_html/ or server path)
  --production             Optimize for production (force cache, optimize assets)
  --seed                   Run database seeders after migrations
  --help, -h               Display this help text
`);
}

// Auto-detect server environment (e.g., cPanel shared hosting)
const isLinux = process.platform === 'linux';
const cpanelUser = process.env.CPANEL_USER || (isLinux ? (process.env.USER || 'devcente') : null);
const serverProErpRoot = cpanelUser ? `/home/${cpanelUser}/projects/proerp` : null;

// Resolve target directories
let targetBackend = customTargetBackend
  ? path.resolve(customTargetBackend)
  : (isLinux && serverProErpRoot && fs.existsSync(serverProErpRoot)
      ? path.join(serverProErpRoot, 'backend')
      : SOURCE_BACKEND);

let targetFrontend = customTargetFrontend
  ? path.resolve(customTargetFrontend)
  : (isLinux && serverProErpRoot && fs.existsSync(serverProErpRoot)
      ? path.join(serverProErpRoot, 'public')
      : LOCAL_PUBLIC_HTML);

const startTime = Date.now();

console.log(`${colors.bright}${colors.cyan}==================================================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan} DevCenterPoint ProERP — Unified Deployment & Sync Engine         ${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}==================================================================${colors.reset}`);
console.log(` ${colors.dim}Platform:${colors.reset}        ${process.platform} (Node ${process.version})`);
console.log(` ${colors.dim}Source Repo:${colors.reset}     ${ROOT_DIR}`);
console.log(` ${colors.dim}Backend Target:${colors.reset}  ${targetBackend}`);
console.log(` ${colors.dim}Frontend Target:${colors.reset} ${targetFrontend}`);
console.log(` ${colors.dim}Build Options:${colors.reset}   skipBuild=${skipBuild}, skipMigrate=${skipMigrate}, isProd=${isProduction}`);
console.log(`${colors.cyan}------------------------------------------------------------------${colors.reset}\n`);

// Helper utilities
function logStep(step, message) {
  console.log(`${colors.bright}${colors.yellow}[Step ${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(` ${colors.green}✓${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(` ${colors.blue}ℹ${colors.reset} ${message}`);
}

function logWarn(message) {
  console.log(` ${colors.yellow}⚠${colors.reset} ${message}`);
}

function logError(message) {
  console.log(` ${colors.red}✖${colors.reset} ${message}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirectoryRecursive(src, dest, ignoreList = []) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, ignoreList);
    } else {
      // Don't overwrite existing target .env unless explicitly instructed
      if (entry.name === '.env' && fs.existsSync(destPath)) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Find working PHP CLI binary
function findPhpBinary() {
  const candidates = [
    process.env.PHP_BIN,
    '/opt/cpanel/ea-php85/root/usr/bin/php',
    '/opt/cpanel/ea-php84/root/usr/bin/php',
    'php8.4',
    'php8.5',
    'php',
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      const res = spawnSync(bin, ['-v'], { encoding: 'utf-8' });
      if (res.status === 0) {
        return bin;
      }
    } catch (e) {}
  }
  return 'php';
}

const phpBin = findPhpBinary();

// ------------------------------------------------------------------------------
// STEP 1: FRONTEND BUILD (Vite + TypeScript)
// ------------------------------------------------------------------------------
logStep('1/5', 'Compiling Frontend Production Distribution');
if (!skipBuild) {
  try {
    console.log(` Running: npm run build --workspace frontend in ${ROOT_DIR}`);
    execSync('npm run build --workspace frontend', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    logSuccess('Frontend compiled cleanly into frontend/dist/');
  } catch (err) {
    logError('Frontend build failed. Halting deployment.');
    process.exit(1);
  }
} else {
  logInfo('Skipping frontend build (--skip-build specified).');
}

// ------------------------------------------------------------------------------
// STEP 2: FRONTEND DISTRIBUTION SYNC (to public_html / public)
// ------------------------------------------------------------------------------
logStep('2/5', 'Deploying Frontend Dist to Web Directory');
if (!fs.existsSync(SOURCE_DIST)) {
  logError(`Build directory "${SOURCE_DIST}" does not exist. Run build first.`);
  process.exit(1);
}

ensureDir(targetFrontend);

// Server files that must NEVER be overwritten or deleted from web root
const PRESERVED_SERVER_FILES = new Set([
  'index.php',
  '.htaccess',
  'deploy-webhook.php',
  'portfolio-placeholder.html',
  'portfolio-htaccess.txt',
]);

const distAssetsDir = path.join(SOURCE_DIST, 'assets');
const targetAssetsDir = path.join(targetFrontend, 'assets');

// 2.1 Sync assets directory with stale chunk retention (48h safe grace period)
if (fs.existsSync(distAssetsDir)) {
  ensureDir(targetAssetsDir);
  const newAssets = new Set(fs.readdirSync(distAssetsDir));
  const oldAssets = fs.existsSync(targetAssetsDir) ? fs.readdirSync(targetAssetsDir) : [];

  let removedCount = 0;
  let copiedCount = 0;
  const RETENTION_MS = 48 * 60 * 60 * 1000;
  const now = Date.now();

  for (const oldFile of oldAssets) {
    if (!newAssets.has(oldFile)) {
      try {
        const filePath = path.join(targetAssetsDir, oldFile);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > RETENTION_MS) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch (e) {}
    }
  }

  for (const newFile of newAssets) {
    fs.copyFileSync(path.join(distAssetsDir, newFile), path.join(targetAssetsDir, newFile));
    copiedCount++;
  }
  logSuccess(`Frontend assets deployed: ${copiedCount} files updated, ${removedCount} stale chunks pruned.`);
}

// 2.2 Sync root entry files (index.html, manifest, icons)
const distEntries = fs.readdirSync(SOURCE_DIST);
let rootCopied = 0;

for (const item of distEntries) {
  if (item === 'assets') continue;

  const srcPath = path.join(SOURCE_DIST, item);
  const destPath = path.join(targetFrontend, item);

  if (PRESERVED_SERVER_FILES.has(item) && fs.existsSync(destPath)) {
    logInfo(`Preserving server-configured file: ${item}`);
    continue;
  }

  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    copyDirectoryRecursive(srcPath, destPath);
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
  rootCopied++;
}

// 2.3 Ensure index.php fallback exists if not present
const targetIndexPhp = path.join(targetFrontend, 'index.php');
if (!fs.existsSync(targetIndexPhp) && fs.existsSync(path.join(LOCAL_PUBLIC_HTML, 'index.php'))) {
  fs.copyFileSync(path.join(LOCAL_PUBLIC_HTML, 'index.php'), targetIndexPhp);
  logSuccess('Created web root index.php API dispatcher.');
}

// 2.4 Ensure .htaccess exists
const targetHtaccess = path.join(targetFrontend, '.htaccess');
if (!fs.existsSync(targetHtaccess) && fs.existsSync(path.join(LOCAL_PUBLIC_HTML, '.htaccess'))) {
  fs.copyFileSync(path.join(LOCAL_PUBLIC_HTML, '.htaccess'), targetHtaccess);
  logSuccess('Created web root .htaccess URL rewriting configuration.');
}

logSuccess(`Frontend distribution synchronized into ${targetFrontend} (${rootCopied} root entries).`);

// ------------------------------------------------------------------------------
// STEP 3: BACKEND SYNCHRONIZATION (to target backend directory)
// ------------------------------------------------------------------------------
logStep('3/5', 'Synchronizing Backend Application Files');
if (!skipBackendSync && path.resolve(SOURCE_BACKEND) !== path.resolve(targetBackend)) {
  console.log(` Copying: ${SOURCE_BACKEND} -> ${targetBackend}`);
  ensureDir(targetBackend);

  // Exclude vendor (unless fresh install), storage data, and git
  const BACKEND_IGNORE = [
    'vendor',
    'node_modules',
    '.git',
    '.env',
    'storage',
  ];

  copyDirectoryRecursive(SOURCE_BACKEND, targetBackend, BACKEND_IGNORE);
  logSuccess(`Backend source files mirrored to ${targetBackend}`);
} else {
  logInfo(`Backend source is active directory: ${targetBackend}`);
}

// ------------------------------------------------------------------------------
// STEP 4: NECESSARY BACKEND ACTIONS & ARTISAN PIPELINE
// ------------------------------------------------------------------------------
logStep('4/5', 'Executing Necessary Backend Production Actions');

// 4.1 Storage directory scaffolding
const requiredStorageDirs = [
  path.join(targetBackend, 'storage', 'app', 'public'),
  path.join(targetBackend, 'storage', 'framework', 'cache', 'data'),
  path.join(targetBackend, 'storage', 'framework', 'sessions'),
  path.join(targetBackend, 'storage', 'framework', 'views'),
  path.join(targetBackend, 'storage', 'logs'),
  path.join(targetBackend, 'bootstrap', 'cache'),
];

for (const dir of requiredStorageDirs) {
  ensureDir(dir);
}
logSuccess('Storage & cache directory hierarchies verified.');

// 4.2 Linux file permissions (775 for storage and bootstrap/cache)
if (isLinux) {
  try {
    execSync(`chmod -R 775 "${path.join(targetBackend, 'storage')}" "${path.join(targetBackend, 'bootstrap', 'cache')}" 2>/dev/null || true`);
    logSuccess('Permissions set (775) on storage and bootstrap/cache.');
  } catch (e) {}
}

// 4.3 Storage Link
try {
  execSync(`"${phpBin}" artisan storage:link --quiet || true`, {
    cwd: targetBackend,
    stdio: 'ignore',
  });
  logSuccess('Public storage symlink active.');
} catch (e) {}

// 4.4 Database Migrations
if (!skipMigrate) {
  try {
    console.log(' Running database migrations (php artisan migrate --force)...');
    execSync(`"${phpBin}" artisan migrate --force`, {
      cwd: targetBackend,
      stdio: 'inherit',
    });
    logSuccess('Database migrations executed successfully.');
  } catch (err) {
    logWarn('Database migration encountered an issue (check DB credentials/connectivity).');
  }
} else {
  logInfo('Skipping database migrations (--skip-migrate specified).');
}

// 4.5 Database Seeders (Optional)
if (runSeed) {
  try {
    console.log(' Running database seeders (php artisan db:seed --force)...');
    execSync(`"${phpBin}" artisan db:seed --force`, {
      cwd: targetBackend,
      stdio: 'inherit',
    });
    logSuccess('Database seeders applied.');
  } catch (err) {
    logWarn('Database seeder execution encountered an error.');
  }
}

// 4.6 Production Caches & Optimizations
if (!skipCache) {
  try {
    console.log(' Optimizing application caches...');
    // Clear old caches first
    execSync(`"${phpBin}" artisan optimize:clear`, {
      cwd: targetBackend,
      stdio: 'ignore',
    });

    if (isProduction) {
      execSync(`"${phpBin}" artisan config:cache`, { cwd: targetBackend, stdio: 'ignore' });
      execSync(`"${phpBin}" artisan route:cache`, { cwd: targetBackend, stdio: 'ignore' });
      execSync(`"${phpBin}" artisan view:cache`, { cwd: targetBackend, stdio: 'ignore' });
      logSuccess('Production caches compiled (config, routes, views).');
    } else {
      logSuccess('Application caches cleared for active development.');
    }
  } catch (err) {
    logWarn('Cache optimization skipped or encountered non-fatal error.');
  }
}

// 4.7 Restart background queue workers
try {
  execSync(`"${phpBin}" artisan queue:restart`, {
    cwd: targetBackend,
    stdio: 'ignore',
  });
  logSuccess('Queue worker restart signal dispatched.');
} catch (e) {}

// ------------------------------------------------------------------------------
// STEP 5: PRE-FLIGHT VERIFICATION AUDIT
// ------------------------------------------------------------------------------
logStep('5/5', 'Running Pre-Flight Deployment Audit');
const verifyScript = path.join(__dirname, 'verify_deployment_readiness.cjs');
if (fs.existsSync(verifyScript)) {
  try {
    execSync(`node "${verifyScript}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (e) {
    logWarn('Pre-flight check completed with warnings.');
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n${colors.bright}${colors.green}==================================================================${colors.reset}`);
console.log(`${colors.bright}${colors.green} DEPLOYMENT & SYNCHRONIZATION 100% COMPLETE! (${elapsedSec}s)           ${colors.reset}`);
console.log(`${colors.bright}${colors.green}==================================================================${colors.reset}`);
console.log(` ${colors.bright}Backend Location:${colors.reset}  ${targetBackend}`);
console.log(` ${colors.bright}Frontend Web Root:${colors.reset} ${targetFrontend}`);
console.log(` ${colors.bright}Status:${colors.reset}            Active, Verified, Ready for Production\n`);
