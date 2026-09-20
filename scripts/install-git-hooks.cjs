#!/usr/bin/env node
/**
 * DevCenterPoint ProERP — Git Hooks Installer
 *
 * Configures this repository to use the .githooks/ directory for all git hooks.
 * Run once after cloning or whenever hooks are updated:
 *
 *   node scripts/install-git-hooks.cjs
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, '.githooks');

if (!fs.existsSync(HOOKS_DIR)) {
  console.error(`ERROR: .githooks/ directory not found at ${HOOKS_DIR}`);
  process.exit(1);
}

try {
  execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'inherit' });
  console.log('✓ git hooks configured: .githooks/ is now active for this repository.');
  console.log('  Hooks installed:');
  for (const file of fs.readdirSync(HOOKS_DIR)) {
    const hookPath = path.join(HOOKS_DIR, file);
    const stat = fs.statSync(hookPath);
    if (stat.isFile()) {
      // Ensure the hook is executable on Unix systems
      try {
        fs.chmodSync(hookPath, 0o755);
      } catch {
        // chmod not available on Windows — git will handle it
      }
      console.log(`    - ${file}`);
    }
  }
  console.log('\n  The pre-push hook will now block pushes when the frontend');
  console.log('  build is stale. Run .\\scripts\\deploy-local.ps1 to rebuild.');
} catch (err) {
  console.error('ERROR: Failed to configure git hooks:', err.message);
  process.exit(1);
}
