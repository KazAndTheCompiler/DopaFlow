#!/usr/bin/env node

/**
 * Simple runtime test for Electron desktop app
 * Checks that required files exist
 */

const fs = require('fs');
const path = require('path');

const appDir = path.dirname(__dirname);
const buildDir = path.join(appDir, 'build');
const distDir = path.join(appDir, 'dist');

console.log('Testing DopaFlow Desktop runtime...');
console.log('App dir:', appDir);

// Check if build exists
const mainJs = path.join(buildDir, 'main.js');
if (!fs.existsSync(mainJs)) {
  console.log('Build output not found, running TypeScript build...');
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
    console.log('✓ Build completed');
  } catch (err) {
    console.error('✗ Build failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('✓ Build exists');
}

// Check for backend in expected location
const backendDir = path.join(appDir, '..', 'backend', 'dist', 'dopaflow-backend');
if (!fs.existsSync(backendDir)) {
  console.log('⚠ Backend not found at:', backendDir);
  console.log('  AppImage build will include backend from CI artifact');
} else {
  console.log('✓ Backend binary found');
}

// Check for frontend build
const frontendDir = path.join(appDir, '..', 'frontend', 'dist');
if (!fs.existsSync(frontendDir)) {
  console.log('⚠ Frontend build not found at:', frontendDir);
  console.log('  AppImage build will include frontend from CI build step');
} else {
  console.log('✓ Frontend build found');
}

console.log('\n✓ Runtime test passed - ready for packaging');
process.exit(0);
