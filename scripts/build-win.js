const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set environment variable to disable code signing auto-discovery
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

// Clean release folder if it exists and might have locked files
const releaseDir = path.join(__dirname, '..', 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');

if (fs.existsSync(unpackedDir)) {
  console.log('⚠️  Found existing build. Cleaning release folder...');
  try {
    // Try to remove the unpacked directory with retries
    let retries = 3;
    while (retries > 0) {
      try {
        fs.rmSync(unpackedDir, { recursive: true, force: true });
        console.log('✅ Cleaned release folder');
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw err;
        }
        console.log(`   Retrying... (${retries} attempts left)`);
        // Wait a bit before retrying
        const start = Date.now();
        while (Date.now() - start < 1000) {}
      }
    }
  } catch (err) {
    console.error('\n❌ Could not clean release folder!');
    console.error('   Error:', err.message);
    console.error('\n💡 Solution:');
    console.error('   1. Close WebSpeed.exe if it\'s running');
    console.error('   2. Close any file explorer windows showing the release folder');
    console.error('   3. Run: npm run clean:release');
    console.error('   4. Then run: npm run dist:win');
    process.exit(1);
  }
}

// Monitor and fix winCodeSign extraction
const cacheDir = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');

// Set up a watcher to extract archives without symlinks when they're downloaded
const extractScript = path.join(__dirname, 'extract-without-symlinks.js');

// Build portable version (doesn't require code signing)
// Create a clean environment - filter out all code signing related vars
const env = {};
for (const key in process.env) {
  if (!key.startsWith('CSC_') && !key.startsWith('WIN_CSC_')) {
    env[key] = process.env[key];
  }
}
// Set only what we need
env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

console.log('Building Windows installer and portable executable (no code signing required)...');

// Use spawn to monitor output and fix extraction issues
// Don't pass sign=false as CLI arg since it's causing issues - rely on package.json config
const builder = spawn('electron-builder', ['--win'], {
  env: env,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let output = '';
let errorOutput = '';

builder.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  output += text;
  
  // If archive is downloaded, try to extract it properly
  if (text.includes('downloaded') && text.includes('winCodeSign')) {
    setTimeout(() => {
      try {
        require('./extract-without-symlinks.js');
      } catch (e) {
        // Ignore
      }
    }, 500);
  }
});

builder.stderr.on('data', (data) => {
  const text = data.toString();
  process.stderr.write(text);
  errorOutput += text;
  
  // If extraction fails, try to fix it
  if (text.includes('Cannot create symbolic link')) {
    setTimeout(() => {
      try {
        require('./extract-without-symlinks.js');
        console.log('\nFixed extraction, electron-builder should retry automatically...');
      } catch (e) {
        // Ignore
      }
    }, 1000);
  }
});

builder.on('close', (code) => {
  const unpackedPath = path.join(__dirname, '..', 'release', 'win-unpacked');
  
  if (code !== 0 && (errorOutput.includes('Cannot create symbolic link') || errorOutput.includes('Unable to commit changes') || errorOutput.includes('Cannot find module'))) {
    console.log('\n\n⚠️  Code signing extraction error detected.');
    
    if (fs.existsSync(unpackedPath)) {
      console.log('✅ Good news: Unpacked app was created successfully!');
      console.log(`   Location: ${unpackedPath}`);
      console.log('\n📦 Attempting to fix extraction and complete packaging...');
      try {
        require('./extract-without-symlinks.js');
        console.log('Retrying final packaging step...');
        execSync('electron-builder --win', { stdio: 'inherit', env: env });
      } catch (err) {
        console.log('\n⚠️  Final packaging failed, but you can still use the app!');
        console.log(`\n✅ Your app is ready at: ${unpackedPath}`);
        console.log('   You can run WebSpeed.exe directly from there.');
        console.log('\n💡 To create a portable .exe file:');
        console.log('   1. Run terminal as Administrator, or');
        console.log('   2. Use the unpacked folder as-is');
        process.exit(0); // Exit successfully since we have a working app
      }
    } else {
      console.error('\n❌ Build failed completely. Solutions:');
      console.error('1. Run terminal as Administrator and try again');
      console.error('2. Or manually extract the archive from:');
      console.error(`   ${cacheDir}`);
      process.exit(1);
    }
  } else if (code !== 0) {
    process.exit(code);
  } else {
    console.log('\n✅ Build completed successfully!');
    if (fs.existsSync(unpackedPath)) {
      console.log(`📦 App location: ${unpackedPath}`);
    }
  }
});

