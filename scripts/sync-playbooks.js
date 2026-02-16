#!/usr/bin/env node
// sync-playbooks.js — Keep the three playbook directories in sync (Node.js version).
//
// Canonical source for playbook markdown files:
//   publiclogic-operating-system/
//
// UI copies (must stay identical to each other):
//   publiclogic-os-ui/content/playbooks/
//   publiclogic-site/HMLP/content/playbooks/
//
// Usage:
//   node scripts/sync-playbooks.js          # default: sync
//   node scripts/sync-playbooks.js --check  # dry-run: report drift, exit 1 if out of sync

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OS_DIR = path.join(REPO_ROOT, 'publiclogic-operating-system');
const UI_DIR = path.join(REPO_ROOT, 'publiclogic-os-ui', 'content', 'playbooks');
const SITE_DIR = path.join(REPO_ROOT, 'publiclogic-site', 'HMLP', 'content', 'playbooks');

const checkOnly = process.argv.includes('--check');
let drift = false;

function compareFile(file, srcDir, dstDir) {
  const src = path.join(srcDir, file);
  const dst = path.join(dstDir, file);

  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dst)) {
    console.log(`  MISSING  ${dst}`);
    drift = true;
    return;
  }

  const srcContent = fs.readFileSync(src);
  const dstContent = fs.readFileSync(dst);
  if (!srcContent.equals(dstContent)) {
    console.log(`  DIFFERS  ${dst}`);
    drift = true;
  }
}

function copyFile(file, srcDir, dstDir) {
  const src = path.join(srcDir, file);
  const dst = path.join(dstDir, file);

  if (!fs.existsSync(src)) return;

  if (fs.existsSync(dst)) {
    const srcContent = fs.readFileSync(src);
    const dstContent = fs.readFileSync(dst);
    if (srcContent.equals(dstContent)) return;
  }

  fs.copyFileSync(src, dst);
  console.log(`  SYNCED   ${file} → ${dstDir}/`);
}

// 1. Sync playbook markdown files: OS → UI copies
console.log('Checking playbook markdown files (OS → UI copies)...');

const osFiles = fs.readdirSync(OS_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
for (const file of osFiles) {
  if (checkOnly) {
    compareFile(file, OS_DIR, UI_DIR);
    compareFile(file, OS_DIR, SITE_DIR);
  } else {
    copyFile(file, OS_DIR, UI_DIR);
    copyFile(file, OS_DIR, SITE_DIR);
  }
}

// 2. Sync index.json between UI copies
console.log('Checking index.json (OS-UI ↔ HMLP site)...');

if (checkOnly) {
  compareFile('index.json', UI_DIR, SITE_DIR);
} else {
  copyFile('index.json', UI_DIR, SITE_DIR);
}

// 3. Check for markdown files in UI dirs that are missing from OS
console.log('Checking for UI-only markdown files not in OS...');

const uiFiles = fs.readdirSync(UI_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
for (const file of uiFiles) {
  if (!fs.existsSync(path.join(OS_DIR, file))) {
    console.log(`  WARNING  ${file} exists in UI but not in OS (canonical source). Move it to OS or remove it from UI.`);
    drift = true;
  }
}

// Summary
if (checkOnly) {
  if (!drift) {
    console.log('✓ All playbook files are in sync.');
    process.exit(0);
  } else {
    console.log('✗ Drift detected. Run node scripts/sync-playbooks.js to fix.');
    process.exit(1);
  }
} else {
  console.log('✓ Playbook sync complete.');
}
