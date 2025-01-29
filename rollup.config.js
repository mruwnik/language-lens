const { babel } = require('@rollup/plugin-babel');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const copy = require('rollup-plugin-copy');
const path = require('path');

const createConfig = (input, output) => ({
  input,
  output: {
    file: `dist/${output}`,
    format: 'iife',
    compact: true
  },
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      presets: [
        ['@babel/preset-env', {
          targets: {
            firefox: '109'
          },
          modules: false
        }]
      ]
    })
  ]
});

module.exports = [
  createConfig('src/popup/popup.js', 'popup.js'),
  createConfig('src/content/contentScript.js', 'content.js'),
  createConfig('src/background/background.js', 'background.js'),
  {
    // Empty config just for copying files
    input: 'src/lib/empty.js',
    output: {
      file: 'dist/empty.js'
    },
    plugins: [
      copy({
        targets: [
          { 
            src: 'public/*', 
            dest: 'dist',
            ignore: ['.DS_Store']
          },
          {
            src: 'src/lib/*',
            dest: 'dist/lib',
            ignore: ['.DS_Store']
          }
        ]
      })
    ]
  }
]; 