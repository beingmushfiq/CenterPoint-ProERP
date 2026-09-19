/**
 * DevCenterPoint ProERP — Deployment Pre-Flight Readiness Verification
 * 
 * Verifies that both frontend and backend are completely ready for production
 * deployment before pushing or executing automated deployment runners.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const PUBLIC_HTML_DIR = path.join(ROOT_DIR, 'public_html');

console.log('================================================================');
console.log('       DevCenterPoint ProERP — Pre-Flight Deployment Audit       ');
console.log('================================================================');

let errors = 0;
let warnings = 0;

function check(condition, message, isWarning = false) {
  if (condition) {
    console.log(` [PASS] ${message}`);
  } else {
    if (isWarning) {
      console.log(` [WARN] ${message}`);
      warnings++;
    } else {
      console.log(` [FAIL] ${message}`);
      errors++;
    }
  }
}

// 1. Frontend Audit
console.log('\n--- 1. Frontend Distribution Audit ---');
check(fs.existsSync(path.join(FRONTEND_DIR, 'dist', 'index.html')), 'frontend/dist/index.html exists');
check(fs.existsSync(path.join(PUBLIC_HTML_DIR, 'index.html')), 'public_html/index.html exists');
check(fs.existsSync(path.join(PUBLIC_HTML_DIR, 'assets')), 'public_html/assets/ directory exists');

const publicIndexHtml = fs.existsSync(path.join(PUBLIC_HTML_DIR, 'index.html')) 
  ? fs.readFileSync(path.join(PUBLIC_HTML_DIR, 'index.html'), 'utf-8') 
  : '';
const matchBundle = publicIndexHtml.match(/src="\/assets\/(index-[a-zA-Z0-9_\-]+\.js)"/);
if (matchBundle && matchBundle[1]) {
  const bundleFile = path.join(PUBLIC_HTML_DIR, 'assets', matchBundle[1]);
  check(fs.existsSync(bundleFile), `public_html/index.html references valid active bundle: ${matchBundle[1]}`);
} else {
  check(false, 'public_html/index.html does not contain valid bundle script reference');
}

// 2. Server Routing & Apache Configuration
console.log('\n--- 2. Server Configuration Audit ---');
check(fs.existsSync(path.join(PUBLIC_HTML_DIR, '.htaccess')), 'public_html/.htaccess exists');
check(fs.existsSync(path.join(PUBLIC_HTML_DIR, 'index.php')), 'public_html/index.php entry point exists');

const htaccessContent = fs.existsSync(path.join(PUBLIC_HTML_DIR, '.htaccess'))
  ? fs.readFileSync(path.join(PUBLIC_HTML_DIR, '.htaccess'), 'utf-8')
  : '';
check(htaccessContent.includes('HTTP_AUTHORIZATION'), '.htaccess preserves HTTP Authorization header');
check(htaccessContent.includes('RewriteRule ^ index.html [L]'), '.htaccess handles SPA routing fallback to index.html');
check(htaccessContent.includes('api'), '.htaccess routes API requests to index.php');

// 3. Backend Integrity Audit
console.log('\n--- 3. Backend Architecture Audit ---');
check(fs.existsSync(path.join(BACKEND_DIR, 'artisan')), 'backend/artisan executable exists');
check(fs.existsSync(path.join(BACKEND_DIR, 'bootstrap', 'app.php')), 'backend/bootstrap/app.php exists');
check(fs.existsSync(path.join(BACKEND_DIR, 'composer.json')), 'backend/composer.json exists');
check(fs.existsSync(path.join(ROOT_DIR, '.env.production.example')), 'Root .env.production.example template exists');

// Verify PHP CLI availability and run lint/route check if php is in PATH
try {
  const phpVersion = execSync('php -v', { stdio: 'pipe' }).toString().split('\n')[0];
  console.log(` [INFO] Detected local PHP CLI: ${phpVersion}`);

  try {
    execSync('php artisan route:list --path=api', { cwd: BACKEND_DIR, stdio: 'pipe' });
    check(true, 'Laravel API routes parsed and validated with zero fatal errors');
  } catch (err) {
    check(false, 'Laravel routes validation failed: ' + err.message);
  }
} catch (e) {
  console.log(' [NOTE] PHP CLI not available on current shell; skipping runtime artisan check.');
}

// 4. Deployment Scripts Audit
console.log('\n--- 4. Automated Deployment Scripts Audit ---');
check(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'auto-deploy.sh')), 'scripts/auto-deploy.sh exists');
check(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'deploy-cpanel.sh')), 'scripts/deploy-cpanel.sh exists');
check(fs.existsSync(path.join(ROOT_DIR, 'deploy.sh')), 'deploy.sh root runner exists');
check(fs.existsSync(path.join(ROOT_DIR, '.cpanel.yml')), '.cpanel.yml deployment task exists');

console.log('================================================================');
if (errors === 0) {
  console.log(` PRE-FLIGHT AUDIT PASSED (Errors: 0, Warnings: ${warnings})`);
  console.log(' Platform is properly configured and READY FOR PRODUCTION DEPLOYMENT.');
} else {
  console.error(` PRE-FLIGHT AUDIT FAILED (Errors: ${errors}, Warnings: ${warnings})`);
  process.exit(1);
}
console.log('================================================================');
