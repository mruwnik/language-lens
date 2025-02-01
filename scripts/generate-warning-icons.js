const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const ICON_SIZES = [16, 32, 48, 128];
const WARNING_TRIANGLE_RATIOS = {
  16: 0.5,   // 8px warning triangle
  32: 0.375, // 12px warning triangle
  48: 0.25,  // 12px warning triangle
  128: 0.125 // 16px warning triangle
};

async function generateWarningIcon(size) {
  const inputPath = path.join(__dirname, '..', 'public', 'icons', `icon${size}.png`);
  const warningPath = path.join(__dirname, '..', 'public', 'warning-triangle.svg');
  const outputPath = path.join(__dirname, '..', 'public', 'icons', `icon${size}-warning.png`);

  // Calculate warning triangle size
  const triangleSize = Math.round(size * WARNING_TRIANGLE_RATIOS[size]);
  
  // Read and resize warning triangle
  const warningTriangle = await sharp(warningPath)
    .resize(triangleSize, triangleSize)
    .toBuffer();

  // Make base icon translucent
  const baseIcon = await sharp(inputPath)
    .ensureAlpha()
    .modulate({
      brightness: 0.7  // Darken slightly
    })
    .composite([{
      input: Buffer.from([0, 0, 0, 178]), // Alpha value of ~70%
      raw: {
        width: 1,
        height: 1,
        channels: 4
      },
      tile: true,
      blend: 'dest-in'
    }])
    .toBuffer();

  // Composite warning triangle onto modified base icon
  await sharp(baseIcon)
    .composite([{
      input: warningTriangle,
      top: size - triangleSize,
      left: size - triangleSize
    }])
    .toFile(outputPath);
}

async function main() {
  try {
    await Promise.all(ICON_SIZES.map(generateWarningIcon));
    console.log('Successfully generated warning icons');
  } catch (error) {
    console.error('Error generating warning icons:', error);
    process.exit(1);
  }
}

main(); 