/**
 * DevCenterPoint ProERP — Frontend Distribution Synchronizer
 * 
 * Synchronizes the production build from `frontend/dist/` into `public_html/`
 * (the public web root for Apache/cPanel/Nginx).
 * 
 * Guarantees:
 * 1. Strictly PRESERVES server files: index.php, .htaccess, deploy-webhook.php
 * 2. Purges stale hashed chunks in `public_html/assets/` to prevent unbounded disk growth
 * 3. Copies latest index.html, static icons, PWA manifest, and service worker
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'frontend', 'dist');
const TARGET_DIR = path.join(ROOT_DIR, 'public_html');

// Server files that must NEVER be overwritten or deleted from public_html
const PRESERVED_FILES = new Set([
  'index.php',
  '.htaccess',
  'deploy-webhook.php',
  'portfolio-placeholder.html',
  'portfolio-htaccess.txt'
]);

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  fs.copyFileSync(src, dest);
}

function syncPublicHtml() {
  console.log('====================================================');
  console.log(' ProERP: Synchronizing frontend/dist -> public_html');
  console.log(` Source: ${DIST_DIR}`);
  console.log(` Target: ${TARGET_DIR}`);
  console.log('====================================================');

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`ERROR: Frontend build directory "${DIST_DIR}" does not exist.`);
    console.error('Please run "npm run build --workspace frontend" first.');
    process.exit(1);
  }

  ensureDirSync(TARGET_DIR);

  const distAssetsDir = path.join(DIST_DIR, 'assets');
  const targetAssetsDir = path.join(TARGET_DIR, 'assets');

  // 1. Synchronize assets/ directory
  if (fs.existsSync(distAssetsDir)) {
    ensureDirSync(targetAssetsDir);
    const newAssets = new Set(fs.readdirSync(distAssetsDir));
    const oldAssets = fs.existsSync(targetAssetsDir) ? fs.readdirSync(targetAssetsDir) : [];

    let removedCount = 0;
    let copiedCount = 0;

    // Remove stale chunk files not present in new build
    for (const oldFile of oldAssets) {
      if (!newAssets.has(oldFile)) {
        fs.unlinkSync(path.join(targetAssetsDir, oldFile));
        removedCount++;
      }
    }

    // Copy new/updated assets
    for (const newFile of newAssets) {
      copyFileSafe(path.join(distAssetsDir, newFile), path.join(targetAssetsDir, newFile));
      copiedCount++;
    }

    console.log(`✓ Assets synchronized: ${copiedCount} files updated, ${removedCount} stale files removed.`);
  }

  // 2. Synchronize root files (index.html, manifest.json, favicons, etc.)
  const distFiles = fs.readdirSync(DIST_DIR);
  let rootFilesCopied = 0;

  for (const item of distFiles) {
    if (item === 'assets') continue;

    const srcPath = path.join(DIST_DIR, item);
    const destPath = path.join(TARGET_DIR, item);

    if (PRESERVED_FILES.has(item)) {
      console.log(`- Skipping preserved server file: ${item}`);
      continue;
    }

    const stat = fs.statSync(srcPath);
    if (stat.isFile()) {
      copyFileSafe(srcPath, destPath);
      rootFilesCopied++;
    } else if (stat.isDirectory()) {
      // Recursively copy subdirectories if any (e.g. fonts, static)
      fs.cpSync(srcPath, destPath, { recursive: true });
      rootFilesCopied++;
    }
  }

  console.log(`✓ Root entry files updated: ${rootFilesCopied} files/folders copied.`);

  // 3. Verify critical entry points exist in target
  const indexHtmlPath = path.join(TARGET_DIR, 'index.html');
  const indexPhpPath = path.join(TARGET_DIR, 'index.php');
  const htaccessPath = path.join(TARGET_DIR, '.htaccess');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('ERROR: public_html/index.html is missing after sync!');
    process.exit(1);
  }
  if (!fs.existsSync(indexPhpPath)) {
    console.error('ERROR: public_html/index.php is missing!');
    process.exit(1);
  }
  if (!fs.existsSync(htaccessPath)) {
    console.error('ERROR: public_html/.htaccess is missing!');
    process.exit(1);
  }

  console.log('✓ Verification passed: index.html, index.php, and .htaccess are in place.');
  console.log('====================================================');
  console.log(' Frontend deployment synchronization COMPLETE.');
  console.log('====================================================');
}

syncPublicHtml();
