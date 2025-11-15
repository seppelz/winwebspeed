const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find the most recent winCodeSign archive
const cacheDir = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || '', 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');

if (!fs.existsSync(cacheDir)) {
  return;
}

try {
  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.7z'));
  
  if (files.length > 0) {
    // Get the most recent file
    const archiveFile = files.map(f => {
      try {
        return {
          name: f,
          time: fs.statSync(path.join(cacheDir, f)).mtime
        };
      } catch {
        return null;
      }
    }).filter(f => f !== null).sort((a, b) => b.time - a.time)[0];
    
    if (archiveFile) {
      const archivePath = path.join(cacheDir, archiveFile.name);
      const extractPath = path.join(cacheDir, archiveFile.name.replace('.7z', ''));
      
      // Remove existing extraction if it exists
      if (fs.existsSync(extractPath)) {
        try {
          fs.rmSync(extractPath, { recursive: true, force: true });
        } catch (e) {
          // Ignore
        }
      }
      
      console.log(`\nExtracting ${archiveFile.name} without symbolic links...`);
      
      // Extract with 7zip, using -snl flag to skip symbolic links
      const sevenZipPath = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
      if (fs.existsSync(sevenZipPath)) {
        execSync(`"${sevenZipPath}" x -snl -y "${archivePath}" -o"${extractPath}"`, {
          stdio: 'inherit',
          cwd: cacheDir
        });
        console.log('Extraction successful!');
      } else {
        console.warn('7zip not found at expected path');
      }
    }
  }
} catch (err) {
  console.warn('Could not extract archive:', err.message);
}

