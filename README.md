# Kanji Companion

<div align="center">
  <img src="public/icons/icon128.png" alt="Kanji Companion Logo" width="128" height="128">
</div>

A browser extension that makes learning Japanese more natural and effective by providing intelligent, context-aware kanji assistance as you browse the web.

## Key Features

🎯 **Smart Kanji Recognition**
- Automatically identifies kanji in web pages
- Tracks your familiarity with each character
- Adapts furigana display based on your knowledge level

🔍 **Contextual Learning**
- Learn kanji in real-world context
- Hover tooltips show meanings and readings
- Progressive difficulty adjustment

🗣️ **Interactive Learning**
- Built-in Japanese text-to-speech
- Click to hear native pronunciation
- Track your progress over time

⚡ **Performance Focused**
- Lightweight and fast
- Works on any webpage
- Minimal impact on browsing experience

## Installation

### From Browser Store
Coming soon to Firefox Add-ons and Chrome Web Store!

### Manual Installation (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/kanji-companion.git
   cd kanji-companion
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

### Commands

```bash
# Start development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
kanji-companion/
├── src/
│   ├── popup/      # Extension popup UI
│   ├── background/ # Background service worker
│   ├── content/    # Content script for webpage integration
│   └── lib/        # Shared utilities and data
├── public/         # Static assets
├── tests/          # Test suite
└── dist/           # Built extension (generated)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE) © Your Name

---

<div align="center">
Made with ❤️ for Japanese learners
</div> 