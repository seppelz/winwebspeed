const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Generate lightning bolt icon as RGBA buffer
function generateLightningBoltIcon(size = 32) {
  const data = Buffer.alloc(size * size * 4);
  
  // Fill with transparent background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      data[offset] = 0;       // R
      data[offset + 1] = 0;   // G
      data[offset + 2] = 0;   // B
      data[offset + 3] = 0;   // A (transparent)
    }
  }
  
  // Scale factors for different sizes
  const scale = size / 16;
  
  // Classic lightning bolt shape (yellow/gold)
  // Top section: narrow point (y: 0-3)
  for (let y = 0; y <= Math.floor(3 * scale); y++) {
    const centerX = Math.floor(8 * scale);
    const width = Math.max(1, Math.floor((2 - Math.floor(y / (2 * scale))) * scale));
    for (let x = centerX - width; x <= centerX + width; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;     // R (yellow)
        data[offset + 1] = 200; // G
        data[offset + 2] = 0;   // B
        data[offset + 3] = 255; // A
      }
    }
  }
  
  // Upper middle: shift left (y: 4-6)
  for (let y = Math.floor(4 * scale); y <= Math.floor(6 * scale); y++) {
    const centerX = Math.floor(6 * scale);
    const width = Math.floor(2 * scale);
    for (let x = centerX - width; x <= centerX + width; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;     // R (yellow)
        data[offset + 1] = 200; // G
        data[offset + 2] = 0;   // B
        data[offset + 3] = 255; // A
      }
    }
  }
  
  // Lower middle: shift right (y: 7-9)
  for (let y = Math.floor(7 * scale); y <= Math.floor(9 * scale); y++) {
    const centerX = Math.floor(10 * scale);
    const width = Math.floor(2 * scale);
    for (let x = centerX - width; x <= centerX + width; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;     // R (yellow)
        data[offset + 1] = 200; // G
        data[offset + 2] = 0;   // B
        data[offset + 3] = 255; // A
      }
    }
  }
  
  // Bottom section: narrow point offset right (y: 10-15)
  for (let y = Math.floor(10 * scale); y < size; y++) {
    const centerX = Math.floor(9 * scale);
    const width = Math.max(1, Math.floor((2 - Math.floor((size - y) / (2 * scale))) * scale));
    for (let x = centerX - width; x <= centerX + width; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const offset = (y * size + x) * 4;
        data[offset] = 255;     // R (yellow)
        data[offset + 1] = 200; // G
        data[offset + 2] = 0;   // B
        data[offset + 3] = 255; // A
      }
    }
  }
  
  // Connect the sections with diagonal lines
  // Connect top to upper middle
  for (let y = Math.floor(3 * scale); y <= Math.floor(4 * scale); y++) {
    const x = Math.floor((8 - (y / scale - 3) * 2) * scale);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 200;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
  
  // Connect upper middle to lower middle
  for (let y = Math.floor(6 * scale); y <= Math.floor(7 * scale); y++) {
    const x = Math.floor((6 + (y / scale - 6) * 4) * scale);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 200;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
  
  // Connect lower middle to bottom
  for (let y = Math.floor(9 * scale); y <= Math.floor(10 * scale); y++) {
    const x = Math.floor((10 - (y / scale - 9) * 1) * scale);
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 200;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    }
  }
  
  // Add highlight/shine
  for (let y = Math.floor(2 * scale); y <= Math.floor(12 * scale); y++) {
    let x = 0;
    if (y <= Math.floor(3 * scale)) x = Math.floor(6 * scale);
    else if (y <= Math.floor(6 * scale)) x = Math.floor(4 * scale);
    else if (y <= Math.floor(9 * scale)) x = Math.floor(8 * scale);
    else x = Math.floor(7 * scale);
    
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const offset = (y * size + x) * 4;
      if (data[offset + 3] > 0) {
        data[offset] = 255;     // R (brighter)
        data[offset + 1] = 255; // G (brighter)
        data[offset + 2] = 150; // B (brighter)
      }
    }
  }
  
  return { data, width: size, height: size };
}

// Convert RGBA buffer to PNG
function createPNGFromRGBA(rgbaData, width, height) {
  const png = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const idx = (width * y + x) << 2;
      png.data[idx] = rgbaData[offset];     // R
      png.data[idx + 1] = rgbaData[offset + 1]; // G
      png.data[idx + 2] = rgbaData[offset + 2]; // B
      png.data[idx + 3] = rgbaData[offset + 3]; // A
    }
  }
  
  return PNG.sync.write(png);
}

// Main function
function generateIcons() {
  const assetsDir = path.join(__dirname, '../assets');
  
  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  try {
    // Generate 32x32 icon for window logo
    const icon32 = generateLightningBoltIcon(32);
    const png32 = createPNGFromRGBA(icon32.data, icon32.width, icon32.height);
    const iconPath = path.join(assetsDir, 'icon.png');
    fs.writeFileSync(iconPath, png32);
    console.log('✅ Generated icon.png (32x32)');
    
    // Generate 16x16 for favicon
    const icon16 = generateLightningBoltIcon(16);
    const png16 = createPNGFromRGBA(icon16.data, icon16.width, icon16.height);
    const faviconPath = path.join(assetsDir, 'favicon.png');
    fs.writeFileSync(faviconPath, png16);
    console.log('✅ Generated favicon.png (16x16)');
    
    // Generate 256x256 for Windows icon (for better quality)
    const icon256 = generateLightningBoltIcon(256);
    const png256 = createPNGFromRGBA(icon256.data, icon256.width, icon256.height);
    const icon256Path = path.join(assetsDir, 'icon-256.png');
    fs.writeFileSync(icon256Path, png256);
    console.log('✅ Generated icon-256.png (256x256)');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateIcons();
}

module.exports = { generateLightningBoltIcon, generateIcons };

