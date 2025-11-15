const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Compile renderer.ts to plain JavaScript without module system
const rendererSrc = path.join(__dirname, '../src/renderer/renderer.ts');
const rendererDest = path.join(__dirname, '../dist/renderer/renderer.js');

// Read the TypeScript file
const tsContent = fs.readFileSync(rendererSrc, 'utf8');

// Remove the export {} statement
const jsContent = tsContent
  .replace(/^export\s*\{\s*\};?\s*\n?/gm, '')
  .replace(/^\/\/\s*Make this a module\s*\n?/gm, '')
  .replace(/^\/\/\s*Renderer script\s*\n?/gm, '');

// Simple TypeScript to JavaScript conversion (basic)
// For production, you'd want to use tsc with proper config
// But for now, we'll use tsc and then strip the exports

// First compile with tsc
try {
  execSync('tsc --project tsconfig.json', { stdio: 'inherit' });
} catch (error) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}

// Now read the compiled file and remove CommonJS exports
if (fs.existsSync(rendererDest)) {
  let compiled = fs.readFileSync(rendererDest, 'utf8');
  
  // Remove CommonJS exports wrapper
  compiled = compiled
    .replace(/^"use strict";\s*\n?/gm, '')
    .replace(/^Object\.defineProperty\(exports,\s*"__esModule",\s*\{\s*value:\s*true\s*\}\);\s*\n?/gm, '')
    .replace(/^exports\.\w+\s*=\s*/gm, '');
  
  fs.writeFileSync(rendererDest, compiled);
  console.log('Renderer script compiled and cleaned');
}

