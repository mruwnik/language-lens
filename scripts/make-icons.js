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

async function generateIcon(size, variant) {
  const baseIconPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
  const warningTrianglePath = path.join(__dirname, '..', 'public', 'warning-triangle.svg');
  const outputPath = variant === 'normal'
    ? path.join(__dirname, '..', 'public', 'icons', `icon${size}.png`)
    : path.join(__dirname, '..', 'public', 'icons', `icon${size}-${variant}.png`);

  if (variant === 'normal') {
    // For normal icons, just convert and resize
    await sharp(baseIconPath)
      .resize(size, size)
      .toFile(outputPath);
    return;
  }

  // Calculate warning triangle size
  const triangleSize = Math.round(size * WARNING_TRIANGLE_RATIOS[size]);

  // Prepare warning triangle with appropriate color
  const triangleColor = variant === 'danger' ? '#FF4444' : '#FFB800';
  const triangleStroke = variant === 'danger' ? '#CC0000' : '#CC9600';
  
  // Read SVG and replace colors
  const triangleSvg = (await fs.readFile(warningTrianglePath, 'utf8'))
    .replace('#FF8C00', triangleColor)
    .replace(/#FF4500/g, triangleStroke);

  // Create modified warning triangle
  const warningTriangle = await sharp(Buffer.from(triangleSvg))
    .resize(triangleSize, triangleSize)
    .toBuffer();

  // Generate the base icon
  await sharp(baseIconPath)
    .resize(size, size)
    .composite([{
      input: warningTriangle,
      top: size - triangleSize,
      left: size - triangleSize
    }])
    .toFile(outputPath);
}

async function main() {
  try {
    await Promise.all(
      ['normal', 'warning', 'danger'].flatMap(variant =>
        ICON_SIZES.map(size => generateIcon(size, variant))
      )
    );
    console.log('Successfully generated all icon variants');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main(); 