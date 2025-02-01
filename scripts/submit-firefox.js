const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
require('dotenv').config();

// Setup DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Check for dry run flag
const isDryRun = process.argv.includes('--dry-run');

// Ensure required environment variables are set
const requiredEnvVars = ['AMO_JWT_ISSUER', 'AMO_JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error('Error: Missing required environment variables:');
    console.error(missingVars.join(', '));
    console.error('\nPlease set these variables in your .env file.');
    console.error('You can get these credentials from https://addons.mozilla.org/developers/addon/api/key/');
    console.error('\nSee .env.example for the required format.');
    process.exit(1);
}

// Read the AMO listing content
const amoListingPath = path.join(__dirname, '..', 'docs', 'amo-listing.md');
if (!fs.existsSync(amoListingPath)) {
    console.error('Error: AMO listing file not found at:', amoListingPath);
    process.exit(1);
}

// Convert markdown to HTML and sanitize
const listingContent = fs.readFileSync(amoListingPath, 'utf-8');
const unsafeHtml = marked(listingContent, { 
    gfm: true,
    breaks: true,
    mangle: false,
    headerIds: false
});
const htmlContent = DOMPurify.sanitize(unsafeHtml, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href']
});

// Create a temporary metadata file for web-ext
const metadataPath = path.join(__dirname, '..', 'dist', 'metadata.json');
const metadata = {
    description: htmlContent
};

if (!fs.existsSync(path.dirname(metadataPath))) {
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
}
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

// First build the extension
console.log('Building extension...');
execSync('node scripts/build.js', { stdio: 'inherit' });

const distDir = path.join(__dirname, '../dist');

// Submit to Firefox Add-ons
console.log(`\n${isDryRun ? 'Dry run: ' : ''}Submitting to Firefox Add-ons...`);
try {
    execSync(
        'npx web-ext sign ' +
        '--source-dir ./dist/build ' +
        `--artifacts-dir ${distDir} ` +
        `--channel ${isDryRun ? 'unlisted' : 'listed'} ` +
        '--use-submission-api ' +
        `--api-key ${process.env.AMO_JWT_ISSUER} ` +
        `--api-secret ${process.env.AMO_JWT_SECRET} ` +
        `--amo-metadata ${metadataPath}`,
        { stdio: 'inherit' }
    );
    console.log(`\n✅ Extension successfully ${isDryRun ? 'validated' : 'submitted'} to Firefox Add-ons!`);
    if (isDryRun) {
        console.log('\nThis was a dry run. The extension was not actually published.');
        console.log('Run without --dry-run to publish for real.');
    }
} catch (error) {
    console.error('\n❌ Failed to submit extension:', error.message);
    process.exit(1);
} finally {
    // Clean up the temporary metadata file
    if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
    }
} 