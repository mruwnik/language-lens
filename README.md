# Language Companion

<div align="center">
  <img src="public/icons/icon128.png" alt="Language Companion Logo" width="128" height="128">
</div>

A browser extension that makes language learning more natural and effective by providing intelligent, context-aware assistance as you browse the web.

## Key Features

🎯 **Smart Language Recognition**
- Automatically identifies words and phrases in web pages
- Tracks your familiarity with vocabulary
- Adapts display based on your knowledge level

🔍 **Contextual Learning**
- Learn words in real-world context
- Hover tooltips show translations and meanings
- Progressive difficulty adjustment

🗣️ **Interactive Learning**
- Intelligent partial translation assistance
- Learn vocabulary in context
- Track your progress over time

⚡ **Performance Focused**
- Efficient caching system
- Works on any webpage
- Minimal impact on browsing experience

## Installation

### From Browser Store
Coming soon to Firefox Add-ons and Chrome Web Store!

### Manual Installation (Development)

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
   - **Firefox**:
     1. Go to `about:debugging`
     2. Click "This Firefox"
     3. Click "Load Temporary Add-on"
     4. Select any file in the `dist` directory
   
   - **Chrome**:
     1. Go to `chrome://extensions`
     2. Enable "Developer mode"
     3. Click "Load unpacked"
     4. Select the `dist` directory

## Development

### Project Structure

```
language-plugin/
├── src/
│   ├── popup/         # Extension popup UI
│   ├── background/    # Background service worker
│   ├── content/       # Content script for webpage integration
│   └── lib/          # Shared utilities and core functionality
├── public/           # Static assets and extension manifest
└── dist/            # Built extension (generated)
```

### Core Components

- **Background Service**: Handles translation caching and LLM integration
- **Content Scripts**: Manage webpage integration and text processing
- **Popup UI**: User settings and learning progress interface
- **Library**: Shared utilities for text processing, settings, and LLM providers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)