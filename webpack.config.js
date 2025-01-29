const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup/popup.js',
    content: './src/content/contentScript.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib/'),
      '@popup': path.resolve(__dirname, 'src/popup/'),
      '@background': path.resolve(__dirname, 'src/background/'),
      '@content': path.resolve(__dirname, 'src/content/')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'public',
          to: '.',
          globOptions: {
            ignore: ['**/.DS_Store']
          }
        },
        { 
          from: 'src/lib',
          to: 'lib',
          globOptions: {
            ignore: ['**/.DS_Store']
          }
        },
        {
          from: 'src/background/background.js',
          to: 'background.js'
        }
      ]
    })
  ]
}; 