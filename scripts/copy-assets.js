const fs = require('fs');
const path = require('path');

// Create dist directories if they don't exist
const distRenderer = path.join(__dirname, '../dist/renderer');
const distAssets = path.join(__dirname, '../dist/assets');
if (!fs.existsSync(distRenderer)) {
  fs.mkdirSync(distRenderer, { recursive: true });
}
if (!fs.existsSync(distAssets)) {
  fs.mkdirSync(distAssets, { recursive: true });
}

// Copy HTML and CSS files
const filesToCopy = [
  { src: 'src/renderer/index.html', dest: 'dist/renderer/index.html' },
  { src: 'src/renderer/styles.css', dest: 'dist/renderer/styles.css' },
  { src: 'src/renderer/taskbar-overlay.html', dest: 'dist/renderer/taskbar-overlay.html' }
];

// Copy icon files from assets
const iconFiles = ['icon.png', 'favicon.png', 'icon-256.png'];

filesToCopy.forEach(({ src, dest }) => {
  const srcPath = path.join(__dirname, '..', src);
  const destPath = path.join(__dirname, '..', dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${src} to ${dest}`);
  } else {
    console.warn(`Warning: ${src} not found`);
  }
});

// Copy icon files
iconFiles.forEach(file => {
  const srcPath = path.join(__dirname, '..', 'assets', file);
  const destPath = path.join(__dirname, '..', 'dist', 'assets', file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied assets/${file} to dist/assets/`);
  }
});

// Copy JS files (like Lucide)
const distJs = path.join(__dirname, '../dist/assets/js');
if (!fs.existsSync(distJs)) {
  fs.mkdirSync(distJs, { recursive: true });
}

const jsFiles = ['lucide.js'];
const assetsJs = path.join(__dirname, '../assets/js');

jsFiles.forEach(file => {
  const srcPath = path.join(assetsJs, file);
  const destPath = path.join(distJs, file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied assets/js/${file} to dist/assets/js/`);
  } else {
    console.warn(`Warning: assets/js/${file} not found`);
  }
});


