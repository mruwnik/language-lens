# Installing Language Lens

You can install Language Lens either from the browser stores or manually for development purposes.

## Browser Store Installation

### Firefox Add-ons
1. Visit [Language Lens on Firefox Add-ons](https://addons.mozilla.org/addon/language-lens)
2. Click "Add to Firefox"
3. Click "Add" in the confirmation dialog
4. The extension icon will appear in your toolbar

### Chrome Web Store
1. Visit [Language Lens on Chrome Web Store](https://chrome.google.com/webstore/detail/language-lens)
2. Click "Add to Chrome"
3. Click "Add Extension" in the confirmation dialog
4. The extension icon will appear in your toolbar

## Manual Installation (Development)

If you want to install the development version or contribute to the project:

### Prerequisites
- Node.js (version 18.13.0 or higher)
- npm (comes with Node.js)
- Git

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/mruwnik/language-lens.git
   cd language-lens
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in your browser:

   **Firefox:**
   1. Open Firefox
   2. Go to `about:debugging`
   3. Click "This Firefox"
   4. Click "Load Temporary Add-on"
   5. Navigate to the `dist/build` directory
   6. Select any file in the directory

   **Chrome:**
   1. Open Chrome
   2. Go to `chrome://extensions`
   3. Enable "Developer mode" (toggle in top-right)
   4. Click "Load unpacked"
   5. Select the `dist/build` directory

## Verifying Installation

After installation:

1. The Language Lens icon should appear in your browser toolbar
2. Click the icon to open the extension popup
3. Configure your preferred languages and settings
4. Visit any webpage to start learning!

## Troubleshooting

If you encounter any issues during installation:

- Check our [Troubleshooting Guide](troubleshooting.md)
- [Report an Issue](https://github.com/mruwnik/language-lens/issues)
- Make sure your browser is up to date
- Try disabling other extensions temporarily

## Next Steps

Once installed, check out the [Basic Usage](basic-usage.md) guide to learn how to use Language Lens effectively. 