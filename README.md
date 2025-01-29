# Language Learning Browser Extension

A browser extension that helps you learn languages by providing partial translations and managing known words.

## Features

- Manage known words in multiple languages
- Toggle between native script and pronunciation
- Text-to-speech support
- Search and filter words
- Undo deleted words
- Kanji usage tracking for Japanese

## Project Structure

```
language-learning-plugin/
├── src/
│   ├── popup/         # Popup UI related code
│   ├── background/    # Background scripts
│   ├── content/       # Content scripts
│   └── lib/          # Shared utilities and data
├── public/           # Static files
├── tests/           # Test files
└── dist/            # Built extension (generated)
```

## Development

### Prerequisites

- Node.js (v18.13.0 or higher)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development Commands

- Build the extension:
  ```bash
  npm run build
  ```

- Watch for changes during development:
  ```bash
  npm run dev
  ```

- Run tests:
  ```bash
  npm test
  ```

- Lint code:
  ```bash
  npm run lint
  ```

- Format code:
  ```bash
  npm run format
  ```

### Loading the Extension

1. Build the extension using `npm run build`
2. Open Chrome/Firefox and go to the extensions page
3. Enable developer mode
4. Click "Load unpacked" and select the `dist` directory

## Testing

Tests are written using Jest. Run them with:

```bash
npm test
```

## Browser Support

- Firefox (primary target)
- Chrome/Chromium (supported)

## License

MIT 