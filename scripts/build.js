const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

// Ensure the dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Generate warning icons before building
(async function() {
  try {
    await import('./make-icons.js');
  } catch (err) {
    console.error('Failed to generate warning icons:', err);
    process.exit(1);
  }
})();

// Build the extension
console.log('Building extension...');
execSync('npm run build', { stdio: 'inherit' });

// Verify build output
const buildDir = path.join(distDir, 'build');
const manifestPath = path.join(buildDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
    console.error('Error: manifest.json not found in build directory!');
    console.error('Please ensure the build process copies manifest.json to the build directory.');
    process.exit(1);
}

// Helper function to create packages
const createPackage = (outputName) => {
    const output = fs.createWriteStream(path.join(distDir, outputName));
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`${outputName} created (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // Add files from build directory directly to the root of the zip
    const files = fs.readdirSync(buildDir);
    
    files.forEach(file => {
        const filePath = path.join(buildDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
            archive.file(filePath, { name: file });
        } else if (stats.isDirectory()) {
            archive.directory(filePath, file);
        }
    });

    return archive.finalize();
};

// Create Firefox package
console.log('\nCreating Firefox package...');
createPackage('language-lens-firefox.zip');

// Create Chrome package
console.log('\nCreating Chrome package...');
createPackage('language-lens-chrome.zip'); 